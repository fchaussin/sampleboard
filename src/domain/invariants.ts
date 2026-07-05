// SPDX-License-Identifier: GPL-3.0-or-later
// Domaine pur : bornes et validations (voir specifications.md §6). Fonctions pures, testables.
// Les tests dédiés arrivent au jalon M2 ; ce module pose les constantes et gardes de base.
import { COLORS, type BackgroundBehavior, type Color } from './enums';
import type { Pad, Page, Settings } from './types';

export const GAIN_DB_MIN = -60;
export const GAIN_DB_MAX = 6;

export const ROWS_MIN = 1;
export const ROWS_MAX = 12;
export const COLS_MIN = 1;
export const COLS_MAX = 6;

/** Valeurs par défaut du domaine (voir §6). */
export const DEFAULT_ROWS = 4;
export const DEFAULT_COLS = 4;
export const DEFAULT_GAIN_DB = 0;
export const DEFAULT_MAX_VOICES = 8;
export const DEFAULT_LOCALE = 'en'; // décision 2026-07-05 : anglais par défaut (fr via Réglages)
export const DEFAULT_BACKGROUND_BEHAVIOR: BackgroundBehavior = 'stopAll';

/** Réglages par défaut (voir §6) — utilisés avant hydratation et au premier lancement. */
export function defaultSettings(): Settings {
  return {
    backgroundBehavior: DEFAULT_BACKGROUND_BEHAVIOR,
    maxVoices: DEFAULT_MAX_VOICES,
    locale: DEFAULT_LOCALE,
  };
}

/** Taille max d'un fichier importé, sur la source avant décodage (20 Mo, §16). */
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024;

/** Taille max d'une ARCHIVE importée (M8) ; chaque entrée reste soumise à IMPORT_MAX_BYTES. */
export const ARCHIVE_MAX_BYTES = 200 * 1024 * 1024;

/** Extensions d'archives acceptées à l'import (M8) — zip + rar (lecteurs libarchive, §16). */
export const ARCHIVE_EXTENSIONS = ['zip', 'rar'] as const;

/** Extensions retenues comme candidates audio lors de l'expansion d'une archive. */
export const AUDIO_EXTENSIONS = [
  'mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'm4a', 'aac', 'webm', 'aif', 'aiff',
] as const;

/** Extension d'un nom de fichier, en minuscules ('' si aucune). */
function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Vrai si le nom désigne une archive prise en charge (zip/rar). */
export function isArchiveFileName(name: string): boolean {
  return (ARCHIVE_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

/** Vrai si le nom est une candidate audio (le décodage reste l'arbitre final, §12). */
export function isAudioFileName(name: string): boolean {
  return (AUDIO_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

/** Longueur max du nom de pad auto-généré à l'assignation (M6). */
export const PAD_NAME_MAX = 12;

/** Nom de pad par défaut dérivé d'un label de sample : extension retirée, rogné à 12 car. */
export function defaultPadName(label: string): string {
  const base = label.replace(/\.[^./\\\s]{1,8}$/, '');
  return base.slice(0, PAD_NAME_MAX).trim();
}

/** Vrai si `value` est un token de la palette (garde des données persistées/altérées). */
export function isValidColor(value: unknown): value is Color {
  return typeof value === 'string' && (COLORS as readonly string[]).includes(value);
}

export function isValidGainDb(gainDb: number): boolean {
  return Number.isFinite(gainDb) && gainDb >= GAIN_DB_MIN && gainDb <= GAIN_DB_MAX;
}

export function isValidRows(rows: number): boolean {
  return Number.isInteger(rows) && rows >= ROWS_MIN && rows <= ROWS_MAX;
}

export function isValidCols(cols: number): boolean {
  return Number.isInteger(cols) && cols >= COLS_MIN && cols <= COLS_MAX;
}

/** Nombre de cases d'une grille. */
export function gridCapacity(page: Pick<Page, 'rows' | 'cols'>): number {
  return page.rows * page.cols;
}

/** Une position est valide si elle tient dans la capacité de la grille. */
export function isValidPosition(position: number, capacity: number): boolean {
  return Number.isInteger(position) && position >= 0 && position < capacity;
}

/** Vrai si tous les pads tiennent dans la grille (invariant de réduction, voir §6/§12). */
export function padsFitGrid(pads: readonly Pad[], page: Pick<Page, 'rows' | 'cols'>): boolean {
  const capacity = gridCapacity(page);
  return pads.every((pad) => isValidPosition(pad.position, capacity));
}
