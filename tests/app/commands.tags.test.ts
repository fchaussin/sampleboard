// SPDX-License-Identifier: GPL-3.0-or-later
// Tests des commandes de tags M8 : CRUD, affectations (bascule), filtre — « Non classé »
// = absence d'entrée (une seule représentation). Store & dépôts factices.
import { describe, it, expect, vi } from 'vitest';
import { createCommands } from '../../src/app/commands';
import type { AppStore } from '../../src/app/store.svelte';
import type { AudioEngine } from '../../src/engine/audio-engine';
import type { Sample, Tag } from '../../src/domain/types';
import { matchesFilter } from '../../src/app/tag-filter';
import { fakeSampleRepository, fakeTagRepository } from './fake-sample-repository';

function sample(id: string): Sample {
  return {
    id,
    label: id,
    fileName: `${id}.ogg`,
    originalName: id,
    mime: 'audio/ogg',
    sizeBytes: 0,
    durationMs: null,
    createdAt: 0,
  };
}

function fakeStore(samples: Sample[] = [sample('s1')], tags: Tag[] = []): AppStore {
  return {
    bank: {
      id: 'b',
      name: 'b',
      pages: [{ id: 'pg', name: 'P', voiceMode: 'poly', rows: 4, cols: 4, position: 0, color: null }],
      pads: [
        { id: 'p1', pageId: 'pg', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 0, color: null },
        { id: 'p2', pageId: 'pg', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 1, color: null },
      ],
    },
    samples,
    tags,
    sampleTags: new Map<string, Set<string>>(),
    libraryFilter: null,
    assigningSampleId: null,
    poolSampleIds: [],
    poolOpen: false,
    libraryOpen: true,
    drawer: null,
    settings: { backgroundBehavior: 'stopAll', maxVoices: 8, locale: 'fr' },
    activePageId: null,
    editMode: false,
    selectedPadId: null,
    activePadIds: new Set<string>(),
  } as unknown as AppStore;
}

function setup(store = fakeStore()) {
  const tagRepository = fakeTagRepository();
  const sampleRepository = fakeSampleRepository();
  let n = 0;
  const commands = createCommands({
    store,
    engine: { unload: vi.fn(), stopPad: vi.fn() } as unknown as AudioEngine,
    encode: async () => new Uint8Array(),
    sampleRepository,
    tagRepository,
    ids: () => `tag-${n++}`,
  });
  return { store, commands, tagRepository, sampleRepository };
}

describe('CRUD des tags', () => {
  it('createTag : rogné, trié, écrit immédiatement ; libellé vide ignoré', () => {
    const { store, commands, tagRepository } = setup();
    commands.createTag('  Zeste ');
    commands.createTag('Ambiance');
    commands.createTag('   ');
    expect(store.tags.map((t) => t.label)).toEqual(['Ambiance', 'Zeste']); // trié
    expect(tagRepository.create).toHaveBeenCalledTimes(2);
  });

  it('renameTag retrie et écrit ; deleteTag épure affectations et filtre', () => {
    const store = fakeStore([sample('s1')], [{ id: 't1', label: 'A' }, { id: 't2', label: 'B' }]);
    store.sampleTags = new Map([['s1', new Set(['t1', 't2'])]]);
    store.libraryFilter = 't1';
    const { commands, tagRepository } = setup(store);

    commands.renameTag('t1', 'Zz');
    expect(store.tags.map((t) => t.label)).toEqual(['B', 'Zz']);
    expect(tagRepository.rename).toHaveBeenCalledWith('t1', 'Zz');

    commands.deleteTag('t1');
    expect(store.tags.map((t) => t.id)).toEqual(['t2']);
    expect(store.sampleTags.get('s1')).toEqual(new Set(['t2']));
    expect(store.libraryFilter).toBeNull(); // le filtre visait le tag supprimé
    expect(tagRepository.remove).toHaveBeenCalledWith('t1');
  });
});

