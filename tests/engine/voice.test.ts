// SPDX-License-Identifier: GPL-3.0-or-later
// Tests purs de la conversion gain dB → amplitude (voir specifications.md §7).
import { describe, it, expect } from 'vitest';
import { gainDbToAmplitude } from '../../src/engine/voice';

describe('gainDbToAmplitude', () => {
  it('0 dB = niveau d’origine (amplitude 1)', () => {
    expect(gainDbToAmplitude(0)).toBe(1);
  });

  it('-60 dB = muet (amplitude 0)', () => {
    expect(gainDbToAmplitude(-60)).toBe(0);
  });

  it('sous le plancher (-70 dB) reste muet', () => {
    expect(gainDbToAmplitude(-70)).toBe(0);
  });

  it('+6 dB ≈ ×1.995', () => {
    expect(gainDbToAmplitude(6)).toBeCloseTo(1.995, 3);
  });

  it('-6 dB ≈ ×0.501', () => {
    expect(gainDbToAmplitude(-6)).toBeCloseTo(0.501, 3);
  });

  it('est monotone croissante sur la plage utile', () => {
    const points = [-60, -40, -20, -6, 0, 6];
    const amps = points.map(gainDbToAmplitude);
    for (let i = 1; i < amps.length; i++) {
      expect(amps[i]).toBeGreaterThan(amps[i - 1] as number);
    }
  });
});
