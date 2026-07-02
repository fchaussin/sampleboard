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

describe('peaks (forme d’onde statique du sample)', () => {
  it('pic |max| par tranche (buffer factice de 8 échantillons connus)', async () => {
    const { engine } = await playingEngine();
    const peaks = engine.peaks('sample-1', 4);
    // Échantillons [0, .5, -1, .25, .75, -.5, .1, -.9] → pics par paires : .5, 1, .75, .9
    expect(peaks).not.toBeNull();
    const expected = [0.5, 1, 0.75, 0.9];
    expect(peaks!).toHaveLength(expected.length);
    for (const [i, value] of expected.entries()) {
      expect(peaks![i]).toBeCloseTo(value, 5); // float32 : 0.9 n'est pas exact
    }
  });

  it('mis en cache : le second appel renvoie le même tableau', async () => {
    const { engine } = await playingEngine();
    expect(engine.peaks('sample-1', 4)).toBe(engine.peaks('sample-1', 4));
  });

  it('null si le buffer n’est pas chargé ; cache purgé à unload', async () => {
    const { engine } = await playingEngine();
    expect(engine.peaks('inconnu', 4)).toBeNull();
    const before = engine.peaks('sample-1', 4);
    engine.unload('sample-1');
    expect(engine.peaks('sample-1', 4)).toBeNull();
    await engine.load('sample-1', bytes());
    expect(engine.peaks('sample-1', 4)).not.toBe(before); // recalculé, pas l'ancien cache
  });
});

describe('previewPcm (pré-écoute de l’éditeur audio, M7)', () => {
  it('joue le PCM via un buffer construit ; un nouvel appel remplace la lecture', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    const pcm = { channelData: [new Float32Array([0.1, 0.2])], sampleRate: 2 };
    engine.previewPcm(pcm);
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0]!.started).toBe(true);
    engine.previewPcm(pcm);
    expect(ctx.sources[0]!.stopped).toBe(true); // remplacée
    expect(ctx.sources[1]!.started).toBe(true);
  });

  it('stopPcmPreview arrête la lecture en cours (no-op sinon)', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    engine.stopPcmPreview(); // no-op
    engine.previewPcm({ channelData: [new Float32Array([0.1])], sampleRate: 1 });
    engine.stopPcmPreview();
    expect(ctx.sources[0]!.stopped).toBe(true);
  });

  it('PCM vide : aucun démarrage', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    engine.previewPcm({ channelData: [], sampleRate: 44100 });
    expect(ctx.sources).toHaveLength(0);
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
