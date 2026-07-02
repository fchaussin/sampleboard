// SPDX-License-Identifier: GPL-3.0-or-later
// Domaine pur : types du modèle (voir specifications.md §6). Aucune dépendance externe.
import type { PlayMode, VoiceMode, BackgroundBehavior, Color } from './enums';

export interface Pad {
  id: string;
  pageId: string;
  name: string;
  /** Référence un Sample de la bibliothèque ; null = pad vide. */
  sampleId: string | null;
  /** Défaut : 'oneShot'. */
  playMode: PlayMode;
  /** Niveau par pad en dB ; défaut 0.0 (niveau d'origine) ; plage [-60, +6], -60 = muet. */
  gainDb: number;
  /** Index dans la grille : 0 .. rows*cols-1. */
  position: number;
  /** Token de la palette (M6, voir COLORS) ; null/absent = neutre. */
  color?: Color | null;
}

export interface Page {
  id: string;
  name: string;
  /** Polyphonie ; défaut : 'poly'. */
  voiceMode: VoiceMode;
  /** Défaut : 4 (plage 1..12). */
  rows: number;
  /** Défaut : 4 (plage 1..6). */
  cols: number;
  position: number;
  /** Token de la palette (M6, voir COLORS) ; null/absent = neutre. */
  color?: Color | null;
}

/**
 * Un sample de la bibliothèque : entité gérée indépendamment des pads (CRUD propre).
 * Un Sample peut exister sans être rattaché à aucun pad.
 */
export interface Sample {
  id: string;
  /** Nom affiché, éditable ; défaut = nom de fichier d'origine. */
  label: string;
  /** Nom sur disque ({sampleId}.ogg). */
  fileName: string;
  originalName: string;
  /** 'audio/ogg' après ré-encodage. */
  mime: string;
  sizeBytes: number;
  durationMs: number | null;
  createdAt: number;
}

/** Réglages globaux (app-level, hors banque). */
export interface Settings {
  /** Défaut : 'stopAll'. */
  backgroundBehavior: BackgroundBehavior;
  /** Nombre maximum de voix ; défaut 8. */
  maxVoices: number;
  /** Langue UI ; défaut 'fr'. */
  locale: string;
}

export interface Bank {
  id: string;
  name: string;
  pages: Page[];
  /** Aplati ; regroupé par pageId à la lecture. */
  pads: Pad[];
  // La bibliothèque n'est PAS incluse ici : collection partagée, chargée à part (voir §8).
}
