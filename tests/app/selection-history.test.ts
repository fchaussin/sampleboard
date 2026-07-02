// SPDX-License-Identifier: GPL-3.0-or-later
// Tests de l'historique undo/redo de l'éditeur audio (M7).
import { describe, it, expect } from 'vitest';
import { SelectionHistory } from '../../src/app/selection-history';

describe('SelectionHistory', () => {
  it('push puis undo/redo restituent les sélections dans l’ordre', () => {
    const h = new SelectionHistory({ start: 0, end: 10 });
    h.push({ start: 2, end: 10 });
    h.push({ start: 2, end: 8 });
    expect(h.undo()).toEqual({ start: 2, end: 10 });
    expect(h.undo()).toEqual({ start: 0, end: 10 });
    expect(h.canUndo).toBe(false);
    expect(h.redo()).toEqual({ start: 2, end: 10 });
    expect(h.redo()).toEqual({ start: 2, end: 8 });
    expect(h.canRedo).toBe(false);
  });

  it('un push après undo efface le futur', () => {
    const h = new SelectionHistory({ start: 0, end: 10 });
    h.push({ start: 1, end: 10 });
    h.undo();
    h.push({ start: 3, end: 9 });
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toEqual({ start: 0, end: 10 });
  });

  it('push d’un état identique : ignoré ; undo/redo à vide : état courant', () => {
    const h = new SelectionHistory({ start: 0, end: 5 });
    h.push({ start: 0, end: 5 });
    expect(h.canUndo).toBe(false);
    expect(h.undo()).toEqual({ start: 0, end: 5 });
    expect(h.redo()).toEqual({ start: 0, end: 5 });
  });

  it('current est une copie (pas de mutation par référence)', () => {
    const h = new SelectionHistory({ start: 0, end: 5 });
    const sel = h.current;
    sel.start = 99;
    expect(h.current.start).toBe(0);
  });
});
