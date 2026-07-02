// SPDX-License-Identifier: GPL-3.0-or-later
// Tests des commandes d'édition M3 : CRUD pads/pages, grille (invariant de réduction),
// bibliothèque. Store & moteur factices ; générateur d'ids déterministe.
import { describe, it, expect, vi } from 'vitest';
import { createCommands } from '../../src/app/commands';
import type { AppStore } from '../../src/app/store.svelte';
import type { AudioEngine } from '../../src/engine/audio-engine';
import type { Bank, Pad, Sample } from '../../src/domain/types';
import { padsOfPage, findPad, findPage, pagesSorted } from '../../src/domain/selectors';
import { fakeSampleRepository, fakeTagRepository } from './fake-sample-repository';

function pad(id: string, pageId: string, position: number, extra: Partial<Pad> = {}): Pad {
  return {
    id,
    pageId,
    name: '',
    sampleId: null,
    playMode: 'oneShot',
    gainDb: 0,
    position,
    color: null,
    ...extra,
  };
}

function makeBank(): Bank {
  return {
    id: 'b',
    name: 'b',
    pages: [{ id: 'pg', name: 'P', voiceMode: 'poly', rows: 4, cols: 4, position: 0, color: null }],
    pads: [],
  };
}

function fakeStore(bank: Bank, samples: Sample[] = []): AppStore {
  return {
    bank,
    samples,
    settings: { backgroundBehavior: 'stopAll', maxVoices: 8, locale: 'fr' },
    activePageId: bank.pages[0]?.id ?? null,
    editMode: true,
    selectedPadId: null,
    tags: [],
    sampleTags: new Map<string, Set<string>>(),
    libraryFilter: null,
    activePadIds: new Set<string>(),
  } as unknown as AppStore;
}

function fakeEngine() {
  return {
    resume: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(undefined),
    stopPad: vi.fn(),
    stopPage: vi.fn(),
    oneShot: vi.fn(),
    press: vi.fn(),
    release: vi.fn(),
    toggleLoop: vi.fn(),
  };
}

function setup(bank = makeBank(), samples: Sample[] = []) {
  const store = fakeStore(bank, samples);
  const engine = fakeEngine();
  let n = 0;
  const commands = createCommands({
    store,
    engine: engine as unknown as AudioEngine,
    encode: async () => new Uint8Array(),
    sampleRepository: fakeSampleRepository(),
    tagRepository: fakeTagRepository(),
    ids: () => `id-${n++}`,
  });
  return { store, engine, commands };
}

describe('pads — création / position', () => {
  it('addPad place à la première position libre et sélectionne le pad', () => {
    const { store, commands } = setup();
    commands.addPad('pg');
    commands.addPad('pg');
    const pads = padsOfPage(store.bank!, 'pg');
    expect(pads.map((p) => p.position)).toEqual([0, 1]);
    expect(store.selectedPadId).toBe('id-1');
  });

  it('addPad à une position occupée est un no-op', () => {
    const { store, commands } = setup();
    commands.addPad('pg', 5);
    commands.addPad('pg', 5);
    expect(store.bank!.pads.filter((p) => p.position === 5)).toHaveLength(1);
  });

  it('addPad refuse quand la grille est pleine', () => {
    const bank = makeBank();
    bank.pages[0]!.rows = 2;
    bank.pages[0]!.cols = 2; // capacité 4
    const { store, commands } = setup(bank);
    for (let i = 0; i < 5; i++) commands.addPad('pg');
    expect(store.bank!.pads).toHaveLength(4);
  });
});

