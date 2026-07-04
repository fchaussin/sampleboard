// SPDX-License-Identifier: GPL-3.0-or-later
// Composition root — injection de dépendances explicite (voir specifications.md §4, §5).
// Pas de singletons importés à la volée : tout est construit, câblé et hydraté ici.
import { isTauri } from '@tauri-apps/api/core';
import { createArchiveExtractor } from '../engine/archive';
import { AudioEngine } from '../engine/audio-engine';
import { createOpusEncoder } from '../engine/encoder';
import { createWriteLock, openDatabase } from '../storage/db';
import { createBankRepository } from '../storage/bank-repository';
import { createSampleRepository } from '../storage/sample-repository';
import { createSettingsRepository } from '../storage/settings-repository';
import { createTagRepository } from '../storage/tag-repository';
import { createMemoryRepositories, type Repositories } from '../storage/memory';
import { createStore, type AppStore } from './store.svelte';
import { createCommands, type Commands } from './commands';
import { createHashRouter } from './router';
import { createPersistence, type Persistence } from './persistence';
import { createRunesWatch } from './watch.svelte';
import { BankFactory } from './bank-factory';
import { seedFactoryContent } from './factory-seed';

export interface App {
  store: AppStore;
  commands: Commands;
  engine: AudioEngine;
  persistence: Persistence;
}

/**
 * Libellés par défaut injectés par le bootstrap (main.ts) : les couches app/domaine ne
 * peuvent pas importer ui/i18n (règle de dépendance §4), mais les noms par défaut des
 * pages sont des DONNÉES utilisateur localisées à la création.
 */
export interface CreateAppOptions {
  /** Nom localisé de la page de rang n (1-based) : « Principal », « Page 2 »… */
  pageName?: (rank: number) => string;
  /**
   * Tags semés au premier lancement (M8) — personnalisables ensuite. Le `token` est la clé
   * STABLE référencée par le manifest des samples d'usine (#14), le `label` est localisé.
   */
  defaultTags?: Array<{ token: string; label: string }>;
}

/**
 * Dépôts selon le runtime : SQLite natif + fichiers sous Tauri (la cible),
 * en mémoire dans le navigateur nu (:1420 en dev — session seulement, voir storage/memory.ts).
 */
async function createRepositories(): Promise<Repositories> {
  if (!isTauri()) return createMemoryRepositories();
  // Import dynamique : le module des plugins Tauri n'est chargé que dans la WebView native.
  const { createTauriSqlExecutor, createTauriAudioFileStore } = await import('../storage/tauri');
  const db = await createTauriSqlExecutor();
  await openDatabase(db);
  // Verrou d'écriture PARTAGÉ : les écritures des trois dépôts s'enchaînent sans
  // s'entrelacer — le pool du plugin reste sur une connexion, transactions sûres (voir db.ts).
  const lock = createWriteLock();
  return {
    bankRepository: createBankRepository(db, lock),
    sampleRepository: createSampleRepository({ db, files: createTauriAudioFileStore(), lock }),
    settingsRepository: createSettingsRepository(db, lock),
    tagRepository: createTagRepository(db, lock),
  };
}

/** Construit et câble le graphe d'objets de l'application, puis hydrate depuis la persistance. */
export async function createApp(options: CreateAppOptions = {}): Promise<App> {
  const store = createStore();

  // Plafond de voix lu dynamiquement depuis les réglages (FIFO interne, voir §7).
  const engine = new AudioEngine({ getMaxVoices: () => store.settings.maxVoices });

  const { bankRepository, sampleRepository, settingsRepository, tagRepository } =
    await createRepositories();

  const factory = new BankFactory({ pageName: options.pageName });
  const commands = createCommands({
    store,
    engine,
    encode: createOpusEncoder(),
    sampleRepository,
    tagRepository,
    extractArchive: createArchiveExtractor(),
    factory,
    // L'URL est la source de vérité de la vue (#23) : fragment + historique délibéré.
    router: createHashRouter(window),
  });
  const persistence = createPersistence({
    store,
    bankRepository,
    settingsRepository,
    watch: createRunesWatch(),
  });

  // Reflet minimal des voix actives : l'engine notifie, le store reflète (décision B).
  engine.onPlayingChanged((activePadIds) => {
    store.activePadIds = activePadIds;
  });

  // --- Hydratation (M5) : réglages → bibliothèque (+ buffers audio) → banque. -----------------
  commands.hydrateSettings(await settingsRepository.load());

  const samples = await sampleRepository.list();
  commands.hydrateLibrary(samples);
  await Promise.all(
    samples.map(async (sample) => {
      try {
        const data = await sampleRepository.readBytes(sample.fileName);
        await engine.load(sample.id, data.slice().buffer as ArrayBuffer);
      } catch (err) {
        // Fichier disparu hors app (§12) : le pad joue un no-op silencieux, pas de crash.
        console.warn(`bibliothèque: octets audio illisibles (${sample.fileName})`, err);
      }
    }),
  );

  commands.hydrateTags(await tagRepository.list(), await tagRepository.assignments());

  let bank = await bankRepository.load();
  const firstLaunch = bank === null;
  if (!bank) {
    bank = factory.createBank(); // board complet : page « Principal », grille remplie, colorée
    await bankRepository.save(bank); // ids stables dès le premier lancement
    // Semis des tags par défaut (M8) — UNIQUEMENT au premier lancement : une liste vidée
    // par l'utilisateur ne doit jamais repousser.
    for (const tag of options.defaultTags ?? []) commands.createTag(tag.label);
  }
  commands.hydrateBank(bank);

  // L'autosave ne démarre QU'après hydratation : l'état par défaut n'écrase jamais la base.
  persistence.start();

  // Semis d'usine (#14) — même garde « premier lancement » que banque et tags : supprimé
  // par l'utilisateur, un sample d'usine ne repousse JAMAIS. Non bloquant : l'app est
  // utilisable pendant que la bibliothèque se remplit (les mutations passent par commands,
  // l'autosave déjà démarré persiste le board pré-assigné).
  if (firstLaunch) {
    const tagIdByToken = new Map<string, string>();
    for (const tag of options.defaultTags ?? []) {
      const created = store.tags.find((t) => t.label === tag.label);
      if (created) tagIdByToken.set(tag.token, created.id);
    }
    void seedFactoryContent({
      commands,
      store,
      tagIdByToken,
      fetchBytes: async (path) => {
        try {
          const response = await fetch(`/${path}`);
          return response.ok ? await response.arrayBuffer() : null;
        } catch {
          return null;
        }
      },
    }).catch((err) => console.warn('semis d’usine : échec', err));
  }

  // Cycle de vie : réglage Arrière-plan (§12) + écriture du débounce en cours avant le gel.
  document.addEventListener('visibilitychange', () => {
    const hidden = document.visibilityState === 'hidden';
    commands.applyBackgroundBehavior(hidden);
    if (hidden) void persistence.flush();
  });

  return { store, commands, engine, persistence };
}
