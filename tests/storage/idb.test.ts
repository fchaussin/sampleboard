// SPDX-License-Identifier: GPL-3.0-or-later
// Tests des dépôts IndexedDB (M10) : aller-retours des quatre dépôts, cascades de
// suppression (miroir du schéma SQL) et RELECTURE après réouverture (la persistance est
// l'objet même du dépôt). IndexedDB simulé par fake-indexeddb (dev-only, Apache-2.0).
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createIdbRepositories } from '../../src/storage/idb';
import type { Bank, Sample, Settings, Tag } from '../../src/domain/types';

let n = 0;
/** Base UNIQUE par test : fake-indexeddb persiste pour tout le processus. */
const freshName = () => `sampleboard-test-${n++}`;

function sample(id: string, createdAt = 0): Sample {
  return {
    id,
    label: id,
    fileName: `${id}.ogg`,
    originalName: `${id}.wav`,
    mime: 'audio/ogg',
    sizeBytes: 3,
    durationMs: 1000,
    createdAt,
  };
}

const bank: Bank = {
  id: 'b',
  name: 'b',
  pages: [{ id: 'pg', name: 'P', voiceMode: 'poly', rows: 4, cols: 4, position: 0, color: 'red' }],
  pads: [
    { id: 'p1', pageId: 'pg', name: 'Pad', sampleId: 's1', playMode: 'loop', gainDb: -6, position: 0, color: null, cueStart: null, cueEnd: null },
  ],
};

describe('dépôts IndexedDB — aller-retours et réouverture', () => {
  it('banque : null au départ, sauvée puis relue FIDÈLEMENT après réouverture', async () => {
    const name = freshName();
    const repos = await createIdbRepositories(name);
    expect(await repos.bankRepository.load()).toBeNull();
    await repos.bankRepository.save(bank);

    const reopened = await createIdbRepositories(name); // nouvelle connexion, même base
    expect(await reopened.bankRepository.load()).toEqual(bank);
  });

  it('réglages : défauts au départ, champs manquants complétés à la relecture', async () => {
    const name = freshName();
    const repos = await createIdbRepositories(name);
    const defaults = await repos.settingsRepository.load();
    expect(defaults.maxVoices).toBeGreaterThan(0); // défauts du domaine

    const settings: Settings = { ...defaults, maxVoices: 12, locale: 'en' };
    await repos.settingsRepository.save(settings);
    const reopened = await createIdbRepositories(name);
    expect(await reopened.settingsRepository.load()).toEqual(settings);
  });

  it('samples : add/list (tri par createdAt), rename, octets relus, replace', async () => {
    const repos = await createIdbRepositories(freshName());
    await repos.sampleRepository.add(sample('s2', 20), new Uint8Array([2]));
    await repos.sampleRepository.add(sample('s1', 10), new Uint8Array([1]));

    expect((await repos.sampleRepository.list()).map((s) => s.id)).toEqual(['s1', 's2']);
    await repos.sampleRepository.rename('s1', 'Nouveau nom');
    expect((await repos.sampleRepository.list())[0]!.label).toBe('Nouveau nom');
    expect(await repos.sampleRepository.readBytes('s1.ogg')).toEqual(new Uint8Array([1]));

    await repos.sampleRepository.replace({ ...sample('s1', 10), durationMs: 500 }, new Uint8Array([9, 9]));
    expect(await repos.sampleRepository.readBytes('s1.ogg')).toEqual(new Uint8Array([9, 9]));
    expect((await repos.sampleRepository.list())[0]!.durationMs).toBe(500);
  });

  it('readBytes jette si les octets sont absents (fichier disparu, §12)', async () => {
    const repos = await createIdbRepositories(freshName());
    await expect(repos.sampleRepository.readBytes('fantome.ogg')).rejects.toThrow();
  });

  it('tags : CRUD + affectations n-à-n relues en Map', async () => {
    const repos = await createIdbRepositories(freshName());
    const t1: Tag = { id: 't1', label: 'A' };
    await repos.tagRepository.create(t1);
    await repos.tagRepository.create({ id: 't2', label: 'B' });
    await repos.tagRepository.rename('t2', 'Bé');
    expect((await repos.tagRepository.list()).map((t) => t.label).sort()).toEqual(['A', 'Bé']);

    await repos.tagRepository.assign('s1', 't1');
    await repos.tagRepository.assign('s1', 't2');
    await repos.tagRepository.unassign('s1', 't2');
    expect(await repos.tagRepository.assignments()).toEqual(new Map([['s1', new Set(['t1'])]]));
  });
});

describe('cascades de suppression (miroir du schéma SQL)', () => {
  it('remove(sample) emporte ses octets ET ses affectations', async () => {
    const name = freshName();
    const repos = await createIdbRepositories(name);
    await repos.sampleRepository.add(sample('s1'), new Uint8Array([1]));
    await repos.tagRepository.create({ id: 't1', label: 'A' });
    await repos.tagRepository.assign('s1', 't1');

    await repos.sampleRepository.remove('s1');

    expect(await repos.sampleRepository.list()).toEqual([]);
    await expect(repos.sampleRepository.readBytes('s1.ogg')).rejects.toThrow();
    expect(await repos.tagRepository.assignments()).toEqual(new Map());
    // Le tag lui-même survit (seules les affectations tombent).
    expect((await repos.tagRepository.list()).map((t) => t.id)).toEqual(['t1']);
  });

  it('remove(tag) emporte ses affectations, les autres tags restent', async () => {
    const repos = await createIdbRepositories(freshName());
    await repos.tagRepository.create({ id: 't1', label: 'A' });
    await repos.tagRepository.create({ id: 't2', label: 'B' });
    await repos.tagRepository.assign('s1', 't1');
    await repos.tagRepository.assign('s1', 't2');

    await repos.tagRepository.remove('t1');

    expect((await repos.tagRepository.list()).map((t) => t.id)).toEqual(['t2']);
    expect(await repos.tagRepository.assignments()).toEqual(new Map([['s1', new Set(['t2'])]]));
  });
});