describe('affectations (toggleSampleTag)', () => {
  it('bascule affecte puis retire ; ensemble vide → entrée supprimée (Non classé virtuel)', () => {
    const store = fakeStore([sample('s1')], [{ id: 't1', label: 'A' }]);
    const { commands, tagRepository } = setup(store);

    commands.toggleSampleTag('s1', 't1');
    expect(store.sampleTags.get('s1')).toEqual(new Set(['t1']));
    expect(tagRepository.assign).toHaveBeenCalledWith('s1', 't1');

    commands.toggleSampleTag('s1', 't1');
    expect(store.sampleTags.has('s1')).toBe(false); // pas d'ensemble vide stocké
    expect(tagRepository.unassign).toHaveBeenCalledWith('s1', 't1');
  });

  it('sample ou tag inconnu : no-op', () => {
    const { store, commands, tagRepository } = setup();
    commands.toggleSampleTag('fantome', 't1');
    commands.toggleSampleTag('s1', 'fantome');
    expect(store.sampleTags.size).toBe(0);
    expect(tagRepository.assign).not.toHaveBeenCalled();
  });
});

describe('filtre (matchesFilter + commandes)', () => {
  it('null = tous ; tag = affectés ; untagged = sans tag', () => {
    const tags = new Map([['s1', new Set(['t1'])]]);
    expect(matchesFilter('s1', tags, null)).toBe(true);
    expect(matchesFilter('s2', tags, null)).toBe(true);
    expect(matchesFilter('s1', tags, 't1')).toBe(true);
    expect(matchesFilter('s2', tags, 't1')).toBe(false);
    expect(matchesFilter('s1', tags, 'untagged')).toBe(false);
    expect(matchesFilter('s2', tags, 'untagged')).toBe(true);
  });

  it('setLibraryFilter pose le filtre ; deleteSample épure les affectations', () => {
    const store = fakeStore([sample('s1')], [{ id: 't1', label: 'A' }]);
    store.sampleTags = new Map([['s1', new Set(['t1'])]]);
    const { commands } = setup(store);
    commands.setLibraryFilter('untagged');
    expect(store.libraryFilter).toBe('untagged');
    commands.deleteSample('s1');
    expect(store.sampleTags.has('s1')).toBe(false);
  });
});

describe('assignation à la volée (M8)', () => {
  it('startAssigning arme le sample et ferme les surcouches', () => {
    const { store, commands } = setup();
    commands.startAssigning('s1');
    expect(store.assigningSampleId).toBe('s1');
    expect(store.libraryOpen).toBe(false);
    expect(store.drawer).toBeNull();
  });

  it('tapAssign assigne le sample armé à CHAQUE pad touché (multi-pads)', () => {
    const { store, commands } = setup();
    commands.startAssigning('s1');
    commands.tapAssign('p1');
    commands.tapAssign('p2');
    expect(store.bank!.pads[0]!.sampleId).toBe('s1');
    expect(store.bank!.pads[1]!.sampleId).toBe('s1');
    expect(store.bank!.pads[0]!.name).toBe('s1'); // nom par défaut depuis le label
  });

  it('tapAssign hors mode : no-op ; stopAssigning désarme ; sample inconnu refusé', () => {
    const { store, commands } = setup();
    commands.tapAssign('p1');
    expect(store.bank!.pads[0]!.sampleId).toBeNull();
    commands.startAssigning('fantome');
    expect(store.assigningSampleId).toBeNull();
    commands.startAssigning('s1');
    commands.stopAssigning();
    expect(store.assigningSampleId).toBeNull();
  });
});

describe('pool (M8)', () => {
  it('addToPool déduplique et exige un sample existant ; removeFromPool désarme si besoin', () => {
    const { store, commands } = setup();
    commands.addToPool('s1');
    commands.addToPool('s1'); // dédupliqué
    commands.addToPool('fantome'); // refusé
    expect(store.poolSampleIds).toEqual(['s1']);

    commands.startAssigning('s1');
    commands.removeFromPool('s1');
    expect(store.poolSampleIds).toEqual([]);
    expect(store.assigningSampleId).toBeNull(); // l'armé retiré est désarmé
  });

  it('openPool/closePool pilotent le tiroir gauche ; startAssigning le laisse ouvert', () => {
    const { store, commands } = setup();
    commands.openPool();
    expect(store.poolOpen).toBe(true);
    commands.startAssigning('s1');
    expect(store.poolOpen).toBe(true); // le pool sert PENDANT l'assignation
    commands.closePool();
    expect(store.poolOpen).toBe(false);
  });

  it('deleteSample sort le sample du pool et le désarme', () => {
    const { store, commands } = setup();
    commands.addToPool('s1');
    commands.startAssigning('s1');
    commands.deleteSample('s1');
    expect(store.poolSampleIds).toEqual([]);
    expect(store.assigningSampleId).toBeNull();
  });
});
