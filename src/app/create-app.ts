// SPDX-License-Identifier: GPL-3.0-or-later
// Composition root — injection de dépendances explicite (voir specifications.md §4, §5).
// Pas de singletons importés à la volée : tout est construit et câblé ici.
import { AudioEngine } from '../engine/audio-engine';
import { createBankRepository } from '../storage/bank-repository';
import { createSampleRepository } from '../storage/sample-repository';
import { createSettingsRepository } from '../storage/settings-repository';
import { createStore, type AppStore } from './store.svelte';
import { createCommands, type Commands } from './commands';
import { createPersistence, type Persistence } from './persistence';
import { createSeedBank, createSeedSamples } from './dev-seed';

export interface App {
  store: AppStore;
  commands: Commands;
  engine: AudioEngine;
  persistence: Persistence;
}

/** Construit et câble le graphe d'objets de l'application. */
export function createApp(): App {
  const store = createStore();

  // Plafond de voix lu dynamiquement depuis les réglages (FIFO interne, voir §7).
  const engine = new AudioEngine({ getMaxVoices: () => store.settings.maxVoices });

  const bankRepository = createBankRepository();
  const sampleRepository = createSampleRepository();
  const settingsRepository = createSettingsRepository();

  const commands = createCommands({ store, engine });
  const persistence = createPersistence({ store, bankRepository, settingsRepository });

  // Reflet minimal des voix actives : l'engine notifie, le store reflète (décision B).
  engine.onPlayingChanged((activePadIds) => {
    store.activePadIds = activePadIds;
  });

  // TEMP(M2/M3) : bibliothèque + banque de départ (hydratation SQLite au M5).
  commands.hydrateLibrary(createSeedSamples());
  commands.hydrateBank(createSeedBank());

  // sampleRepository sera injecté aux commandes d'import au jalon M4.
  void sampleRepository;

  return { store, commands, engine, persistence };
}
