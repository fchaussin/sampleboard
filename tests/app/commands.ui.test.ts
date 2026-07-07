// SPDX-License-Identifier: GPL-3.0-or-later
// Tests des commandes d'UI M6 (§11) : tiroir contextuel (pad/page/réglages), panneau
// bibliothèque, Stop général. Store & moteur factices.
import { describe, it, expect } from 'vitest';
import { createCommands } from '../../src/app/commands';
import { BankFactory } from '../../src/app/bank-factory';
import type { Route, ViewId } from '../../src/app/navigation';
import { createLoopbackRouter, type Router } from '../../src/app/router';
import type { AppStore } from '../../src/app/store.svelte';
import type { Bank } from '../../src/domain/types';
import { fakeSampleRepository, fakeTagRepository } from './fake-sample-repository';
import { asEngine, fakeEngine } from './fake-engine';

function makeBank(): Bank {
  return {
    id: 'b',
    name: 'b',
    pages: [{ id: 'pg', name: 'P', voiceMode: 'poly', rows: 4, cols: 4, position: 0, color: null }],
    pads: [
      { id: 'pad', pageId: 'pg', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 0, color: null, cueStart: null, cueEnd: null },
    ],
  };
}

function fakeStore(bank: Bank | null = makeBank(), editMode = true): AppStore {
  const store = {
    bank,
    samples: [],
    settings: { backgroundBehavior: 'stopAll', maxVoices: 8, locale: 'fr' },
    activePageId: bank?.pages[0]?.id ?? null,
    editMode,
    selectedPadId: null as string | null,
    drawer: null as string | null,
    view: 'board' as ViewId,
    get libraryOpen() {
      return this.view === 'library';
    },
    tags: [],
    sampleTags: new Map<string, Set<string>>(),
    libraryFilter: null,
    assigningSampleId: null,
    poolSampleIds: [],
    poolOpen: false,
    activePadIds: new Set<string>(),
    get activePage() {
      return this.bank?.pages.find((p) => p.id === this.activePageId) ?? null;
    },
  };
  return store as unknown as AppStore;
}

function setup(store = fakeStore()) {
  const engine = fakeEngine();
  let n = 0;
  const commands = createCommands({
    store,
    engine: asEngine(engine),
    encode: async () => new Uint8Array(),
    sampleRepository: fakeSampleRepository(),
    tagRepository: fakeTagRepository(),
    ids: () => `id-${n++}`,
  });
  return { store, engine, commands };
}

describe('tiroir pad (Édition seulement, §11)', () => {
  it('openPadDrawer sélectionne le pad et ouvre le tiroir', () => {
    const { store, commands } = setup();
    commands.openPadDrawer('pad');
    expect(store.selectedPadId).toBe('pad');
    expect(store.drawer).toBe('pad');
  });

  it('refuse en mode Jeu (un tap joue, il ne configure pas)', () => {
    const { store, commands } = setup(fakeStore(makeBank(), false));
    commands.openPadDrawer('pad');
    expect(store.drawer).toBeNull();
    expect(store.selectedPadId).toBeNull();
  });

  it('ignore un pad inconnu', () => {
    const { store, commands } = setup();
    commands.openPadDrawer('fantome');
    expect(store.drawer).toBeNull();
  });

  it('addPad enchaîne sur la configuration : tiroir pad ouvert', () => {
    const { store, commands } = setup();
    commands.addPad('pg');
    expect(store.selectedPadId).toBe('id-0');
    expect(store.drawer).toBe('pad');
  });

  it('deletePad du pad sélectionné referme son tiroir', () => {
    const { store, commands } = setup();
    commands.openPadDrawer('pad');
    commands.deletePad('pad');
    expect(store.selectedPadId).toBeNull();
    expect(store.drawer).toBeNull();
  });
});

describe('tiroirs page & réglages', () => {
  it('openPageDrawer ouvre le tiroir sur la page active', () => {
    const { store, commands } = setup();
    commands.openPageDrawer();
    expect(store.drawer).toBe('page');
  });

  it('openPageDrawer sans page active : no-op', () => {
    const { store, commands } = setup(fakeStore(null));
    commands.openPageDrawer();
    expect(store.drawer).toBeNull();
  });

  it('openSettingsDrawer ouvre les réglages généraux (dans les deux modes)', () => {
    const { store, commands } = setup(fakeStore(makeBank(), false));
    commands.openSettingsDrawer();
    expect(store.drawer).toBe('settings');
  });

  it('closeDrawer referme et désélectionne le pad le cas échéant', () => {
    const { store, commands } = setup();
    commands.openPadDrawer('pad');
    commands.closeDrawer();
    expect(store.drawer).toBeNull();
    expect(store.selectedPadId).toBeNull();
  });

  it('toggleEditMode referme le tiroir (le contexte change)', () => {
    const { store, commands } = setup();
    commands.openPageDrawer();
    commands.toggleEditMode();
    expect(store.drawer).toBeNull();
  });
});

describe('couleurs de palette (M6)', () => {
  it('setPadColor pose et retire un token valide', () => {
    const { store, commands } = setup();
    commands.setPadColor('pad', 'teal');
    expect(store.bank!.pads[0]!.color).toBe('teal');
    commands.setPadColor('pad', null);
    expect(store.bank!.pads[0]!.color).toBeNull();
  });

  it('setPadColor refuse un token hors palette', () => {
    const { store, commands } = setup();
    commands.setPadColor('pad', 'fuchsia-disco' as never);
    expect(store.bank!.pads[0]!.color).toBeNull(); // inchangé
  });

  it('setPageColor pose un token sur la page', () => {
    const { store, commands } = setup();
    commands.setPageColor('pg', 'violet');
    expect(store.bank!.pages[0]!.color).toBe('violet');
  });
});

