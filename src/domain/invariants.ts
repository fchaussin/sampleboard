// SPDX-License-Identifier: GPL-3.0-or-later
// Domaine pur : bornes et validations (voir specifications.md §6). Fonctions pures, testables.
// Les tests dédiés arrivent au jalon M2 ; ce module pose les constantes et gardes de base.
import type { Pad, Page } from './types';

export const GAIN_DB_MIN = -60;
export const GAIN_DB_MAX = 6;

export const ROWS_MIN = 2;
export const ROWS_MAX = 12;
export const COLS_MIN = 2;
export const COLS_MAX = 6;

/** Valeurs par défaut du domaine (voir §6). */
export const DEFAULT_ROWS = 4;
export const DEFAULT_COLS = 4;
export const DEFAULT_GAIN_DB = 0;
export const DEFAULT_MAX_VOICES = 8;
export const DEFAULT_LOCALE = 'fr';

/** Taille max d'un fichier importé, sur la source avant décodage (20 Mo, §16). */
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024;

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
