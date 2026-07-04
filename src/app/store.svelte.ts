// SPDX-License-Identifier: GPL-3.0-or-later
// Store réactif (runes Svelte 5) — source de vérité de la config et de l'état UI (voir §9).
// N'est muté QUE par la couche de commandes. Ne contient aucune logique de jeu (décision B).
import { defaultSettings } from '../domain/invariants';
import type { Bank, Page, Sample, Settings, Tag } from '../domain/types';
import type { PcmData } from '../engine/encoder';
import type { ImportError } from './commands';
import type { ViewId } from './navigation';

/** Contenu du tiroir contextuel (§11) : réglages du pad, de la page, généraux, ou tags (#20). */
export type DrawerContent = 'pad' | 'page' | 'settings' | 'tags';

/** Filtre de la bibliothèque (M8) : un tagId, 'untagged' (virtuel : sans tag), ou null. */
export type LibraryFilter = string | 'untagged' | null;

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
  /** Ajouter le sample au pool après validation (option de la modale d'import, M8). */
  addToPool: boolean;
}

/** Statut d'un élément du lot d'import (M8) — « skipped » : lot interrompu avant lui. */
export type BatchItemStatus = 'pending' | 'working' | 'done' | 'failed' | 'skipped';

/** Élément suivi par la modale de progression : un fichier source ou une entrée d'archive. */
export interface BatchImportItem {
  name: string;
  status: BatchItemStatus;
  reason: ImportError | null;
}

/** Lot d'import en cours/terminé (M8) — remplacé EN BLOC à chaque progression ($state.raw). */
export interface BatchImportState {
  /** La liste GRANDIT en cours de lot : chaque archive y ajoute ses entrées audio. */
  items: BatchImportItem[];
  /** Éléments réglés (done/failed/skipped) — numérateur de la barre de progression. */
  settled: number;
  finished: boolean;
  cancelled: boolean;
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
  /** Vue courante de <main> (#23) : PROJECTION de l'URL — écrite par `applyRoute` uniquement. */
  view = $state<ViewId>('board');
  /** Éditeur audio ouvert (M7) — $state.raw : remplacé en bloc, le PCM n'est pas proxifié. */
  audioEditor = $state.raw<AudioEditorState | null>(null);
  /** Modale d'import ouverte (M8) — état « choix des fichiers » avant tout lot. */
  importOpen = $state(false);
  /** Pad à assigner à l'issue de l'import (modale ouverte depuis le choix de sample), ou null. */
  importAssignPadId = $state<string | null>(null);
  /** Lot d'import en cours (M8, progression dans la modale d'import), ou null. */
  batchImport = $state.raw<BatchImportState | null>(null);
  /** Tags de la bibliothèque (M8), triés par libellé. */
  tags = $state<Tag[]>([]);
  /** Affectations sample → tags — remplacée EN BLOC à chaque mutation (Map non proxifiée). */
  sampleTags = $state<Map<string, Set<string>>>(new Map());
  /** Filtre courant de la bibliothèque (M8). */
  libraryFilter = $state<LibraryFilter>(null);
  /** Sample en PRÉ-ÉCOUTE (bibliothèque / modale de sample), ou null — le ▶ devient ■. */
  previewingSampleId = $state<string | null>(null);
  /** Sample ARMÉ pour l'assignation à la volée (M8) : chaque pad touché le reçoit. */
  assigningSampleId = $state<string | null>(null);
  /** Pool (M8) : liste de travail de samples (session), assignables à la volée. */
  poolSampleIds = $state<string[]>([]);
  /** Tiroir gauche du pool ouvert. */
  poolOpen = $state(false);
  /** Reflet minimal des voix actives émis par l'engine (jamais calculé ici). */
  activePadIds = $state<Set<string>>(new Set());

  /** La bibliothèque est la vue courante (#22/#23) — lecture dérivée de `view`. */
  get libraryOpen(): boolean {
    return this.view === 'library';
  }

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
