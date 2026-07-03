// SPDX-License-Identifier: GPL-3.0-or-later
// Tests des commandes de réglages M5 : bornes, hydratation, et application du réglage
// Arrière-plan au cycle de vie (§12). Store & moteur factices.
import { describe, it, expect } from 'vitest';
import { createCommands } from '../../src/app/commands';
import type { AppStore } from '../../src/app/store.svelte';
import type { Settings } from '../../src/domain/types';
import { fakeSampleRepository, fakeTagRepository } from './fake-sample-repository';
import { asEngine, fakeEngine } from './fake-engine';

function fakeStore(settings: Partial<Settings> = {}): AppStore {
  return {
    bank: null,
    samples: [],
    settings: { backgroundBehavior: 'stopAll', maxVoices: 8, locale: 'fr', ...settings },
    activePageId: null,
    editMode: false,
    selectedPadId: null,
    tags: [],
    sampleTags: new Map<string, Set<string>>(),
    libraryFilter: null,
    previewingSampleId: null,
    assigningSampleId: null,
    poolSampleIds: [],
    poolOpen: false,
    activePadIds: new Set<string>(),
  } as unknown as AppStore;
}

function setup(settings: Partial<Settings> = {}) {
  const store = fakeStore(settings);
  const engine = fakeEngine();
  const commands = createCommands({
    store,
    engine: asEngine(engine),
    encode: async () => new Uint8Array(),
    sampleRepository: fakeSampleRepository(),
    tagRepository: fakeTagRepository(),
  });
  return { store, engine, commands };
}

describe('commandes de réglages', () => {
  it('setBackgroundBehavior remplace le réglage', () => {
    const { store, commands } = setup();
    commands.setBackgroundBehavior('keepPlaying');
    expect(store.settings.backgroundBehavior).toBe('keepPlaying');
  });

  it('setMaxVoices tronque à l’entier et borne à ≥ 1', () => {
    const { store, commands } = setup();
    commands.setMaxVoices(12.7);
    expect(store.settings.maxVoices).toBe(12);
    commands.setMaxVoices(0);
    expect(store.settings.maxVoices).toBe(1);
    commands.setMaxVoices(-3);
    expect(store.settings.maxVoices).toBe(1);
  });

  it('setMaxVoices ignore une valeur non finie', () => {
    const { store, commands } = setup();
    commands.setMaxVoices(Number.NaN);
    expect(store.settings.maxVoices).toBe(8);
  });

  it('setLocale change la langue sans toucher au reste', () => {
    const { store, commands } = setup({ maxVoices: 4 });
    commands.setLocale('en');
    expect(store.settings).toEqual({ backgroundBehavior: 'stopAll', maxVoices: 4, locale: 'en' });
  });

  it('hydrateSettings remplace les réglages par une copie', () => {
    const { store, commands } = setup();
    const incoming: Settings = { backgroundBehavior: 'stopSustained', maxVoices: 3, locale: 'en' };
    commands.hydrateSettings(incoming);
    expect(store.settings).toEqual(incoming);
    expect(store.settings).not.toBe(incoming);
  });
});

describe('applyBackgroundBehavior (§12)', () => {
  it("'stopAll' : arrête tout et suspend l'AudioContext", () => {
    const { engine, commands } = setup({ backgroundBehavior: 'stopAll' });
    commands.applyBackgroundBehavior(true);
    expect(engine.stopAll).toHaveBeenCalledOnce();
    expect(engine.suspend).toHaveBeenCalledOnce();
  });

  it("'stopSustained' : arrête Gate/Loop seulement, sans suspendre", () => {
    const { engine, commands } = setup({ backgroundBehavior: 'stopSustained' });
    commands.applyBackgroundBehavior(true);
    expect(engine.stopSustained).toHaveBeenCalledOnce();
    expect(engine.stopAll).not.toHaveBeenCalled();
    expect(engine.suspend).not.toHaveBeenCalled();
  });

  it("'keepPlaying' : laisse jouer", () => {
    const { engine, commands } = setup({ backgroundBehavior: 'keepPlaying' });
    commands.applyBackgroundBehavior(true);
    expect(engine.stopAll).not.toHaveBeenCalled();
    expect(engine.stopSustained).not.toHaveBeenCalled();
    expect(engine.suspend).not.toHaveBeenCalled();
  });

  it('masquage : la pré-écoute stoppe QUEL QUE SOIT le réglage (son de parcours, pas de jeu — §16)', () => {
    for (const backgroundBehavior of ['stopAll', 'stopSustained', 'keepPlaying'] as const) {
      const { store, commands } = setup({ backgroundBehavior });
      commands.previewSample('s1');
      expect(store.previewingSampleId).toBe('s1');
      commands.applyBackgroundBehavior(true);
      expect(store.previewingSampleId, `réglage ${backgroundBehavior}`).toBeNull();
    }
  });

  it('retour au premier plan : aucun effet (resume() attend le prochain geste, §12)', () => {
    const { engine, commands } = setup({ backgroundBehavior: 'stopAll' });
    commands.applyBackgroundBehavior(false);
    expect(engine.stopAll).not.toHaveBeenCalled();
    expect(engine.suspend).not.toHaveBeenCalled();
    expect(engine.resume).not.toHaveBeenCalled();
  });
});
