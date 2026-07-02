// SPDX-License-Identifier: GPL-3.0-or-later
// Couche de commandes — SEUL point de mutation du store (voir specifications.md §9).
// Coordonne store + engine de façon atomique. L'UI n'émet que des intentions.
import type { AudioEngine } from '../engine/audio-engine';
import type { Encoder } from '../engine/encoder';
import type { SampleRepository } from '../storage/types';
import type { Bank, Pad, Page, Sample, Settings } from '../domain/types';
import type { BackgroundBehavior, Color, PlayMode, VoiceMode } from '../domain/enums';
import { findPad, findPage, padsOfPage, pagesSorted, firstFreePosition } from '../domain/selectors';
import {
  DEFAULT_COLS,
  DEFAULT_GAIN_DB,
  DEFAULT_ROWS,
  GAIN_DB_MAX,
  GAIN_DB_MIN,
  IMPORT_MAX_BYTES,
  defaultPadName,
  gridCapacity,
  isValidColor,
  isValidCols,
  isValidRows,
  padsFitGrid,
} from '../domain/invariants';
import { newId } from '../domain/id';
import type { AppStore } from './store.svelte';

/** Motif d'échec d'un import (voir §12, §13). */
export type ImportError = 'tooLarge' | 'undecodable' | 'encodeFailed' | 'writeFailed';
export type ImportResult = { ok: true; sampleId: string } | { ok: false; reason: ImportError };

export interface CommandDeps {
  store: AppStore;
  engine: AudioEngine;
  /** Encodeur OGG/Opus (injectable pour les tests). */
  encode: Encoder;
  /** Dépôt bibliothèque : écritures immédiates, hors autosave débouncé (voir §9, décision A). */
  sampleRepository: SampleRepository;
  /** Générateur d'identifiants (injectable pour les tests). Défaut : `newId()`. */
  ids?: () => string;
  /** Horloge (injectable pour les tests). Défaut : `Date.now`. */
  now?: () => number;
  /**
   * Nom par défaut de la n-ième page ajoutée (« Page N ») — injecté depuis le bootstrap
   * (les libellés vivent en ui/i18n, que cette couche ne peut pas importer, §4).
   */
  newPageName?: (n: number) => string;
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
  closeDrawer(): void;
  openLibrary(): void;
  closeLibrary(): void;

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
  /** Pipeline d'import : validation taille → décodage → ré-encodage Opus → entrée bibliothèque. */
  importSample(fileName: string, bytes: ArrayBuffer): Promise<ImportResult>;
  /** Pré-écoute d'un sample de la bibliothèque. */
  previewSample(sampleId: string): void;
  renameSample(sampleId: string, label: string): void;
  /** Supprime un sample ; les pads qui le référençaient deviennent *introuvables* (§12). */
  deleteSample(sampleId: string): void;
}

export function createCommands({
  store,
  engine,
  encode,
  sampleRepository,
  ids = () => newId(),
  now = () => Date.now(),
  newPageName,
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

  return {
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
    closeDrawer(): void {
      if (store.drawer === 'pad') store.selectedPadId = null;
      store.drawer = null;
    },
    openLibrary(): void {
      store.drawer = null; // une seule surcouche à la fois
      store.libraryOpen = true;
    },
    closeLibrary(): void {
      store.libraryOpen = false;
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

      const pad: Pad = {
        id: ids(),
        pageId,
        name: '',
        sampleId: null,
        playMode: 'oneShot',
        gainDb: DEFAULT_GAIN_DB,
        position: pos,
      };
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
      const pad = store.bank ? findPad(store.bank, padId) : undefined;
      if (!pad) return;
      if (sampleId === null) {
        pad.sampleId = null;
        return;
      }
      const sample = store.samples.find((s) => s.id === sampleId);
      if (!sample) return;
      pad.sampleId = sampleId;
      // Nom par défaut (M6) : un pad SANS nom prend celui du sample (rogné) ; un nom
      // choisi par l'utilisateur n'est jamais écrasé.
      if (pad.name === '') pad.name = defaultPadName(sample.label);
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
      const page: Page = {
        id: ids(),
        // « Page N » (injecté, i18n) — N = rang de création dans la banque courante.
        name: newPageName ? newPageName(bank.pages.length + 1) : '',
        voiceMode: 'poly',
        rows: DEFAULT_ROWS,
        cols: DEFAULT_COLS,
        position: bank.pages.length,
      };
      bank.pages.push(page);
      store.activePageId = page.id;
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
      if (bytes.byteLength > IMPORT_MAX_BYTES) return { ok: false, reason: 'tooLarge' };
      await engine.resume();

      let decoded;
      try {
        decoded = await engine.decode(bytes);
      } catch {
        return { ok: false, reason: 'undecodable' }; // format non décodable (§12)
      }

      let ogg: Uint8Array;
      try {
        ogg = await encode({ channelData: decoded.channelData, sampleRate: decoded.sampleRate });
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
        durationMs: Math.round(decoded.durationMs),
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
      return { ok: true, sampleId: id };
    },
    previewSample(sampleId: string): void {
      void engine.resume();
      engine.previewSample(sampleId);
    },
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
      sampleRepository.remove(sampleId).catch((err) => {
        console.error('bibliothèque: échec de la suppression', err);
      });
    },
  };
}
