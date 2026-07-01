// SPDX-License-Identifier: GPL-3.0-or-later
// Couche de commandes — SEUL point de mutation du store (voir specifications.md §9).
// Chaque commande coordonne store + engine + persistance de façon atomique.
// M1 : `resumeAudio` (politique autoplay) + harnais de démo audio (temporaire, voir plus bas).
import type { AudioEngine } from '../engine/audio-engine';
import type { Pad, Page } from '../domain/types';
import { DEFAULT_COLS, DEFAULT_GAIN_DB, DEFAULT_ROWS } from '../domain/invariants';
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
  /** TEMP(M1) : charge un son de démo dans le moteur (remplacé par l'import réel, M4). */
  loadDemoSound(bytes: ArrayBuffer): Promise<void>;
  /** TEMP(M1) : joue le pad de démo codé en dur (One-Shot). Remplacé par `firePad` (M2). */
  fireDemoPad(): void;
}

// --- TEMP(M1) : pad/page codés en dur pour valider l'audio (voir roadmap M1). --------------
// À retirer quand le vrai modèle (store/commands de jeu) arrivera aux jalons M2/M3.
export const M1_DEMO_SAMPLE_ID = 'm1-demo-sample';
export const M1_DEMO_PAD_ID = 'm1-demo-pad';

const M1_DEMO_PAGE: Page = {
  id: 'm1-demo-page',
  name: 'demo',
  voiceMode: 'poly',
  rows: DEFAULT_ROWS,
  cols: DEFAULT_COLS,
  position: 0,
};

const M1_DEMO_PAD: Pad = {
  id: M1_DEMO_PAD_ID,
  pageId: M1_DEMO_PAGE.id,
  name: 'demo',
  sampleId: M1_DEMO_SAMPLE_ID,
  playMode: 'oneShot',
  gainDb: DEFAULT_GAIN_DB,
  position: 0,
};
// ------------------------------------------------------------------------------------------

export function createCommands({ store, engine }: CommandDeps): Commands {
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
    async loadDemoSound(bytes: ArrayBuffer): Promise<void> {
      await engine.resume();
      await engine.load(M1_DEMO_SAMPLE_ID, bytes);
    },
    fireDemoPad(): void {
      engine.oneShot(M1_DEMO_PAD, M1_DEMO_PAGE);
    },
  };
}
