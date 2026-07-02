// SPDX-License-Identifier: GPL-3.0-or-later
// Tests purs des bornes & invariants du domaine (voir §6).
import { describe, it, expect } from 'vitest';
import {
  isValidGainDb,
  isValidRows,
  isValidCols,
  gridCapacity,
  isValidPosition,
  padsFitGrid,
} from '../../src/domain/invariants';
import type { Pad, Page } from '../../src/domain/types';

const page = (rows: number, cols: number): Pick<Page, 'rows' | 'cols'> => ({ rows, cols });
const at = (position: number): Pad => ({
  id: 'p',
  pageId: 'pg',
  name: 'p',
  sampleId: null,
  playMode: 'oneShot',
  gainDb: 0,
  position,
});

describe('bornes de gain (dB)', () => {
  it('accepte [-60, +6], refuse hors plage et non fini', () => {
    expect(isValidGainDb(0)).toBe(true);
    expect(isValidGainDb(-60)).toBe(true);
    expect(isValidGainDb(6)).toBe(true);
    expect(isValidGainDb(-60.1)).toBe(false);
    expect(isValidGainDb(6.1)).toBe(false);
    expect(isValidGainDb(Number.NaN)).toBe(false);
  });
});

describe('bornes de grille', () => {
  it('rows ∈ [2,12], cols ∈ [2,6], entiers', () => {
    expect(isValidRows(1)).toBe(true);
    expect(isValidRows(12)).toBe(true);
    expect(isValidRows(0)).toBe(false);
    expect(isValidRows(13)).toBe(false);
    expect(isValidRows(3.5)).toBe(false);
    expect(isValidCols(1)).toBe(true);
    expect(isValidCols(6)).toBe(true);
    expect(isValidCols(7)).toBe(false);
    expect(isValidCols(0)).toBe(false);
  });

  it('capacité = rows × cols', () => {
    expect(gridCapacity(page(4, 4))).toBe(16);
    expect(gridCapacity(page(12, 6))).toBe(72);
  });
});

describe('positions', () => {
  it('valide dans [0, capacité[', () => {
    expect(isValidPosition(0, 16)).toBe(true);
    expect(isValidPosition(15, 16)).toBe(true);
    expect(isValidPosition(16, 16)).toBe(false);
    expect(isValidPosition(-1, 16)).toBe(false);
  });

  it('padsFitGrid : vrai si toutes les positions tiennent, faux sinon', () => {
    expect(padsFitGrid([at(0), at(15)], page(4, 4))).toBe(true);
    // Réduire la grille sous une position occupée casse l'invariant.
    expect(padsFitGrid([at(15)], page(2, 2))).toBe(false);
  });
});
