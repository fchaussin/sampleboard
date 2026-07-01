// SPDX-License-Identifier: GPL-3.0-or-later
// Tests purs des lectures dérivées de l'arbre banque (voir §6).
import { describe, it, expect } from 'vitest';
import {
  pagesSorted,
  padsOfPage,
  padAtPosition,
  findPad,
  findPage,
} from '../../src/domain/selectors';
import type { Bank, Pad } from '../../src/domain/types';

function bank(): Bank {
  const pad = (id: string, pageId: string, position: number): Pad => ({
    id,
    pageId,
    name: id,
    sampleId: null,
    playMode: 'oneShot',
    gainDb: 0,
    position,
  });
  return {
    id: 'b',
    name: 'b',
    pages: [
      { id: 'p1', name: 'P1', voiceMode: 'poly', rows: 4, cols: 4, position: 1 },
      { id: 'p0', name: 'P0', voiceMode: 'poly', rows: 4, cols: 4, position: 0 },
    ],
    pads: [pad('b', 'p0', 2), pad('a', 'p0', 0), pad('c', 'p1', 0)],
  };
}

describe('pagesSorted', () => {
  it('trie par position sans muter la source', () => {
    const b = bank();
    expect(pagesSorted(b).map((p) => p.id)).toEqual(['p0', 'p1']);
    expect(b.pages.map((p) => p.id)).toEqual(['p1', 'p0']); // source intacte
  });
});

describe('padsOfPage', () => {
  it('filtre par page et trie par position', () => {
    expect(padsOfPage(bank(), 'p0').map((p) => p.id)).toEqual(['a', 'b']);
    expect(padsOfPage(bank(), 'p1').map((p) => p.id)).toEqual(['c']);
  });
});

describe('padAtPosition / findPad / findPage', () => {
  it('résout par position et par id', () => {
    const b = bank();
    const p0Pads = padsOfPage(b, 'p0');
    expect(padAtPosition(p0Pads, 0)?.id).toBe('a');
    expect(padAtPosition(p0Pads, 1)).toBeUndefined();
    expect(findPad(b, 'c')?.pageId).toBe('p1');
    expect(findPad(b, 'zzz')).toBeUndefined();
    expect(findPage(b, 'p1')?.name).toBe('P1');
  });
});
