// SPDX-License-Identifier: GPL-3.0-or-later
// Matrice de comportement §7 — M2 : Gate, Loop, Polyphonie Mono (choke), FIFO, stop.
import { describe, it, expect } from 'vitest';
import { makeEngine, bytes, pad, POLY_PAGE, MONO_PAGE, type FakeSourceNode } from './fake-audio-context';

describe('AudioEngine — Gate', () => {
  it('press démarre une voix, release l’arrête', async () => {
    const { engine, ctx } = makeEngine();
    let current = new Set<string>();
    engine.onPlayingChanged((ids) => (current = new Set(ids)));
    await engine.load('sample-1', bytes());

    engine.press(pad({ id: 'g', playMode: 'gate' }), POLY_PAGE);
    expect(ctx.sources).toHaveLength(1);
    expect(current).toEqual(new Set(['g']));

    engine.release('g');
    expect((ctx.sources[0] as FakeSourceNode).stopped).toBe(true);
    expect(current).toEqual(new Set());
  });
});

describe('AudioEngine — Loop', () => {
  it('toggle démarre en boucle, re-toggle arrête (sans nouvelle source)', async () => {
    const { engine, ctx } = makeEngine();
    await engine.load('sample-1', bytes());
    const p = pad({ id: 'l', playMode: 'loop' });

    engine.toggleLoop(p, POLY_PAGE);
    expect(ctx.sources).toHaveLength(1);
    expect((ctx.sources[0] as FakeSourceNode).loop).toBe(true);

    engine.toggleLoop(p, POLY_PAGE);
    expect((ctx.sources[0] as FakeSourceNode).stopped).toBe(true);
    expect(ctx.sources).toHaveLength(1);
  });
});

describe('AudioEngine — Polyphonie Mono (choke)', () => {
  it('démarrer un pad coupe les autres voix de la page', async () => {
    const { engine, ctx } = makeEngine();
    let current = new Set<string>();
    engine.onPlayingChanged((ids) => (current = new Set(ids)));
    await engine.load('sample-1', bytes());

    engine.oneShot(pad({ id: 'a' }), MONO_PAGE);
    engine.oneShot(pad({ id: 'b' }), MONO_PAGE);
    expect((ctx.sources[0] as FakeSourceNode).stopped).toBe(true);
    expect(current).toEqual(new Set(['b']));
  });

  it('ne coupe pas les voix d’une autre page', async () => {
    const { engine } = makeEngine();
    let current = new Set<string>();
    engine.onPlayingChanged((ids) => (current = new Set(ids)));
    await engine.load('sample-1', bytes());

    engine.oneShot(pad({ id: 'x' }), MONO_PAGE);
    engine.oneShot(pad({ id: 'y' }), { ...MONO_PAGE, id: 'mono-2' });
    expect(current).toEqual(new Set(['x', 'y']));
  });
});

describe('AudioEngine — plafond de voix (FIFO)', () => {
  it('au-delà du plafond, retire la voix la plus ancienne', async () => {
    const { engine, ctx } = makeEngine({ maxVoices: 2 });
    let current = new Set<string>();
    engine.onPlayingChanged((ids) => (current = new Set(ids)));
    await engine.load('sample-1', bytes());

    engine.oneShot(pad({ id: 'a' }), POLY_PAGE);
    engine.oneShot(pad({ id: 'b' }), POLY_PAGE);
    engine.oneShot(pad({ id: 'c' }), POLY_PAGE);

    expect((ctx.sources[0] as FakeSourceNode).stopped).toBe(true); // 'a' = la plus ancienne
    expect(current).toEqual(new Set(['b', 'c']));
  });
});

describe('AudioEngine — stopPad / stopPage', () => {
  it('stopPad arrête les voix du pad', async () => {
    const { engine, ctx } = makeEngine();
    let current = new Set<string>();
    engine.onPlayingChanged((ids) => (current = new Set(ids)));
    await engine.load('sample-1', bytes());

    engine.oneShot(pad({ id: 'a' }), POLY_PAGE);
    engine.stopPad('a');
    expect((ctx.sources[0] as FakeSourceNode).stopped).toBe(true);
    expect(current).toEqual(new Set());
  });

  it('stopPage arrête les voix de la page, pas des autres', async () => {
    const { engine } = makeEngine();
    let current = new Set<string>();
    engine.onPlayingChanged((ids) => (current = new Set(ids)));
    await engine.load('sample-1', bytes());

    engine.oneShot(pad({ id: 'a' }), POLY_PAGE);
    engine.oneShot(pad({ id: 'b' }), POLY_PAGE);
    engine.oneShot(pad({ id: 'c' }), { ...POLY_PAGE, id: 'other' });

    engine.stopPage(POLY_PAGE.id);
    expect(current).toEqual(new Set(['c']));
  });
});
