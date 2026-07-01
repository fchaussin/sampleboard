// SPDX-License-Identifier: GPL-3.0-or-later
// Couche de commandes — SEUL point de mutation du store (voir specifications.md §9).
// Chaque commande coordonne store + engine de façon atomique. L'UI n'émet que des intentions.
import type { AudioEngine } from '../engine/audio-engine';
import type { Bank, Pad, Page } from '../domain/types';
import { findPad, findPage, pagesSorted } from '../domain/selectors';
import type { AppStore } from './store.svelte';

export interface CommandDeps {
  store: AppStore;
  engine: AudioEngine;
}

export interface Commands {
  /** Bascule Édition ↔ Jeu. */
  toggleEditMode(): void;
  /** Change la langue de l'UI. TODO(M5) : persister via SettingsRepository. */
  setLocale(locale: string): void;
  /** Reprend/crée l'AudioContext sur un geste utilisateur (idempotent, voir §7, §12). */
  resumeAudio(): Promise<void>;

  /** Charge un arbre banque dans le store (seed M2 ; hydratation depuis SQLite au M5). */
  hydrateBank(bank: Bank): void;
  /** Change la page affichée. */
  setActivePage(pageId: string): void;

  // Jeu (voir la matrice §7). No-op silencieux si pad/page introuvable ou pad vide.
  firePad(padId: string): void; // One-Shot
  pressPad(padId: string): void; // Gate — gate on
  releasePad(padId: string): void; // Gate — gate off
  toggleLoopPad(padId: string): void; // Loop — start/stop
  stopPad(padId: string): void;
  stopPage(pageId: string): void;

  /** TEMP(M2) : charge un fichier audio dans un slot de sample (remplacé par l'import M4). */
  loadDevSample(sampleId: string, bytes: ArrayBuffer): Promise<void>;
}

export function createCommands({ store, engine }: CommandDeps): Commands {
  /** Résout un pad et sa page dans la banque courante, ou `null`. */
  function resolve(padId: string): { pad: Pad; page: Page } | null {
    const bank = store.bank;
    if (!bank) return null;
    const pad = findPad(bank, padId);
    if (!pad) return null;
    const page = findPage(bank, pad.pageId);
    if (!page) return null;
    return { pad, page };
  }

  return {
    toggleEditMode(): void {
      store.editMode = !store.editMode;
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

    async loadDevSample(sampleId: string, bytes: ArrayBuffer): Promise<void> {
      await engine.resume();
      await engine.load(sampleId, bytes);
    },
  };
}
