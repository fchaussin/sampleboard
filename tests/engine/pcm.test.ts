// SPDX-License-Identifier: GPL-3.0-or-later
// Tests des opérations PCM pures (M7 — « découper ») : durée, pics, bornage, rognage.
import { describe, it, expect } from 'vitest';
import { clampSelection, computePeaks, pcmDuration, trimPcm, TRIM_MIN_S } from '../../src/engine/pcm';
import type { PcmData } from '../../src/engine/encoder';

function pcm(samples: number[], sampleRate = 8): PcmData {
  return { channelData: [new Float32Array(samples)], sampleRate };
}

describe('pcmDuration', () => {
  it('longueur / fréquence ; 0 si vide', () => {
    expect(pcmDuration(pcm([1, 2, 3, 4], 4))).toBe(1);
    expect(pcmDuration({ channelData: [], sampleRate: 44100 })).toBe(0);
  });
});

describe('computePeaks', () => {
  it('|max| par tranche, tous canaux confondus', () => {
    const two: PcmData = {
      sampleRate: 8,
      channelData: [new Float32Array([0, 0.5, -1, 0.25]), new Float32Array([0.9, 0, 0, 0])],
    };
    const peaks = computePeaks(two.channelData, 2);
    expect(peaks[0]).toBeCloseTo(0.9, 5); // max(|0|,|0.5|,|0.9|,|0|)
    expect(peaks[1]).toBeCloseTo(1, 5);
  });

  it('buckets invalides ou PCM vide → tableau de zéros', () => {
    expect(computePeaks([], 4)).toHaveLength(4);
    expect(Array.from(computePeaks([new Float32Array(0)], 2))).toEqual([0, 0]);
  });
});

describe('clampSelection', () => {
  const p = pcm(Array.from({ length: 80 }, () => 0), 8); // 10 s

  it('borne aux limites et rétablit l’ordre', () => {
    expect(clampSelection(p, -5, 99)).toEqual({ start: 0, end: 10 });
    expect(clampSelection(p, 8, 2)).toEqual({ start: 2, end: 8 });
  });

  it('impose la durée minimale', () => {
    const { start, end } = clampSelection(p, 5, 5);
    expect(end - start).toBeCloseTo(TRIM_MIN_S, 6);
  });
});

describe('trimPcm', () => {
  it('rogne aux échantillons de la sélection', () => {
    const source = pcm([0, 1, 2, 3, 4, 5, 6, 7], 8); // 1 s
    const out = trimPcm(source, 0.25, 0.75);
    expect(Array.from(out.channelData[0]!)).toEqual([2, 3, 4, 5]);
    expect(out.sampleRate).toBe(8);
  });

  it('sélection pleine = copie intégrale ; source intacte', () => {
    const source = pcm([1, 2, 3, 4], 4);
    const out = trimPcm(source, 0, 1);
    expect(Array.from(out.channelData[0]!)).toEqual([1, 2, 3, 4]);
    expect(out.channelData[0]).not.toBe(source.channelData[0]);
  });

  it('multi-canaux : chaque canal est rogné identiquement', () => {
    const source: PcmData = {
      sampleRate: 4,
      channelData: [new Float32Array([1, 2, 3, 4]), new Float32Array([5, 6, 7, 8])],
    };
    const out = trimPcm(source, 0.5, 1);
    expect(Array.from(out.channelData[0]!)).toEqual([3, 4]);
    expect(Array.from(out.channelData[1]!)).toEqual([7, 8]);
  });
});
