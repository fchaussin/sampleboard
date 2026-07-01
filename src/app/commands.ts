// SPDX-License-Identifier: GPL-3.0-or-later
// Couche de commandes — SEUL point de mutation du store (voir specifications.md §9).
// Coordonne store + engine de façon atomique. L'UI n'émet que des intentions.
import type { AudioEngine } from '../engine/audio-engine';
import type { Bank, Pad, Page, Sample } from '../domain/types';
import type { PlayMode, VoiceMode } from '../domain/enums';
import { findPad, findPage, padsOfPage, pagesSorted, firstFreePosition } from '../domain/selectors';
import {
  DEFAULT_COLS,
  DEFAULT_GAIN_DB,
  DEFAULT_ROWS,
  GAIN_DB_MAX,
  GAIN_DB_MIN,
  gridCapacity,
  isValidCols,
  isValidRows,
  padsFitGrid,
} from '../domain/invariants';
import { newId } from '../domain/id';
import type { AppStore } from './store.svelte';

export interface CommandDeps {
  store: AppStore;
  engine: AudioEngine;
  /** Générateur d'identifiants (injectable pour les tests). Défaut : `newId()`. */
  ids?: () => string;
}

export interface Commands {
  // UI globale
  toggleEditMode(): void;
  setLocale(locale: string): void;
  resumeAudio(): Promise<void>;

  // Chargement (seed M2/M3 ; hydratation SQLite au M5)
  hydrateBank(bank: Bank): void;
  hydrateLibrary(samples: Sample[]): void;
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
  assignSample(padId: string, sampleId: string | null): void;
  deletePad(padId: string): void;
  reorderPads(padId: string, toPosition: number): void;

  // Édition — pages
  addPage(): void;
  renamePage(pageId: string, name: string): void;
  deletePage(pageId: string): void;
  setPageVoiceMode(pageId: string, voiceMode: VoiceMode): void;
  setPageGrid(pageId: string, rows: number, cols: number): void;
  reorderPages(pageId: string, toIndex: number): void;

  // Bibliothèque — pont dev (remplacé par l'import réel M4)
  attachSampleBuffer(sampleId: string, bytes: ArrayBuffer): Promise<void>;
  devAddSample(label: string, bytes: ArrayBuffer): Promise<string>;
}

export function createCommands({ store, engine, ids = () => newId() }: CommandDeps): Commands {
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
      if (!store.editMode) store.selectedPadId = null;
    },
    setLocale(locale: string): void {
      store.settings = { ...store.settings, locale };
    },
    resumeAudio(): Promise<void> {
      return engine.resume();
    },

    hydrateBank(bank: Bank): void {
      store.bank = bank;
      store.activePageId = pagesSorted(bank)[0]?.id ?? null;
    },
    hydrateLibrary(samples: Sample[]): void {
      store.samples = samples;
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
      store.selectedPadId = pad.id;
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
    assignSample(padId: string, sampleId: string | null): void {
      const pad = store.bank ? findPad(store.bank, padId) : undefined;
      if (!pad) return;
      if (sampleId !== null && !store.samples.some((s) => s.id === sampleId)) return;
      pad.sampleId = sampleId;
    },
    deletePad(padId: string): void {
      const bank = store.bank;
      if (!bank) return;
      engine.stopPad(padId);
      bank.pads = bank.pads.filter((p) => p.id !== padId);
      if (store.selectedPadId === padId) store.selectedPadId = null;
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
        name: '',
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

    async attachSampleBuffer(sampleId: string, bytes: ArrayBuffer): Promise<void> {
      await engine.resume();
      await engine.load(sampleId, bytes);
    },
    async devAddSample(label: string, bytes: ArrayBuffer): Promise<string> {
      const id = ids();
      await engine.resume();
      await engine.load(id, bytes);
      const sample: Sample = {
        id,
        label,
        fileName: `${id}.ogg`,
        originalName: label,
        mime: 'audio/ogg',
        sizeBytes: bytes.byteLength,
        durationMs: null,
        createdAt: 0,
      };
      store.samples = [...store.samples, sample];
      return id;
    },
  };
}