describe('création par la fabrique (M6 — board complet, coloré, nommé)', () => {
  function setupWithFactory() {
    const store = fakeStore();
    const engine = fakeEngine();
    let n = 0;
    const ids = (): string => `id-${n++}`;
    const commands = createCommands({
      store,
      engine: asEngine(engine),
      encode: async () => new Uint8Array(),
      sampleRepository: fakeSampleRepository(),
    tagRepository: fakeTagRepository(),
      ids,
      factory: new BankFactory({ ids, pageName: (rank) => `Page ${rank}` }),
    });
    return { store, commands };
  }

  it('addPage crée une page nommée, colorée, à la grille COMPLÈTE — et ouvre son tiroir', () => {
    const { store, commands } = setupWithFactory();
    commands.addPage();
    const page = store.bank!.pages.find((p) => p.id === 'id-0')!;
    expect(page.name).toBe('Page 2');
    expect(page.color).not.toBeNull();
    expect(store.activePageId).toBe(page.id);
    expect(store.drawer).toBe('page'); // création → configuration dans la foulée
    const pads = store.bank!.pads.filter((p) => p.pageId === page.id);
    expect(pads).toHaveLength(16); // 4×4 : une case = un pad
    expect(pads.every((p) => p.color !== null)).toBe(true);
    expect(pads.map((p) => p.position).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => i),
    );
  });

  it('setPageGrid en agrandissement remplit les nouvelles cases de pads colorés', () => {
    const { store, commands } = setupWithFactory();
    commands.setPageGrid('pg', 4, 5); // 16 → 20 cases, 1 pad existant en 0
    const pads = store.bank!.pads.filter((p) => p.pageId === 'pg');
    expect(pads).toHaveLength(20);
    expect(pads.every((p) => p.color !== null || p.id === 'pad')).toBe(true);
  });

  it('addPad crée un pad coloré par sa position', () => {
    const { store, commands } = setupWithFactory();
    commands.addPad('pg', 3);
    const pad = store.bank!.pads.find((p) => p.position === 3)!;
    expect(pad.color).not.toBeNull();
  });

  it('assignSample nomme un pad SANS nom d’après le label du sample (rogné)', () => {
    const store = fakeStore();
    (store.samples as unknown[]).push({
      id: 's1',
      label: 'explosion-de-fin-du-monde.mp3',
      fileName: 's1.ogg',
      originalName: 'x',
      mime: 'audio/ogg',
      sizeBytes: 1,
      durationMs: null,
      createdAt: 0,
    });
    const { commands } = setup(store);
    commands.assignSample('pad', 's1');
    expect(store.bank!.pads[0]!.name).toBe('explosion-de-fin-du-monde');
  });

  it('assignSample n’écrase jamais un nom choisi par l’utilisateur', () => {
    const store = fakeStore();
    store.bank!.pads[0]!.name = 'Mon pad';
    (store.samples as unknown[]).push({
      id: 's1',
      label: 'kick.wav',
      fileName: 's1.ogg',
      originalName: 'x',
      mime: 'audio/ogg',
      sizeBytes: 1,
      durationMs: null,
      createdAt: 0,
    });
    const { commands } = setup(store);
    commands.assignSample('pad', 's1');
    expect(store.bank!.pads[0]!.name).toBe('Mon pad');
  });
});

describe('panneau bibliothèque & Stop général', () => {
  it('openLibrary ouvre le panneau et referme le tiroir (une surcouche à la fois)', () => {
    const { store, commands } = setup();
    commands.openPageDrawer();
    commands.openLibrary();
    expect(store.libraryOpen).toBe(true);
    expect(store.drawer).toBeNull();
  });

  it('closeLibrary referme le panneau', () => {
    const { store, commands } = setup();
    commands.openLibrary();
    commands.closeLibrary();
    expect(store.libraryOpen).toBe(false);
  });

  it("la navigation passe par l'URL (#23) : openLibrary pousse la route avec le filtre courant", () => {
    const store = fakeStore();
    store.libraryFilter = 't9';
    const pushed: Route[] = [];
    const inner = createLoopbackRouter();
    const router: Router = {
      start: (fn) => inner.start(fn),
      push: (route) => {
        pushed.push(route);
        inner.push(route);
      },
      replace: (route) => inner.replace(route),
      pop: (fallback) => inner.pop(fallback),
    };
    const commands = createCommands({
      store,
      engine: asEngine(fakeEngine()),
      encode: async () => new Uint8Array(),
      sampleRepository: fakeSampleRepository(),
      tagRepository: fakeTagRepository(),
      router,
    });
    commands.openLibrary();
    expect(pushed).toEqual([{ view: 'library', filter: 't9' }]);
    expect(store.view).toBe('library'); // matérialisée par applyRoute, pas par openLibrary
  });

  it('applyRoute matérialise la vue ET le paramètre de filtre (URL → store)', () => {
    const { store, commands } = setup();
    commands.applyRoute({ view: 'library', filter: 'untagged' });
    expect(store.view).toBe('library');
    expect(store.libraryFilter).toBe('untagged');
    commands.applyRoute({ view: 'board' });
    expect(store.view).toBe('board');
    expect(store.libraryFilter).toBe('untagged'); // mémoire de travail conservée hors bibliothèque
  });

  it('stopAllVoices délègue au moteur (panique)', () => {
    const { engine, commands } = setup();
    commands.stopAllVoices();
    expect(engine.stopAll).toHaveBeenCalledOnce();
  });
});
