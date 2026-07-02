// SPDX-License-Identifier: GPL-3.0-or-later
// Tests de la couche commandes : résolution pad/page + délégation au moteur (voir §9).
// Store et moteur factices (pas de runes Svelte ni de Web Audio ici).
import { describe, it, expect, vi } from 'vitest';
import { createCommands } from '../../src/app/commands';
import type { AppStore } from '../../src/app/store.svelte';
import type { AudioEngine } from '../../src/engine/audio-engine';
import type { Bank } from '../../src/domain/types';
import { fakeSampleRepository } from './fake-sample-repository';

function bank(): Bank {
  return {
    id: 'b',
    name: 'b',
    pages: [
      { id: 'p1', name: 'P1', voiceMode: 'poly', rows: 4, cols: 4, position: 1 },
      { id: 'p0', name: 'P0', voiceMode: 'poly', rows: 4, cols: 4, position: 0 },
    ],
    pads: [
      { id: 'pad-x', pageId: 'p0', name: 'x', sampleId: 's', playMode: 'oneShot', gainDb: 0, position: 0 },
    ],
  };
}

function fakeStore(b: Bank | null = null): AppStore {
  return {
    bank: b,
    samples: [],
    settings: { backgroundBehavior: 'stopAll', maxVoices: 8, locale: 'fr' },
    activePageId: null,
    editMode: false,
    selectedPadId: null,
    activePadIds: new Set<string>(),
  } as unknown as AppStore;
}

function fakeEngine() {
  return {
    resume: vi.fn().mockResolvedValue(undefined),
    oneShot: vi.fn(),
    press: vi.fn(),
    release: vi.fn(),
    toggleLoop: vi.fn(),
    stopPad: vi.fn(),
    stopPage: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
  };
}

function setup(b: Bank | null = null) {
  const store = fakeStore(b);
  const engine = fakeEngine();
  const commands = createCommands({
    store,
    engine: engine as unknown as AudioEngine,
    encode: async () => new Uint8Array(),
    sampleRepository: fakeSampleRepository(),
  });
  return { store, engine, commands };
}

describe('hydrateBank / navigation', () => {
  it('hydrate la banque et sélectionne la première page (par position)', () => {
    const { store, commands } = setup();
    commands.hydrateBank(bank());
    expect(store.bank?.id).toBe('b');
    expect(store.activePageId).toBe('p0');
  });

  it('setActivePage change la page si elle existe, ignore sinon', () => {
    const { store, commands } = setup(bank());
    commands.setActivePage('p1');
    expect(store.activePageId).toBe('p1');
    commands.setActivePage('inconnue');
    expect(store.activePageId).toBe('p1');
  });
});

describe('commandes de jeu', () => {
  it('firePad résout pad+page et appelle engine.oneShot (+ resume)', () => {
    const b = bank();
    const { engine, commands } = setup(b);
    commands.firePad('pad-x');
    expect(engine.resume).toHaveBeenCalled();
    expect(engine.oneShot).toHaveBeenCalledWith(
      b.pads[0],
      b.pages.find((p) => p.id === 'p0'),
    );
  });

  it('firePad est un no-op si le pad est introuvable', () => {
    const { engine, commands } = setup(bank());
    commands.firePad('absent');
    expect(engine.oneShot).not.toHaveBeenCalled();
  });

  it('firePad est un no-op si aucune banque', () => {
    const { engine, commands } = setup(null);
    commands.firePad('pad-x');
    expect(engine.oneShot).not.toHaveBeenCalled();
  });

  it('press/release/toggleLoop/stopPad/stopPage délèguent au moteur', () => {
    const { engine, commands } = setup(bank());
    commands.pressPad('pad-x');
    commands.releasePad('pad-x');
    commands.toggleLoopPad('pad-x');
    commands.stopPad('pad-x');
    commands.stopPage('p0');
    expect(engine.press).toHaveBeenCalledOnce();
    expect(engine.release).toHaveBeenCalledWith('pad-x');
    expect(engine.toggleLoop).toHaveBeenCalledOnce();
    expect(engine.stopPad).toHaveBeenCalledWith('pad-x');
    expect(engine.stopPage).toHaveBeenCalledWith('p0');
  });
});

describe('toggleEditMode', () => {
  it('bascule le mode édition', () => {
    const { store, commands } = setup();
    expect(store.editMode).toBe(false);
    commands.toggleEditMode();
    expect(store.editMode).toBe(true);
  });
});
