// SPDX-License-Identifier: GPL-3.0-or-later
// Couche de commandes — SEUL point de mutation du store (voir specifications.md §9).
// Coordonne store + engine de façon atomique. L'UI n'émet que des intentions.
import type { ArchiveExtractor } from '../engine/archive';
import type { AudioEngine } from '../engine/audio-engine';
import type { Encoder, PcmData } from '../engine/encoder';
import { pcmDuration, trimPcm } from '../engine/pcm';
import type { SampleRepository, TagRepository } from '../storage/types';
import type { Bank, Pad, Page, Sample, Settings, Tag } from '../domain/types';
import type { BackgroundBehavior, Color, PlayMode, VoiceMode } from '../domain/enums';
import { findPad, findPage, padsOfPage, pagesSorted, firstFreePosition } from '../domain/selectors';
import {
  ARCHIVE_MAX_BYTES,
  GAIN_DB_MAX,
  GAIN_DB_MIN,
  IMPORT_MAX_BYTES,
  defaultPadName,
  isArchiveFileName,
  isAudioFileName,
  gridCapacity,
  isValidColor,
  isValidCols,
  isValidRows,
  padsFitGrid,
} from '../domain/invariants';
import { newId } from '../domain/id';
import { BankFactory } from './bank-factory';
import { DEFAULT_ROUTE, type Route } from './navigation';
import { createLoopbackRouter, type Router } from './router';
import type { AppStore, BatchImportItem, LibraryFilter } from './store.svelte';

/** Motif d'échec d'un import ou d'un retravail (voir §12, §13, M7, M8). */
export type ImportError =
  | 'tooLarge'
  | 'undecodable'
  | 'encodeFailed'
  | 'writeFailed'
  | 'readFailed'
  | 'archiveFailed'
  | 'archiveEmpty';
export type ImportResult = { ok: true; sampleId: string } | { ok: false; reason: ImportError };

/** Fichier source d'un lot d'import (M8) — bytes null : lecture du fichier échouée en amont. */
export interface BatchSource {
  name: string;
  bytes: ArrayBuffer | null;
}

export interface CommandDeps {
  store: AppStore;
  engine: AudioEngine;
  /** Encodeur OGG/Opus (injectable pour les tests). */
  encode: Encoder;
  /** Dépôt bibliothèque : écritures immédiates, hors autosave débouncé (voir §9, décision A). */
  sampleRepository: SampleRepository;
  /** Dépôt des tags (M8) : écritures immédiates également. */
  tagRepository: TagRepository;
  /** Extracteur d'archives zip/rar (M8, injectable pour les tests). */
  extractArchive?: ArchiveExtractor;
  /** Générateur d'identifiants (injectable pour les tests). Défaut : `newId()`. */
  ids?: () => string;
  /** Horloge (injectable pour les tests). Défaut : `Date.now`. */
  now?: () => number;
  /** Fabrique des entités de la banque (défauts de création, §16). Partage `ids` par défaut. */
  factory?: BankFactory;
  /** Routeur (#23) — sync URL ↔ vue. Défaut : boucle locale (tests, hors navigateur). */
  router?: Router;
}

export interface Commands {
  // UI globale
  toggleEditMode(): void;
  resumeAudio(): Promise<void>;
  /** Stop général (panique bottombar) : arrête toutes les voix (§11). */
  stopAllVoices(): void;

  // Tiroir contextuel & panneau bibliothèque (§11)
  openPadDrawer(padId: string): void;
  openPageDrawer(): void;
  openSettingsDrawer(): void;
  /** Gestion des tags dans le tiroir droit (#20) — ouvert depuis l'en-tête de la bibliothèque. */
  openTagsDrawer(): void;
  closeDrawer(): void;
  openLibrary(): void;
  closeLibrary(): void;
  /** Applique une route résolue depuis l'URL (routeur) — SEUL écrivain de `store.view` (#23). */
  applyRoute(route: Route): void;

  // Réglages (§9)
  setLocale(locale: string): void;
  setBackgroundBehavior(backgroundBehavior: BackgroundBehavior): void;
  setMaxVoices(maxVoices: number): void;
  /** Applique le réglage Arrière-plan au passage caché/visible de l'app (§12). */
  applyBackgroundBehavior(hidden: boolean): void;

  // Hydratation au démarrage (M5)
  hydrateBank(bank: Bank): void;
  hydrateLibrary(samples: Sample[]): void;
  hydrateSettings(settings: Settings): void;
  setActivePage(pageId: string): void;

  // Jeu (matrice §7)
  firePad(padId: string): void;
  pressPad(padId: string): void;
  releasePad(padId: string): void;
  toggleLoopPad(padId: string): void;
  stopPad(padId: string): void;
  stopPage(pageId: string): void;

  // Édition — sélection
  selectPad(padId: string | null): void;

  // Édition — pads
  addPad(pageId: string, position?: number): void;
  renamePad(padId: string, name: string): void;
  setPadPlayMode(padId: string, playMode: PlayMode): void;
  setPadGainDb(padId: string, gainDb: number): void;
  setPadColor(padId: string, color: Color | null): void;
  assignSample(padId: string, sampleId: string | null): void;
  deletePad(padId: string): void;
  reorderPads(padId: string, toPosition: number): void;

