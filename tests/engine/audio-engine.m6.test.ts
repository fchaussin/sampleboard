// SPDX-License-Identifier: GPL-3.0-or-later
// Tests moteur M6 : point d'écoute par voix pour les visualiseurs (analyser + waveform()).
import { describe, it, expect } from 'vitest';
import { WAVEFORM_SIZE } from '../../src/engine/audio-engine';
import { makeEngine, bytes, pad, POLY_PAGE } from './fake-audio-context';

async function playingEngine() {
  const { engine, ctx } = makeEngine();
  await engine.resume();
  await engine.load('sample-1', bytes());
  engine.oneShot(pad({ id: 'p1' }), POLY_PAGE);
  return { engine, ctx };
}

describe('waveform (visualiseurs)', () => {
  it('chaque voix est branchée sur un analyseur à la taille WAVEFORM_SIZE', async () => {
    const { ctx } = await playingEngine();
    expect(ctx.analysers).toHaveLength(1);
    expect(ctx.analysers[0]!.fftSize).toBe(WAVEFORM_SIZE);
  });

  it('remplit le tampon et renvoie true pendant la lecture', async () => {
    const { engine } = await playingEngine();
    const out = new Float32Array(WAVEFORM_SIZE);
    expect(engine.waveform('p1', out)).toBe(true);
    expect(out[0]).toBeCloseTo(-1); // rampe factice du FakeAnalyserNode
    expect(out[WAVEFORM_SIZE - 1]).toBeGreaterThan(0.9);
  });

  it('renvoie false pour un pad qui ne joue pas (et ne touche pas le tampon)', async () => {
    const { engine } = await playingEngine();
    const out = new Float32Array(WAVEFORM_SIZE);
    expect(engine.waveform('fantome', out)).toBe(false);
    expect(out[0]).toBe(0);
  });

  it('après stop, la voix disparaît du point d’écoute', async () => {
    const { engine } = await playingEngine();
    engine.stopPad('p1');
    expect(engine.waveform('p1', new Float32Array(WAVEFORM_SIZE))).toBe(false);
  });
});

describe('progress (barre d’avancement)', () => {
  it('One-Shot : avancement borné à 1 (buffer factice d’une seconde)', async () => {
    const { engine, ctx } = await playingEngine();
    ctx.currentTime = 0.5;
    expect(engine.progress('p1')).toBeCloseTo(0.5);
    ctx.currentTime = 2;
    expect(engine.progress('p1')).toBe(1);
  });

  it('Loop : position dans le cycle courant (modulo la durée)', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    await engine.load('sample-1', bytes());
    engine.toggleLoop(pad({ id: 'p1', playMode: 'loop' }), POLY_PAGE);
    ctx.currentTime = 2.25;
    expect(engine.progress('p1')).toBeCloseTo(0.25);
  });

  it('null pour un pad qui ne joue pas', async () => {
    const { engine } = await playingEngine();
    expect(engine.progress('fantome')).toBeNull();
  });
});
