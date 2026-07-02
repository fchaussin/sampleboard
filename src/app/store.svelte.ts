// SPDX-License-Identifier: GPL-3.0-or-later
// Store réactif (runes Svelte 5) — source de vérité de la config et de l'état UI (voir §9).
// N'est muté QUE par la couche de commandes. Ne contient aucune logique de jeu (décision B).
import { defaultSettings } from '../domain/invariants';
import type { Bank, Page, Sample, Settings } from '../domain/types';
import type { PcmData } from '../engine/encoder';

/** Contenu du tiroir contextuel (§11) : réglages du pad, de la page, ou généraux. */
export type DrawerContent = 'pad' | 'page' | 'settings';

/** Session de l'éditeur audio (M7, « découper ») : PCM décodé en attente de rognage. */
export interface AudioEditorState {
  /** 'import' : nouveau fichier ; 'rework' : sample existant re-décodé. */
  mode: 'import' | 'rework';
  /** Nom du fichier source (import) ou label du sample (rework). */
  fileName: string;
  pcm: PcmData;
  /** Sample retravaillé (mode 'rework' uniquement). */
  sample: Sample | null;
  /** Pad à assigner après validation (flux modale de choix de sample), ou null. */
  assignPadId: string | null;
}

export class AppStore {
  /** Arbre banque chargé (null tant que non hydraté — jalon M5). */
  bank = $state<Bank | null>(null);
  /** La bibliothèque chargée. */
  samples = $state<Sample[]>([]);
  /** Réglages globaux (défauts jusqu'à hydratation). */
  settings = $state<Settings>(defaultSettings());

  /** Page couramment affichée. */
  activePageId = $state<string | null>(null);
  /** Édition (true) ↔ Jeu (false). */
  editMode = $state(false);
  /** Pad sélectionné en Édition (cible du tiroir pad), ou null. */
  selectedPadId = $state<string | null>(null);
  /** Tiroir contextuel ouvert (§11), ou null (fermé). */
  drawer = $state<DrawerContent | null>(null);
  /** Panneau bibliothèque plein écran ouvert (§11). */
  libraryOpen = $state(false);
  /** Éditeur audio ouvert (M7) — $state.raw : remplacé en bloc, le PCM n'est pas proxifié. */
  audioEditor = $state.raw<AudioEditorState | null>(null);
  /** Reflet minimal des voix actives émis par l'engine (jamais calculé ici). */
  activePadIds = $state<Set<string>>(new Set());

  /** Raccourci pratique : langue courante de l'UI. */
  get locale(): string {
    return this.settings.locale;
  }

  /** Page couramment affichée (dérivée de `bank` + `activePageId`), ou `null`. */
  get activePage(): Page | null {
    if (!this.bank || this.activePageId === null) return null;
    return this.bank.pages.find((p) => p.id === this.activePageId) ?? null;
  }
}

export function createStore(): AppStore {
  return new AppStore();
}
