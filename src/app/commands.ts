// SPDX-License-Identifier: GPL-3.0-or-later
// Couche de commandes — SEUL point de mutation du store (voir specifications.md §9).
// Chaque commande coordonne store + engine + persistance de façon atomique.
// M0 : seules les commandes nécessaires au socle sont câblées ; le reste arrive par jalon.
import type { AudioEngine } from '../engine/audio-engine';
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
}

export function createCommands({ store }: CommandDeps): Commands {
  return {
    toggleEditMode(): void {
      store.editMode = !store.editMode;
    },
    setLocale(locale: string): void {
      store.settings = { ...store.settings, locale };
    },
  };
}
