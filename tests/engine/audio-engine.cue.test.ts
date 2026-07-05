// SPDX-License-Identifier: GPL-3.0-or-later
// Points cue par pad (M11) : le pad ne joue que [cueStart, cueEnd] du sample, sans toucher
// les octets. One-Shot/Gate → offset + durée bornent la lecture ; Loop → loopStart/loopEnd ;
// progress() se cale sur la fenêtre. `cueWindow` (pur) borne au buffer et retombe sur le
// sample entier si la fenêtre est vide/inversée (cue périmé).
import { describe, it, expect } from 'vitest';
import { cueWindow } from '../../src/engine/audio-engine';
import { makeEngine, bytes, pad, POLY_PAGE, type FakeSourceNode } from './fake-audio-context';

describe('cueWindow (pur)', () => {
  it('null/null = sample entier ; borne au buffer ; fenêtre inversée → entier', () => {
    expect(cueWindow(1, null, null)).toEqual([0, 1]);
    expect(cueWindow(1, 0.2, 0.7)).toEqual([0.2, expect.closeTo(0.5)]);
    expect(cueWindow(1, null, 0.4)).toEqual([0, 0.4]);
    expect(cueWindow(1, 0.6, null)).toEqual([0.6, expect.closeTo(0.4)]);
    expect(cueWindow(1, -5, 9)).toEqual([0, 1]); // débordements ramenés dans [0, durée]
    expect(cueWindow(1, 0.8, 0.3)).toEqual([0, 1]); // inversée → sample entier
  });
});

describe('lecture avec points cue', () => {
  it('One-Shot : start(0, offset, durée) borné à la fenêtre', async () => {
    const { engine, ctx } = makeEngine();
    await engine.load('sample-1', bytes()); // buffer d'1 s
    engine.oneShot(pad({ sampleId: 'sample-1', cueStart: 0.2, cueEnd: 0.7 }), POLY_PAGE);
    const source = ctx.sources[0] as FakeSourceNode;
    expect(source.startArgs[0]).toBe(0);
    expect(source.startArgs[1]).toBeCloseTo(0.2);
    expect(source.startArgs[2]).toBeCloseTo(0.5); // durée de la fenêtre
    expect(source.loop).toBe(false);
  });

  it('Loop : loopStart/loopEnd posés, start(0, offset)', async () => {
    const { engine, ctx } = makeEngine();
    await engine.load('sample-1', bytes());
    engine.toggleLoop(pad({ sampleId: 'sample-1', cueStart: 0.3, cueEnd: 0.9 }), POLY_PAGE);
    const source = ctx.sources[0] as FakeSourceNode;
    expect(source.loop).toBe(true);
    expect(source.loopStart).toBeCloseTo(0.3);
    expect(source.loopEnd).toBeCloseTo(0.9);
    expect(source.startArgs).toEqual([0, expect.closeTo(0.3)]); // pas de durée en Loop
  });

  it('sans cue : sample entier (start sans bornes de fenêtre)', async () => {
    const { engine, ctx } = makeEngine();
    await engine.load('sample-1', bytes());
    engine.oneShot(pad({ sampleId: 'sample-1' }), POLY_PAGE);
    const source = ctx.sources[0] as FakeSourceNode;
    expect(source.startArgs[1]).toBe(0);
    expect(source.startArgs[2]).toBeCloseTo(1);
  });

  it('progress() est relatif à la FENÊTRE cue, pas au sample entier', async () => {
    const { engine, ctx } = makeEngine();
    await engine.load('sample-1', bytes());
    ctx.currentTime = 0;
    engine.oneShot(pad({ id: 'p', sampleId: 'sample-1', cueStart: 0, cueEnd: 0.5 }), POLY_PAGE);
    ctx.currentTime = 0.25;
    expect(engine.progress('p')).toBeCloseTo(0.5); // 0.25 s sur une fenêtre de 0.5 s
    ctx.currentTime = 0.6;
    expect(engine.progress('p')).toBe(1); // borné
  });
});
