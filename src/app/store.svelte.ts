// SPDX-License-Identifier: GPL-3.0-or-later
// Store réactif (runes Svelte 5) — source de vérité de la config et de l'état UI (voir §9).
// N'est muté QUE par la couche de commandes. Ne contient aucune logique de jeu (décision B).
import { DEFAULT_LOCALE } from '../domain/invariants';
import type { Bank, Sample, Settings } from '../domain/types';

export class AppStore {
  /** Arbre banque chargé (null tant que non hydraté — jalon M5). */
  bank = $state<Bank | null>(null);
  /** La bibliothèque chargée. */
  samples = $state<Sample[]>([]);
  /** Réglages globaux (défauts jusqu'à hydratation). */
  settings = $state<Settings>({
    backgroundBehavior: 'stopAll',
    maxVoices: 8,
    locale: DEFAULT_LOCALE,
  });

  /** Page couramment affichée. */
  activePageId = $state<string | null>(null);
  /** Édition (true) ↔ Jeu (false). */
  editMode = $state(false);
  /** Reflet minimal des voix actives émis par l'engine (jamais calculé ici). */
  activePadIds = $state<Set<string>>(new Set());

  /** Raccourci pratique : langue courante de l'UI. */
  get locale(): string {
    return this.settings.locale;
  }
}

export function createStore(): AppStore {
  return new AppStore();
}