  // Édition — pages
  addPage(): void;
  renamePage(pageId: string, name: string): void;
  deletePage(pageId: string): void;
  setPageVoiceMode(pageId: string, voiceMode: VoiceMode): void;
  setPageGrid(pageId: string, rows: number, cols: number): void;
  setPageColor(pageId: string, color: Color | null): void;
  reorderPages(pageId: string, toIndex: number): void;

  // Bibliothèque (§8, §13)
  /** Pipeline d'import direct (plage complète) : taille → décodage → Opus → bibliothèque. */
  importSample(fileName: string, bytes: ArrayBuffer): Promise<ImportResult>;
  /**
   * Semis d'usine (#14) : OGG/Opus déjà encodé au dépôt — décodage (durée, jouabilité)
   * puis copie des octets SANS réencodage, libellé curaté fourni par le manifest.
   */
  seedFactorySample(fileName: string, label: string, bytes: ArrayBuffer): Promise<ImportResult>;

  // Import multiple (M8) : lot de fichiers et/ou archives, progression dans store.batchImport.
  /**
   * Ouvre la modale d'import (choix des fichiers) — POINT D'ENTRÉE UNIQUE de l'import.
   * `assignPadId` : pad à assigner à l'issue du flux (modale ouverte depuis le choix de sample).
   */
  openImport(assignPadId?: string | null): void;
  /** Referme la modale d'import (état choix des fichiers uniquement — pas un lot en cours). */
  closeImport(): void;
  /** Importe un lot en séquence ; les archives (zip/rar) sont dépliées en entrées audio. */
  importBatch(sources: BatchSource[], options?: { addToPool?: boolean }): Promise<void>;
  /** Interrompt le lot après l'élément en cours (les restants passent à « skipped »). */
  cancelBatchImport(): void;
  /** Referme la modale de progression (uniquement une fois le lot terminé). */
  closeBatchImport(): void;

  // Éditeur audio (M7, « découper », §16)
  /** Décode et ouvre l'éditeur (waveform + rognage). Renvoie le motif d'échec, ou null. */
  beginImport(
    fileName: string,
    bytes: ArrayBuffer,
    assignPadId?: string | null,
    addToPool?: boolean,
  ): Promise<ImportError | null>;
  /** Re-décode un sample de la bibliothèque et ouvre l'éditeur (retravail). */
  beginSampleRework(sampleId: string): Promise<ImportError | null>;
  /** Pré-écoute la sélection courante de l'éditeur. */
  previewEditorSelection(startS: number, endS: number): void;
  /** Rogne à la sélection puis encode : import → nouvelle entrée ; retravail → remplacement. */
  applyAudioEditor(startS: number, endS: number): Promise<ImportResult>;
  /** Referme l'éditeur sans rien appliquer. */
  cancelAudioEditor(): void;

  // Tags (M8, §16)
  hydrateTags(tags: Tag[], assignments: Map<string, Set<string>>): void;
  createTag(label: string): void;
  renameTag(tagId: string, label: string): void;
  /** Supprime le tag et toutes ses affectations ; réinitialise le filtre s'il le visait. */
  deleteTag(tagId: string): void;
  /** Affecte/retire un tag à un sample. */
  toggleSampleTag(sampleId: string, tagId: string): void;
  setLibraryFilter(filter: LibraryFilter): void;
  /** Arme un sample : les surcouches se ferment, chaque pad touché le reçoit (à la volée). */
  startAssigning(sampleId: string): void;
  /** Assigne le sample armé au pad touché (no-op hors mode assignation). */
  tapAssign(padId: string): void;
  /** Désarme le mode assignation. */
  stopAssigning(): void;

  // Pool (M8, revu #18) : liste de travail de samples (sidebar en Édition, tiroir en étroit).
  addToPool(sampleId: string): void;
  removeFromPool(sampleId: string): void;
  /** Vide le pool d'un coup (bouton « Vider »). */
  clearPool(): void;
  openPool(): void;
  closePool(): void;
  /** Pré-écoute d'un sample (bascule) : lance, ou stoppe si ce sample joue déjà. */
  previewSample(sampleId: string): void;
  /** Arrête la pré-écoute en cours — toute autre action de l'UI en fait autant. */
  stopPreview(): void;
  renameSample(sampleId: string, label: string): void;
  /** Supprime un sample ; les pads qui le référençaient deviennent *introuvables* (§12). */
  deleteSample(sampleId: string): void;
}

/**
 * RÈGLE MÉTIER (§16) : toute commande d'INTERACTION fait office de stop de pré-écoute.
 * La règle est appliquée MÉCANIQUEMENT en fin de createCommands (jamais de stopPreview
 * saupoudré dans les corps) et vérifiée par un test générique qui itère cette liste.
 * Toute nouvelle commande utilisateur doit y être ajoutée. Exclusions volontaires :
 * previewSample/stopPreview (gèrent eux-mêmes la bascule), tapAssign/stopAssigning
 * (suite du flux ouvert par startAssigning, qui a déjà stoppé), applyBackgroundBehavior
 * (stop conditionné au masquage, géré dans son corps), hydratations et pipelines d'import
 * (importSample, importBatch : non interactifs — le semis d'usine ne stoppe jamais une
 * pré-écoute en cours), applyRoute (#23 : sync URL → store, pas une intention — les
 * intentions de navigation closeLibrary/setLibraryFilter portent déjà la règle).
 */
