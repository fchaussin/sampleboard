// SPDX-License-Identifier: GPL-3.0-or-later
// Tests des commandes d'UI M6 (§11) : tiroir contextuel (pad/page/réglages), panneau
// bibliothèque, Stop général. Store & moteur factices.
import { describe, it, expect, vi } from 'vitest';
import { createCommands } from '../../src/app/commands';
import type { AppStore } from '../../src/app/store.svelte';
import type { AudioEngine } from '../../src/engine/audio-engine';
import type { Bank } from '../../src/domain/types';
import { fakeSampleRepository } from './fake-sample-repository';

function makeBank(): Bank {
  return {
    id: 'b',
    name: 'b',
    pages: [{ id: 'pg', name: 'P', voiceMode: 'poly', rows: 4, cols: 4, position: 0 }],
    pads: [
      { id: 'pad', pageId: 'pg', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 0 },
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
    libraryOpen: false,
    activePadIds: new Set<string>(),
    get activePage() {
      return this.bank?.pages.find((p) => p.id === this.activePageId) ?? null;
    },
  };
  return store as unknown as AppStore;
}

function fakeEngine() {
  return {
    resume: vi.fn().mockResolvedValue(undefined),
    stopAll: vi.fn(),
    stopPad: vi.fn(),
    stopPage: vi.fn(),
  };
}

function setup(store = fakeStore()) {
  const engine = fakeEngine();
  let n = 0;
  const commands = createCommands({
    store,
    engine: engine as unknown as AudioEngine,
    encode: async () => new Uint8Array(),
    sampleRepository: fakeSampleRepository(),
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

  it('stopAllVoices délègue au moteur (panique)', () => {
    const { engine, commands } = setup();
    commands.stopAllVoices();
    expect(engine.stopAll).toHaveBeenCalledOnce();
  });
});
