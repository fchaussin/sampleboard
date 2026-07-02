// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du dépôt banque contre un vrai SQLite : aller-retour fidèle, upsert-puis-élagage,
// cascades et références de samples (voir §8).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../../src/storage/db';
import { createBankRepository } from '../../src/storage/bank-repository';
import type { Bank } from '../../src/domain/types';
import { createNodeSqliteExecutor, type TestExecutor } from './node-sqlite-executor';

let executor: TestExecutor;

beforeEach(async () => {
  executor = createNodeSqliteExecutor();
  await openDatabase(executor);
});

afterEach(() => {
  executor.close();
});

function makeBank(): Bank {
  return {
    id: 'b1',
    name: 'Ma banque',
    pages: [
      { id: 'p1', name: 'Une', voiceMode: 'poly', rows: 4, cols: 4, position: 0, color: 'teal' },
      { id: 'p2', name: 'Deux', voiceMode: 'mono', rows: 2, cols: 3, position: 1, color: null },
    ],
    pads: [
      { id: 'a', pageId: 'p1', name: 'Kick', sampleId: null, playMode: 'oneShot', gainDb: -6.5, position: 0, color: 'red' },
      { id: 'c', pageId: 'p2', name: '', sampleId: null, playMode: 'loop', gainDb: 6, position: 5, color: null },
      { id: 'd', pageId: 'p1', name: 'Nappe', sampleId: null, playMode: 'gate', gainDb: -60, position: 15, color: null },
    ],
  };
}

async function insertSample(id: string): Promise<void> {
  await executor.execute(
    `INSERT INTO samples (id, label, file_name, original_name, mime, size_bytes, duration_ms, created_at)
     VALUES (?, ?, ?, ?, 'audio/ogg', 1, NULL, 0)`,
    [id, id, `${id}.ogg`, id],
  );
}

describe('BankRepository', () => {
  it('load sur base vide → null', async () => {
    expect(await createBankRepository(executor).load()).toBeNull();
  });

  it('aller-retour fidèle : save puis load restitue pages et pads (triés par position)', async () => {
    const repo = createBankRepository(executor);
    const bank = makeBank();
    await repo.save(bank);
    const loaded = await repo.load();
    expect(loaded).toEqual({
      ...bank,
      pads: [bank.pads[0], bank.pads[1], bank.pads[2]], // positions 0, 5, 15
    });
  });

  it('sauvegarde suivante : upsert (renommage) sans perdre les pads', async () => {
    const repo = createBankRepository(executor);
    const bank = makeBank();
    await repo.save(bank);
    bank.name = 'Renommée';
    bank.pages[0]!.name = 'Après';
    bank.pads[0]!.gainDb = 3;
    await repo.save(bank);
    const loaded = await repo.load();
    expect(loaded?.name).toBe('Renommée');
    expect(loaded?.pages[0]?.name).toBe('Après');
    expect(loaded?.pads).toHaveLength(3);
    expect(loaded?.pads[0]?.gainDb).toBe(3);
  });

  it('élagage : une page supprimée disparaît avec ses pads (cascade)', async () => {
    const repo = createBankRepository(executor);
    const bank = makeBank();
    await repo.save(bank);
    bank.pages = bank.pages.filter((p) => p.id !== 'p2');
    bank.pads = bank.pads.filter((p) => p.pageId !== 'p2');
    await repo.save(bank);
    const loaded = await repo.load();
    expect(loaded?.pages.map((p) => p.id)).toEqual(['p1']);
    expect(loaded?.pads.map((p) => p.id)).toEqual(['a', 'd']);
    const orphans = await executor.select("SELECT id FROM pads WHERE page_id = 'p2'");
    expect(orphans).toHaveLength(0);
  });

  it('un pad supprimé est élagué', async () => {
    const repo = createBankRepository(executor);
    const bank = makeBank();
    await repo.save(bank);
    bank.pads = bank.pads.filter((p) => p.id !== 'a');
    await repo.save(bank);
    expect((await repo.load())?.pads.map((p) => p.id)).toEqual(['c', 'd']);
  });

  it('sampleId existant conservé ; référence pendante écrite NULL (pas de violation FK)', async () => {
    const repo = createBankRepository(executor);
    await insertSample('s1');
    const bank = makeBank();
    bank.pads[0]!.sampleId = 's1'; // existe
    bank.pads[1]!.sampleId = 'fantome'; // pendante (sample supprimé entre-temps)
    await repo.save(bank);
    const loaded = await repo.load();
    expect(loaded?.pads[0]?.sampleId).toBe('s1');
    expect(loaded?.pads[1]?.sampleId).toBeNull();
  });

  it('supprimer la ligne sample → sample_id passe à NULL au rechargement (ON DELETE SET NULL, §8)', async () => {
    const repo = createBankRepository(executor);
    await insertSample('s1');
    const bank = makeBank();
    bank.pads[0]!.sampleId = 's1';
    await repo.save(bank);
    await executor.execute("DELETE FROM samples WHERE id = 's1'");
    expect((await repo.load())?.pads[0]?.sampleId).toBeNull();
  });

  it('couleur : token inconnu en base (palette réduite, donnée altérée) → neutralisé au chargement', async () => {
    const repo = createBankRepository(executor);
    await repo.save(makeBank());
    await executor.execute("UPDATE pads SET color = 'fuchsia-disco' WHERE id = 'a'");
    await executor.execute("UPDATE pages SET color = 'inconnu' WHERE id = 'p1'");
    const loaded = await repo.load();
    expect(loaded?.pads.find((p) => p.id === 'a')?.color).toBeNull();
    expect(loaded?.pages.find((p) => p.id === 'p1')?.color).toBeNull();
  });

  it('banque sans page en base → load renvoie null (état invalide, §6)', async () => {
    await executor.execute("INSERT INTO bank (id, name) VALUES ('seul', '')");
    expect(await createBankRepository(executor).load()).toBeNull();
  });

  it('v1 mono-banque : une banque résiduelle d’un autre id est purgée', async () => {
    const repo = createBankRepository(executor);
    await repo.save(makeBank());
    await repo.save({ ...makeBank(), id: 'b2' });
    const banks = await executor.select<{ id: string }>('SELECT id FROM bank');
    expect(banks.map((b) => b.id)).toEqual(['b2']);
  });
});