export const PREVIEW_STOPPING_COMMANDS = [
  'stopAllVoices',
  'closeLibrary',
  'setLibraryFilter',
  'startAssigning',
  'addToPool',
  'removeFromPool',
  'clearPool',
  'openPool',
  'closePool',
  'assignSample',
  'renameSample',
  'toggleSampleTag',
  'deleteSample',
  'createTag',
  'renameTag',
  'deleteTag',
  'openTagsDrawer',
  'openImport',
  'beginSampleRework',
  'previewEditorSelection',
  'applyAudioEditor',
  'cancelAudioEditor',
] as const satisfies readonly (keyof Commands)[];

export function createCommands({
  store,
  engine,
  encode,
  sampleRepository,
  tagRepository,
  extractArchive = async () => {
    throw new Error('archive extraction unavailable');
  },
  ids = () => newId(),
  now = () => Date.now(),
  factory = new BankFactory({ ids }),
  router = createLoopbackRouter(),
}: CommandDeps): Commands {
  function resolve(padId: string): { pad: Pad; page: Page } | null {
    const bank = store.bank;
    if (!bank) return null;
    const pad = findPad(bank, padId);
    if (!pad) return null;
    const page = findPage(bank, pad.pageId);
    if (!page) return null;
    return { pad, page };
  }

  /** Renumérote les pages 0..n-1 selon leur ordre courant (positions contiguës, §6). */
  function reindexPages(bank: Bank): void {
    pagesSorted(bank).forEach((p, i) => {
      p.position = i;
    });
  }

  /** Tags triés par libellé (ordre stable de l'UI). */
  function sortedTags(tags: readonly Tag[]): Tag[] {
    return [...tags].sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Arrête la pré-écoute en cours et efface son reflet. Appliquée mécaniquement à toutes
   * les commandes de PREVIEW_STOPPING_COMMANDS (voir la règle §16 documentée là-bas) ;
   * exposée telle quelle comme commande `stopPreview`.
   */
  function stopPreview(): void {
    engine.stopPreview();
    store.previewingSampleId = null;
  }

  /** Pose le filtre et, si la bibliothèque est la vue courante, reflète le paramètre d'URL. */
  function applyLibraryFilter(filter: LibraryFilter): void {
    store.libraryFilter = filter;
    if (store.view === 'library') router.replace({ view: 'library', filter });
  }

  /** Ajoute un sample au pool (idempotent) — partagé commande directe / option d'import. */
  function addSampleToPool(sampleId: string): void {
    if (!store.samples.some((s) => s.id === sampleId)) return;
    if (store.poolSampleIds.includes(sampleId)) return;
    store.poolSampleIds = [...store.poolSampleIds, sampleId];
  }

  /** Rattache un sample (ou vide) à un pad ; nom par défaut si le pad n'en a pas (M6). */
  function assignSampleToPad(padId: string, sampleId: string | null): void {
    const pad = store.bank ? findPad(store.bank, padId) : undefined;
    if (!pad) return;
    if (sampleId === null) {
      pad.sampleId = null;
      return;
    }
    const sample = store.samples.find((s) => s.id === sampleId);
    if (!sample) return;
    pad.sampleId = sampleId;
    if (pad.name === '') pad.name = defaultPadName(sample.label);
  }

  /** Décode une source (après garde de taille) en PCM ; null si non décodable (§12). */
  async function decodeSource(bytes: ArrayBuffer): Promise<PcmData | null> {
    await engine.resume();
    try {
      const decoded = await engine.decode(bytes);
      return { channelData: decoded.channelData, sampleRate: decoded.sampleRate };
    } catch {
      return null;
    }
  }

  /**
   * Fin de pipeline d'import commune (§13) : encode le PCM en Opus, garde-fou de
   * re-décodage, écriture immédiate, entrée en bibliothèque, assignation éventuelle.
   */
  async function finishImport(
    fileName: string,
    pcm: PcmData,
    assignPadId: string | null,
  ): Promise<ImportResult> {
    let ogg: Uint8Array;
    try {
      ogg = await encode(pcm);
    } catch {
      return { ok: false, reason: 'encodeFailed' };
    }

    const id = ids();
    try {
      // Charge le RÉ-ENCODÉ : vérifie qu'il est décodable et le rend jouable/pré-écoutable.
      await engine.load(id, ogg.slice().buffer);
    } catch {
      return { ok: false, reason: 'encodeFailed' };
    }

    const sample: Sample = {
      id,
      label: fileName,
      fileName: `${id}.ogg`,
      originalName: fileName,
      mime: 'audio/ogg',
      sizeBytes: ogg.byteLength,
      durationMs: Math.round(pcmDuration(pcm) * 1000),
      createdAt: now(),
    };
    // Écriture immédiate, hors autosave débouncé (§9) : fichier {sampleId}.ogg + ligne samples.
    try {
      await sampleRepository.add(sample, ogg);
    } catch (err) {
      console.error('import: échec de l’écriture du sample', err);
      engine.unload(id);
      return { ok: false, reason: 'writeFailed' };
    }
    store.samples = [...store.samples, sample];
    if (assignPadId !== null) assignSampleToPad(assignPadId, id);
    return { ok: true, sampleId: id };
  }

  /** Pipeline d'import direct d'UNE source : taille → décodage → fin de pipeline (§13). */
  async function importSource(fileName: string, bytes: ArrayBuffer): Promise<ImportResult> {
    if (bytes.byteLength > IMPORT_MAX_BYTES) return { ok: false, reason: 'tooLarge' };
    const pcm = await decodeSource(bytes);
    if (!pcm) return { ok: false, reason: 'undecodable' }; // format non décodable (§12)
    return finishImport(fileName, pcm, null);
  }

  // --- Import multiple (M8) -------------------------------------------------------------------
  let batchCancelled = false;

  /** Publie l'état du lot EN BLOC ($state.raw) : items clonés, compteur réglé dérivé. */
  function publishBatch(items: BatchImportItem[], finished: boolean): void {
    store.batchImport = {
      items: items.map((item) => ({ ...item })),
      settled: items.filter((i) => i.status === 'done' || i.status === 'failed' || i.status === 'skipped').length,
      finished,
      cancelled: batchCancelled,
    };
  }

  /** Déplie une archive en entrées audio ; renvoie le motif d'échec, ou null. */
  async function expandArchive(
    job: { item: BatchImportItem; bytes: ArrayBuffer },
    items: BatchImportItem[],
    queue: { item: BatchImportItem; bytes: ArrayBuffer | null }[],
  ): Promise<ImportError | null> {
    if (job.bytes.byteLength > ARCHIVE_MAX_BYTES) return 'tooLarge';
    let entries;
    try {
      entries = await extractArchive(job.item.name, job.bytes);
    } catch (err) {
      console.error('import: échec de l’extraction de l’archive', err);
      return 'archiveFailed';
    }
    const audio = entries.filter((e) => isAudioFileName(e.name));
    if (audio.length === 0) return 'archiveEmpty';
    for (const entry of audio) {
      const item: BatchImportItem = { name: entry.name, status: 'pending', reason: null };
      items.push(item);
      queue.push({ item, bytes: entry.bytes });
    }
    return null;
  }

  const commands: Commands = {
    toggleEditMode(): void {
      store.editMode = !store.editMode;
      // Changer de mode referme le tiroir : son contexte (pad sélectionné…) n'a plus cours.
      store.drawer = null;
      if (!store.editMode) store.selectedPadId = null;
    },
    resumeAudio(): Promise<void> {
      return engine.resume();
    },
    stopAllVoices(): void {
      // Panique : voix des pads (la pré-écoute est stoppée par la règle §16, comme partout).
      engine.stopAll();
    },

    openPadDrawer(padId: string): void {
      // Édition seulement (§11) : en Jeu, un tap sur un pad joue.
      if (!store.editMode) return;
      if (!store.bank || !findPad(store.bank, padId)) return;
      store.selectedPadId = padId;
      store.drawer = 'pad';
    },
    openPageDrawer(): void {
      if (!store.activePage) return;
      store.drawer = 'page';
    },
    openSettingsDrawer(): void {
      store.drawer = 'settings';
    },
    openTagsDrawer(): void {
      store.drawer = 'tags';
    },
    closeDrawer(): void {
      if (store.drawer === 'pad') store.selectedPadId = null;
      store.drawer = null;
    },
    openLibrary(): void {
      store.drawer = null; // une seule surcouche à la fois
      // L'URL pilote (#23) : navigation réelle (entrée d'historique), applyRoute matérialisera.
      router.push({ view: 'library', filter: store.libraryFilter });
    },
    closeLibrary(): void {
      if (store.view !== 'library') return;
      router.pop(DEFAULT_ROUTE); // le bouton ✕ et le geste retour dépilent la même entrée
    },
    applyRoute(route: Route): void {
      store.view = route.view;
      if (route.view === 'library') store.libraryFilter = route.filter;
    },

    setLocale(locale: string): void {
      store.settings = { ...store.settings, locale };
    },
    setBackgroundBehavior(backgroundBehavior: BackgroundBehavior): void {
      store.settings = { ...store.settings, backgroundBehavior };
    },
    setMaxVoices(maxVoices: number): void {
      if (!Number.isFinite(maxVoices)) return;
      store.settings = { ...store.settings, maxVoices: Math.max(1, Math.trunc(maxVoices)) };
    },
    applyBackgroundBehavior(hidden: boolean): void {
      // Retour au premier plan : rien à faire ici — resume() repart au prochain geste (§12).
      if (!hidden) return;
      // La pré-écoute est un son transitoire de PARCOURS (pas une voix de jeu voulue) :
      // elle s'arrête au masquage quel que soit le réglage, y compris « Laisser jouer » (§16).
      stopPreview();
      switch (store.settings.backgroundBehavior) {
        case 'stopAll':
          engine.stopAll();
          void engine.suspend();
          break;
        case 'stopSustained':
          engine.stopSustained();
          break;
        case 'keepPlaying':
          break;
      }
    },

    hydrateBank(bank: Bank): void {
      store.bank = bank;
      store.activePageId = pagesSorted(bank)[0]?.id ?? null;
    },
    hydrateLibrary(samples: Sample[]): void {
      store.samples = samples;
    },
    hydrateSettings(settings: Settings): void {
      store.settings = { ...settings };
    },
    setActivePage(pageId: string): void {
      const bank = store.bank;
      if (!bank || !findPage(bank, pageId)) return;
      store.activePageId = pageId;
    },

    firePad(padId: string): void {
      const r = resolve(padId);
      if (!r) return;
      void engine.resume();
      engine.oneShot(r.pad, r.page);
    },
    pressPad(padId: string): void {
      const r = resolve(padId);
      if (!r) return;
      void engine.resume();
      engine.press(r.pad, r.page);
    },
    releasePad(padId: string): void {
      engine.release(padId);
    },
    toggleLoopPad(padId: string): void {
      const r = resolve(padId);
      if (!r) return;
      void engine.resume();
      engine.toggleLoop(r.pad, r.page);
    },
    stopPad(padId: string): void {
      engine.stopPad(padId);
    },
    stopPage(pageId: string): void {
      engine.stopPage(pageId);
    },

    selectPad(padId: string | null): void {
      if (padId !== null && (!store.bank || !findPad(store.bank, padId))) return;
      store.selectedPadId = padId;
    },

    addPad(pageId: string, position?: number): void {
      const bank = store.bank;
      if (!bank) return;
      const page = findPage(bank, pageId);
      if (!page) return;
      const pagePads = padsOfPage(bank, pageId);
      const capacity = gridCapacity(page);

      let pos: number | null;
      if (position === undefined) {
        pos = firstFreePosition(pagePads, capacity);
      } else {
        const occupied = pagePads.some((p) => p.position === position);
        pos = position >= 0 && position < capacity && !occupied ? position : null;
      }
      if (pos === null) return;

      const pad = factory.createPad(pageId, pos);
      bank.pads.push(pad);
      // Création (Édition) → on enchaîne sur la configuration : tiroir pad ouvert (§11).
      store.selectedPadId = pad.id;
      store.drawer = 'pad';
    },
    renamePad(padId: string, name: string): void {
      const pad = store.bank ? findPad(store.bank, padId) : undefined;
      if (pad) pad.name = name;
    },
    setPadPlayMode(padId: string, playMode: PlayMode): void {
      const pad = store.bank ? findPad(store.bank, padId) : undefined;
      if (pad) pad.playMode = playMode;
    },
    setPadGainDb(padId: string, gainDb: number): void {
      if (!Number.isFinite(gainDb)) return;
      const pad = store.bank ? findPad(store.bank, padId) : undefined;
      if (pad) pad.gainDb = Math.min(GAIN_DB_MAX, Math.max(GAIN_DB_MIN, gainDb));
    },
    setPadColor(padId: string, color: Color | null): void {
      if (color !== null && !isValidColor(color)) return;
      const pad = store.bank ? findPad(store.bank, padId) : undefined;
      if (pad) pad.color = color;
    },
    assignSample(padId: string, sampleId: string | null): void {
      assignSampleToPad(padId, sampleId);
    },
    deletePad(padId: string): void {
      const bank = store.bank;
      if (!bank) return;
      engine.stopPad(padId);
      bank.pads = bank.pads.filter((p) => p.id !== padId);
      if (store.selectedPadId === padId) {
        store.selectedPadId = null;
        if (store.drawer === 'pad') store.drawer = null; // son tiroir n'a plus d'objet
      }
    },
    reorderPads(padId: string, toPosition: number): void {
      const bank = store.bank;
      if (!bank) return;
      const pad = findPad(bank, padId);
      if (!pad) return;
      const page = findPage(bank, pad.pageId);
      if (!page) return;
      if (toPosition < 0 || toPosition >= gridCapacity(page)) return;
      const occupant = bank.pads.find(
        (p) => p.pageId === pad.pageId && p.position === toPosition && p.id !== pad.id,
      );
      if (occupant) occupant.position = pad.position; // échange
      pad.position = toPosition;
    },

    addPage(): void {
      const bank = store.bank;
      if (!bank) return;
      // Une page naît COMPLÈTE (§16) : nom « Page N », couleur de palette, grille remplie.
      const page = factory.createPage(bank.pages.length + 1);
      bank.pages.push(page);
      bank.pads.push(...factory.fillPagePads(page, []));
      store.activePageId = page.id;
      // Création → on enchaîne sur la configuration : tiroir page ouvert (§11).
      store.drawer = 'page';
    },
    renamePage(pageId: string, name: string): void {
      const page = store.bank ? findPage(store.bank, pageId) : undefined;
      if (page) page.name = name;
    },
    deletePage(pageId: string): void {
      const bank = store.bank;
      if (!bank || bank.pages.length <= 1 || !findPage(bank, pageId)) return; // ≥ 1 page (§6)
      engine.stopPage(pageId);
      bank.pages = bank.pages.filter((p) => p.id !== pageId);
      bank.pads = bank.pads.filter((p) => p.pageId !== pageId);
      reindexPages(bank);
      if (store.activePageId === pageId) store.activePageId = pagesSorted(bank)[0]?.id ?? null;
      if (store.selectedPadId && !findPad(bank, store.selectedPadId)) store.selectedPadId = null;
    },
    setPageVoiceMode(pageId: string, voiceMode: VoiceMode): void {
      const page = store.bank ? findPage(store.bank, pageId) : undefined;
      if (page) page.voiceMode = voiceMode;
    },
    setPageColor(pageId: string, color: Color | null): void {
      if (color !== null && !isValidColor(color)) return;
      const page = store.bank ? findPage(store.bank, pageId) : undefined;
      if (page) page.color = color;
    },
    setPageGrid(pageId: string, rows: number, cols: number): void {
      const bank = store.bank;
      if (!bank || !isValidRows(rows) || !isValidCols(cols)) return;
      const page = findPage(bank, pageId);
      if (!page) return;
      // Invariant de réduction : refuser si un pad tomberait hors grille (§6, §12).
      if (!padsFitGrid(padsOfPage(bank, pageId), { rows, cols })) return;
      page.rows = rows;
      page.cols = cols;
      // Board complet (§16) : toute case exposée par le redimensionnement reçoit son pad.
      bank.pads.push(...factory.fillPagePads(page, padsOfPage(bank, pageId)));
    },
    reorderPages(pageId: string, toIndex: number): void {
      const bank = store.bank;
      if (!bank) return;
      const sorted = pagesSorted(bank);
      const from = sorted.findIndex((p) => p.id === pageId);
      if (from < 0 || toIndex < 0 || toIndex >= sorted.length) return;
      const [moved] = sorted.splice(from, 1);
      if (!moved) return;
      sorted.splice(toIndex, 0, moved);
      sorted.forEach((p, i) => {
        p.position = i;
      });
    },

    async importSample(fileName: string, bytes: ArrayBuffer): Promise<ImportResult> {
      return importSource(fileName, bytes);
    },

    async seedFactorySample(fileName: string, label: string, bytes: ArrayBuffer): Promise<ImportResult> {
      // Copies systématiques : decodeAudioData détache le buffer qu'on lui passe.
      const pcm = await decodeSource(bytes.slice(0));
      if (!pcm) return { ok: false, reason: 'undecodable' };
      const id = ids();
      try {
        await engine.load(id, bytes.slice(0));
      } catch {
        return { ok: false, reason: 'undecodable' };
      }
      const sample: Sample = {
        id,
        label,
        fileName: `${id}.ogg`,
        originalName: fileName,
        mime: 'audio/ogg',
        sizeBytes: bytes.byteLength,
        durationMs: Math.round(pcmDuration(pcm) * 1000),
        createdAt: now(),
      };
      try {
        await sampleRepository.add(sample, new Uint8Array(bytes));
      } catch (err) {
        console.error('semis d’usine : échec de l’écriture du sample', err);
        engine.unload(id);
        return { ok: false, reason: 'writeFailed' };
      }
      store.samples = [...store.samples, sample];
      return { ok: true, sampleId: id };
    },

    openImport(assignPadId: string | null = null): void {
      store.drawer = null; // une seule surcouche à la fois (§11)
      store.importAssignPadId = assignPadId;
      store.importOpen = true;
    },

    closeImport(): void {
      store.importOpen = false;
      store.importAssignPadId = null;
    },

    async importBatch(sources: BatchSource[], options: { addToPool?: boolean } = {}): Promise<void> {
      if (store.batchImport !== null && !store.batchImport.finished) return; // un lot à la fois
      batchCancelled = false;
      const items: BatchImportItem[] = sources.map((s) => ({
        name: s.name,
        status: 'pending',
        reason: null,
      }));
      // File de travail : les archives dépliées y ajoutent leurs entrées EN COURS de lot.
      const queue = sources.map((s, i) => ({ item: items[i]!, bytes: s.bytes }));
      publishBatch(items, false);

      for (const job of queue) {
        if (batchCancelled) break;
        job.item.status = 'working';
        publishBatch(items, false);

        let reason: ImportError | null;
        if (job.bytes === null) {
          reason = 'readFailed'; // lecture du fichier échouée en amont (UI)
        } else if (isArchiveFileName(job.item.name)) {
          reason = await expandArchive({ item: job.item, bytes: job.bytes }, items, queue);
        } else {
          const result = await importSource(job.item.name, job.bytes);
          reason = result.ok ? null : result.reason;
          if (result.ok && options.addToPool === true) addSampleToPool(result.sampleId);
        }
        job.item.status = reason === null ? 'done' : 'failed';
        job.item.reason = reason;
        publishBatch(items, false);
      }

      // Interruption : ce qui n'a pas été traité est marqué, jamais passé sous silence.
      for (const item of items) {
        if (item.status === 'pending' || item.status === 'working') item.status = 'skipped';
      }
      publishBatch(items, true);
    },

    cancelBatchImport(): void {
      if (store.batchImport === null || store.batchImport.finished) return;
      batchCancelled = true;
    },

    closeBatchImport(): void {
      if (store.batchImport === null || !store.batchImport.finished) return;
      store.batchImport = null;
      store.importOpen = false; // lot clos → la modale d'import se referme avec lui
      store.importAssignPadId = null;
    },

    async beginImport(
      fileName: string,
      bytes: ArrayBuffer,
      assignPadId: string | null = null,
      addToPool = false,
    ): Promise<ImportError | null> {
      if (bytes.byteLength > IMPORT_MAX_BYTES) return 'tooLarge';
      const pcm = await decodeSource(bytes);
      if (!pcm) return 'undecodable';
      store.audioEditor = { mode: 'import', fileName, pcm, sample: null, assignPadId, addToPool };
      return null;
    },

    async beginSampleRework(sampleId: string): Promise<ImportError | null> {
      const sample = store.samples.find((s) => s.id === sampleId);
      if (!sample) return 'readFailed';
      let bytes: Uint8Array;
      try {
        bytes = await sampleRepository.readBytes(sample.fileName);
      } catch {
        return 'readFailed';
      }
      const pcm = await decodeSource(bytes.slice().buffer as ArrayBuffer);
      if (!pcm) return 'undecodable';
      store.audioEditor = {
        mode: 'rework',
        fileName: sample.label,
        pcm,
        sample,
        assignPadId: null,
        addToPool: false,
      };
      return null;
    },

    previewEditorSelection(startS: number, endS: number): void {
      const editor = store.audioEditor;
      if (!editor) return;
      void engine.resume();
      engine.previewPcm(trimPcm(editor.pcm, startS, endS));
    },

    async applyAudioEditor(startS: number, endS: number): Promise<ImportResult> {
      const editor = store.audioEditor;
      if (!editor) return { ok: false, reason: 'readFailed' };
      const pcm = trimPcm(editor.pcm, startS, endS);

      if (editor.mode === 'import') {
        const result = await finishImport(editor.fileName, pcm, editor.assignPadId);
        if (result.ok) {
          if (editor.addToPool) addSampleToPool(result.sampleId);
          store.audioEditor = null; // échec → l'éditeur reste ouvert (message)
        }
        return result;
      }

      // Retravail : ré-encode et remplace le sample existant (id et fichier conservés).
      const sample = editor.sample;
      if (!sample) return { ok: false, reason: 'readFailed' };
      // Meilleur effort en cas d'échec : recharge les octets d'origine (encore sur disque).
      const restore = async (): Promise<void> => {
        engine.unload(sample.id);
        try {
          const original = await sampleRepository.readBytes(sample.fileName);
          await engine.load(sample.id, original.slice().buffer as ArrayBuffer);
        } catch {
          // buffer perdu : le pad jouera un no-op (§12) jusqu'au prochain démarrage
        }
      };

      let ogg: Uint8Array;
      try {
        ogg = await encode(pcm);
      } catch {
        return { ok: false, reason: 'encodeFailed' };
      }
      engine.unload(sample.id); // purge buffer + pics (le retravail change la forme d'onde)
      try {
        await engine.load(sample.id, ogg.slice().buffer); // garde-fou de re-décodage
      } catch {
        await restore();
        return { ok: false, reason: 'encodeFailed' };
      }
      const updated: Sample = {
        ...sample,
        sizeBytes: ogg.byteLength,
        durationMs: Math.round(pcmDuration(pcm) * 1000),
      };
      try {
        await sampleRepository.replace(updated, ogg);
      } catch (err) {
        console.error('découper: échec de l’écriture du sample retravaillé', err);
        await restore();
        return { ok: false, reason: 'writeFailed' };
      }
      store.samples = store.samples.map((s) => (s.id === updated.id ? updated : s));
      store.audioEditor = null;
      return { ok: true, sampleId: updated.id };
    },

    cancelAudioEditor(): void {
      store.audioEditor = null;
    },

    hydrateTags(tags: Tag[], assignments: Map<string, Set<string>>): void {
      store.tags = sortedTags(tags);
      store.sampleTags = assignments;
    },
    createTag(label: string): void {
      const trimmed = label.trim();
      if (trimmed === '') return;
      const tag: Tag = { id: ids(), label: trimmed };
      store.tags = sortedTags([...store.tags, tag]);
      tagRepository.create(tag).catch((err) => {
        console.error('tags: échec de création', err);
      });
    },
    renameTag(tagId: string, label: string): void {
      const trimmed = label.trim();
      if (trimmed === '' || !store.tags.some((t) => t.id === tagId)) return;
      store.tags = sortedTags(store.tags.map((t) => (t.id === tagId ? { ...t, label: trimmed } : t)));
      tagRepository.rename(tagId, trimmed).catch((err) => {
        console.error('tags: échec du renommage', err);
      });
    },
    deleteTag(tagId: string): void {
      if (!store.tags.some((t) => t.id === tagId)) return;
      store.tags = store.tags.filter((t) => t.id !== tagId);
      // Affectations épurées (miroir du ON DELETE CASCADE) ; ensembles vides retirés.
      const map = new Map<string, Set<string>>();
      for (const [sampleId, set] of store.sampleTags) {
        const next = new Set(set);
        next.delete(tagId);
        if (next.size > 0) map.set(sampleId, next);
      }
      store.sampleTags = map;
      if (store.libraryFilter === tagId) applyLibraryFilter(null); // le filtre visait ce tag
      tagRepository.remove(tagId).catch((err) => {
        console.error('tags: échec de suppression', err);
      });
    },
    toggleSampleTag(sampleId: string, tagId: string): void {
      if (!store.samples.some((s) => s.id === sampleId)) return;
      if (!store.tags.some((t) => t.id === tagId)) return;
      const map = new Map(store.sampleTags);
      const set = new Set(map.get(sampleId) ?? []);
      const write = set.has(tagId)
        ? (set.delete(tagId), tagRepository.unassign(sampleId, tagId))
        : (set.add(tagId), tagRepository.assign(sampleId, tagId));
      if (set.size > 0) map.set(sampleId, set);
      else map.delete(sampleId); // « Non classé » = absence d'entrée (une seule représentation)
      store.sampleTags = map;
      write.catch((err) => {
        console.error('tags: échec d’affectation', err);
      });
    },
    setLibraryFilter(filter: LibraryFilter): void {
      applyLibraryFilter(filter);
    },
    startAssigning(sampleId: string): void {
      if (!store.samples.some((s) => s.id === sampleId)) return;
      store.assigningSampleId = sampleId;
      // Le board doit être visible : toutes les surcouches se ferment.
      if (store.view === 'library') router.pop(DEFAULT_ROUTE);
      store.drawer = null;
    },
    tapAssign(padId: string): void {
      if (store.assigningSampleId === null) return;
      assignSampleToPad(padId, store.assigningSampleId);
    },
    stopAssigning(): void {
      store.assigningSampleId = null;
    },
    addToPool(sampleId: string): void {
      addSampleToPool(sampleId);
    },
    removeFromPool(sampleId: string): void {
      store.poolSampleIds = store.poolSampleIds.filter((id) => id !== sampleId);
      if (store.assigningSampleId === sampleId) store.assigningSampleId = null;
    },
    clearPool(): void {
      // Même règle que removeFromPool : un sample armé qui quitte le pool est désarmé.
      if (store.assigningSampleId !== null && store.poolSampleIds.includes(store.assigningSampleId))
        store.assigningSampleId = null;
      store.poolSampleIds = [];
    },
    openPool(): void {
      store.poolOpen = true;
    },
    closePool(): void {
      store.poolOpen = false;
    },
    previewSample(sampleId: string): void {
      // Bascule : re-tap sur le sample en cours de pré-écoute → stop.
      if (store.previewingSampleId === sampleId) {
        stopPreview();
        return;
      }
      // Stop AVANT le lancement : un échec (buffer non chargé) ne doit jamais laisser
      // l'ancienne pré-écoute jouer sans reflet (son orphelin, plus aucun bouton stop).
      stopPreview();
      void engine.resume();
      const started = engine.previewSample(sampleId, () => {
        // Fin NATURELLE uniquement — le moteur garde par identité de source : le onended
        // tardif d'une lecture remplacée ou stoppée ne notifie jamais.
        store.previewingSampleId = null;
      });
      if (started) store.previewingSampleId = sampleId;
    },
    stopPreview,
    renameSample(sampleId: string, label: string): void {
      if (!store.samples.some((s) => s.id === sampleId)) return;
      store.samples = store.samples.map((s) => (s.id === sampleId ? { ...s, label } : s));
      sampleRepository.rename(sampleId, label).catch((err) => {
        console.error('bibliothèque: échec du renommage', err);
      });
    },
    deleteSample(sampleId: string): void {
      if (!store.samples.some((s) => s.id === sampleId)) return;
      engine.unload(sampleId);
      store.samples = store.samples.filter((s) => s.id !== sampleId);
      // §8 (décision verrouillée) : les pads qui le référençaient passent à vide — miroir en
      // mémoire du ON DELETE SET NULL du schéma (sample_id → NULL après confirmation).
      if (store.bank) {
        for (const pad of store.bank.pads) {
          if (pad.sampleId === sampleId) pad.sampleId = null;
        }
      }
      store.poolSampleIds = store.poolSampleIds.filter((id) => id !== sampleId);
      if (store.assigningSampleId === sampleId) store.assigningSampleId = null;
      // Affectations de tags épurées (miroir du ON DELETE CASCADE).
      if (store.sampleTags.has(sampleId)) {
        const map = new Map(store.sampleTags);
        map.delete(sampleId);
        store.sampleTags = map;
      }
      sampleRepository.remove(sampleId).catch((err) => {
        console.error('bibliothèque: échec de la suppression', err);
      });
    },
  };

  // Application MÉCANIQUE de la règle §16 : chaque commande d'interaction stoppe la
  // pré-écoute AVANT son corps — un seul point, pas de saupoudrage, oubli impossible
  // tant que la commande figure dans PREVIEW_STOPPING_COMMANDS (test générique dédié).
  for (const name of PREVIEW_STOPPING_COMMANDS) {
    const original = commands[name] as (...args: unknown[]) => unknown;
    (commands as unknown as Record<string, (...args: unknown[]) => unknown>)[name] = (
      ...args: unknown[]
    ) => {
      stopPreview();
      return original(...args);
    };
  }

  // Sync URL → affichage (#23) : la route de l'URL d'arrivée s'applique dès la construction,
  // puis à chaque changement d'URL (retour/avance compris). Toute navigation de l'app passe
  // par une ÉCRITURE d'URL (router.push/replace/pop) qui revient ici — jamais l'inverse.
  router.start((route) => commands.applyRoute(route));

  return commands;
}
