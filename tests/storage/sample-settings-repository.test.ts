// SPDX-License-Identifier: GPL-3.0-or-later
// Tests des dépôts bibliothèque (métadonnées SQLite + fichiers via AudioFileStore factice)
// et réglages (ligne unique id = 0) contre un vrai SQLite (voir §8).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openDatabase } from '../../src/storage/db';
import { createSampleRepository } from '../../src/storage/sample-repository';
import { createSettingsRepository } from '../../src/storage/settings-repository';
import type { AudioFileStore } from '../../src/storage/types';
import type { Sample } from '../../src/domain/types';
import { defaultSettings } from '../../src/domain/invariants';
import { createNodeSqliteExecutor, type TestExecutor } from './node-sqlite-executor';

let executor: TestExecutor;

beforeEach(async () => {
  executor = createNodeSqliteExecutor();
  await openDatabase(executor);
});

afterEach(() => {
  executor.close();
});

function memoryFiles(): AudioFileStore & { store: Map<string, Uint8Array> } {
  const store = new Map<string, Uint8Array>();
  return {
    store,
    async write(fileName, data) {
      store.set(fileName, data.slice());
    },
    async read(fileName) {
      const data = store.get(fileName);
      if (!data) throw new Error(`introuvable: ${fileName}`);
      return data;
    },
    async remove(fileName) {
      store.delete(fileName);
    },
  };
}

function sample(id: string, createdAt = 0): Sample {
  return {
    id,
    label: `Label ${id}`,
    fileName: `${id}.ogg`,
    originalName: `${id}.wav`,
    mime: 'audio/ogg',
    sizeBytes: 3,
    durationMs: 1500,
    createdAt,
  };
}

describe('SampleRepository', () => {
  it('add écrit fichier + ligne ; list restitue les métadonnées dans l’ordre d’import', async () => {
    const files = memoryFiles();
    const repo = createSampleRepository({ db: executor, files });
    await repo.add(sample('s2', 20), new Uint8Array([2]));
    await repo.add(sample('s1', 10), new Uint8Array([1]));
    expect(files.store.has('s1.ogg')).toBe(true);
    const listed = await repo.list();
    expect(listed).toEqual([sample('s1', 10), sample('s2', 20)]); // trié par created_at
  });

  it('durationMs null accepté (colonne nullable)', async () => {
    const repo = createSampleRepository({ db: executor, files: memoryFiles() });
    await repo.add({ ...sample('s1'), durationMs: null }, new Uint8Array());
    expect((await repo.list())[0]?.durationMs).toBeNull();
  });

  it('échec d’insertion (id dupliqué) → le fichier écrit est retiré, l’erreur remonte', async () => {
    const files = memoryFiles();
    const repo = createSampleRepository({ db: executor, files });
    await repo.add(sample('s1'), new Uint8Array([1]));
    await expect(repo.add({ ...sample('s1'), fileName: 'bis.ogg' }, new Uint8Array([2]))).rejects.toThrow();
    expect(files.store.has('bis.ogg')).toBe(false); // pas d'orphelin
    expect(files.store.has('s1.ogg')).toBe(true); // l'existant est intact
  });

  it('rename ne change que le label', async () => {
    const repo = createSampleRepository({ db: executor, files: memoryFiles() });
    await repo.add(sample('s1'), new Uint8Array());
    await repo.rename('s1', 'Nouveau');
    expect((await repo.list())[0]).toEqual({ ...sample('s1'), label: 'Nouveau' });
  });

  it('remove supprime la ligne puis le fichier', async () => {
    const files = memoryFiles();
    const repo = createSampleRepository({ db: executor, files });
    await repo.add(sample('s1'), new Uint8Array([1]));
    await repo.remove('s1');
    expect(await repo.list()).toEqual([]);
    expect(files.store.size).toBe(0);
  });

  it('remove tolère un fichier déjà disparu (ligne supprimée quand même)', async () => {
    const files = memoryFiles();
    files.remove = vi.fn().mockRejectedValue(new Error('déjà parti'));
    const repo = createSampleRepository({ db: executor, files });
    await repo.add(sample('s1'), new Uint8Array([1]));
    await expect(repo.remove('s1')).resolves.toBeUndefined();
    expect(await repo.list()).toEqual([]);
  });

  it('replace réécrit le fichier et met à jour taille/durée (M7, retravail)', async () => {
    const files = memoryFiles();
    const repo = createSampleRepository({ db: executor, files });
    await repo.add(sample('s1'), new Uint8Array([1, 2, 3, 4]));
    await repo.replace({ ...sample('s1'), sizeBytes: 2, durationMs: 500 }, new Uint8Array([7, 8]));
    expect(Array.from(files.store.get('s1.ogg')!)).toEqual([7, 8]);
    expect((await repo.list())[0]).toMatchObject({ id: 's1', sizeBytes: 2, durationMs: 500, label: 'Label s1' });
  });

  it('readBytes relit les octets écrits', async () => {
    const repo = createSampleRepository({ db: executor, files: memoryFiles() });
    await repo.add(sample('s1'), new Uint8Array([9, 8, 7]));
    expect(await repo.readBytes('s1.ogg')).toEqual(new Uint8Array([9, 8, 7]));
  });
});

describe('SettingsRepository', () => {
  it('load sur base vide → réglages par défaut (§6)', async () => {
    expect(await createSettingsRepository(executor).load()).toEqual(defaultSettings());
  });

  it('save puis load : aller-retour fidèle', async () => {
    const repo = createSettingsRepository(executor);
    const settings = { backgroundBehavior: 'keepPlaying', maxVoices: 12, locale: 'en' } as const;
    await repo.save(settings);
    expect(await repo.load()).toEqual(settings);
  });

  it('save répété : upsert de la ligne unique (id = 0)', async () => {
    const repo = createSettingsRepository(executor);
    await repo.save({ backgroundBehavior: 'stopSustained', maxVoices: 4, locale: 'fr' });
    await repo.save({ backgroundBehavior: 'stopAll', maxVoices: 16, locale: 'fr' });
    expect(await repo.load()).toEqual({ backgroundBehavior: 'stopAll', maxVoices: 16, locale: 'fr' });
    const rows = await executor.select('SELECT id FROM settings');
    expect(rows).toHaveLength(1);
  });
});