describe('pads — édition', () => {
  it('rename / setPlayMode / setGain (borné) / assignSample', () => {
    const sample: Sample = {
      id: 's1',
      label: 'S1',
      fileName: 's1.ogg',
      originalName: 'S1',
      mime: 'audio/ogg',
      sizeBytes: 0,
      durationMs: null,
      createdAt: 0,
    };
    const { store, commands } = setup(makeBank(), [sample]);
    commands.addPad('pg');
    const id = store.selectedPadId!;

    commands.renamePad(id, 'Kick');
    commands.setPadPlayMode(id, 'loop');
    commands.setPadGainDb(id, 999); // borné à +6
    commands.assignSample(id, 's1');

    const p = findPad(store.bank!, id)!;
    expect(p.name).toBe('Kick');
    expect(p.playMode).toBe('loop');
    expect(p.gainDb).toBe(6);
    expect(p.sampleId).toBe('s1');

    commands.assignSample(id, 'inconnu'); // sample absent → ignoré
    expect(findPad(store.bank!, id)!.sampleId).toBe('s1');
    commands.assignSample(id, null); // vider
    expect(findPad(store.bank!, id)!.sampleId).toBeNull();
  });

  it('deletePad stoppe la voix, retire le pad et vide la sélection', () => {
    const { store, engine, commands } = setup();
    commands.addPad('pg');
    const id = store.selectedPadId!;
    commands.deletePad(id);
    expect(engine.stopPad).toHaveBeenCalledWith(id);
    expect(findPad(store.bank!, id)).toBeUndefined();
    expect(store.selectedPadId).toBeNull();
  });

  it('reorderPads échange avec le pad occupant la position cible', () => {
    const bank = makeBank();
    bank.pads = [pad('a', 'pg', 0), pad('b', 'pg', 1)];
    const { store, commands } = setup(bank);
    commands.reorderPads('a', 1);
    expect(findPad(store.bank!, 'a')!.position).toBe(1);
    expect(findPad(store.bank!, 'b')!.position).toBe(0);
  });
});

describe('pages — CRUD', () => {
  it('addPage ajoute et active la nouvelle page', () => {
    const { store, commands } = setup();
    commands.addPage();
    expect(store.bank!.pages).toHaveLength(2);
    expect(store.activePageId).toBe('id-0');
  });

  it('deletePage refuse la dernière page', () => {
    const { store, commands } = setup();
    commands.deletePage('pg');
    expect(store.bank!.pages).toHaveLength(1);
  });

  it('deletePage supprime page + pads, stoppe et renumérote', () => {
    const bank = makeBank();
    bank.pages.push({ id: 'pg2', name: 'P2', voiceMode: 'poly', rows: 4, cols: 4, position: 1, color: null });
    bank.pads = [pad('x', 'pg', 0), pad('y', 'pg2', 0)];
    const { store, engine, commands } = setup(bank);
    commands.deletePage('pg');
    expect(engine.stopPage).toHaveBeenCalledWith('pg');
    expect(findPage(store.bank!, 'pg')).toBeUndefined();
    expect(store.bank!.pads.map((p) => p.id)).toEqual(['y']);
    expect(store.activePageId).toBe('pg2');
    expect(pagesSorted(store.bank!)[0]!.position).toBe(0);
  });

  it('reorderPages réordonne et renumérote les positions', () => {
    const bank = makeBank();
    bank.pages.push({ id: 'pg2', name: 'P2', voiceMode: 'poly', rows: 4, cols: 4, position: 1, color: null });
    const { store, commands } = setup(bank);
    commands.reorderPages('pg2', 0);
    expect(pagesSorted(store.bank!).map((p) => p.id)).toEqual(['pg2', 'pg']);
  });
});

describe('grille — invariant de réduction', () => {
  it('setPageGrid accepte un agrandissement et une réduction sûre', () => {
    const bank = makeBank();
    bank.pads = [pad('a', 'pg', 0)];
    const { store, commands } = setup(bank);
    commands.setPageGrid('pg', 2, 2);
    expect(findPage(store.bank!, 'pg')).toMatchObject({ rows: 2, cols: 2 });
  });

  it('setPageGrid refuse une réduction qui orphelinerait un pad', () => {
    const bank = makeBank();
    bank.pads = [pad('a', 'pg', 15)]; // occupe la dernière case d'une 4×4
    const { store, commands } = setup(bank);
    commands.setPageGrid('pg', 2, 2); // capacité 4 → refus
    expect(findPage(store.bank!, 'pg')).toMatchObject({ rows: 4, cols: 4 });
  });

  it('setPageGrid refuse hors bornes', () => {
    const { store, commands } = setup();
    commands.setPageGrid('pg', 99, 99);
    expect(findPage(store.bank!, 'pg')).toMatchObject({ rows: 4, cols: 4 });
  });
});

describe('mode édition', () => {
  it('toggleEditMode quittant l’édition vide la sélection', () => {
    const { store, commands } = setup();
    store.selectedPadId = 'x';
    store.editMode = true;
    commands.toggleEditMode(); // → false
    expect(store.editMode).toBe(false);
    expect(store.selectedPadId).toBeNull();
  });
});
