// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du préchargeur/paceur (#27) : ordre de priorité (page active → autres pads →
// bibliothèque), concurrence bornée, settle notifié MÊME en échec de chargement.
import { describe, it, expect } from 'vitest';
import { preloadBuffers, prioritizeSamples } from '../../src/app/preload';
import type { Bank, Sample } from '../../src/domain/types';

function sample(id: string, createdAt: number): Sample {
  return {
    id,
    label: id,
    fileName: `${id}.ogg`,
    originalName: id,
    mime: 'audio/ogg',
    sizeBytes: 0,
    durationMs: null,
    createdAt,
  };
}

const bank: Bank = {
  id: 'b',
  name: 'b',
  pages: [
    { id: 'pg1', name: 'A', voiceMode: 'poly', rows: 2, cols: 2, position: 0, color: null },
    { id: 'pg2', name: 'B', voiceMode: 'poly', rows: 2, cols: 2, position: 1, color: null },
  ],
  pads: [
    { id: 'p1', pageId: 'pg1', name: '', sampleId: 's-actif', playMode: 'oneShot', gainDb: 0, position: 0, color: null, cueStart: null, cueEnd: null },
    { id: 'p2', pageId: 'pg2', name: '', sampleId: 's-autre-page', playMode: 'oneShot', gainDb: 0, position: 0, color: null, cueStart: null, cueEnd: null },
  ],
};

describe('prioritizeSamples', () => {
  it('page active → pads des autres pages → bibliothèque, ordre conservé par groupe', () => {
    const samples = [
      sample('s-libre-1', 1),
      sample('s-autre-page', 2),
      sample('s-libre-2', 3),
      sample('s-actif', 4),
    ];
    expect(prioritizeSamples(samples, bank, 'pg1').map((s) => s.id)).toEqual([
      's-actif',
      's-autre-page',
      's-libre-1',
      's-libre-2',
    ]);
  });

  it('sans banque : ordre de la bibliothèque inchangé', () => {
    const samples = [sample('a', 1), sample('b', 2)];
    expect(prioritizeSamples(samples, null, null).map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('preloadBuffers', () => {
  it('charge tout, au plus `concurrency` décodages simultanés', async () => {
    const samples = Array.from({ length: 8 }, (_, i) => sample(`s${i}`, i));
    let active = 0;
    let peak = 0;
    const settled: string[] = [];
    await preloadBuffers({
      samples,
      bank: null,
      activePageId: null,
      concurrency: 3,
      load: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 2));
        active -= 1;
      },
      settle: (id) => settled.push(id),
    });
    expect(settled).toHaveLength(8);
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1); // le paceur parallélise réellement
  });

  it('un échec de chargement est journalisé et le sample est QUAND MÊME réglé', async () => {
    const settled: string[] = [];
    await preloadBuffers({
      samples: [sample('ok', 1), sample('casse', 2)],
      bank: null,
      activePageId: null,
      load: async (s) => {
        if (s.id === 'casse') throw new Error('octets illisibles');
      },
      settle: (id) => settled.push(id),
    });
    expect(settled.sort()).toEqual(['casse', 'ok']); // le pad « casse » ne reste pas en loading
  });
});
