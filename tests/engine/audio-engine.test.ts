// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du moteur audio — contexte, cache, One-Shot, reflet des voix (voir §7). M1.
import { describe, it, expect } from 'vitest';
import { makeEngine, bytes, pad, POLY_PAGE, type FakeSourceNode, type FakeGainNode } from './fake-audio-context';

describe('AudioEngine — contexte & autoplay', () => {
  it('démarre à l’état suspended tant qu’aucun contexte n’existe', () => {
    const { engine } = makeEngine();
    expect(engine.state).toBe('suspended');
  });

  it('resume() crée/reprend le contexte (running)', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    expect(ctx.resumeCalls).toBe(1);
    expect(engine.state).toBe('running');
  });

  it('resume() est idempotent : pas de second resume si déjà running', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    await engine.resume();
    expect(ctx.resumeCalls).toBe(1);
    expect(engine.state).toBe('running');
  });
});

describe('AudioEngine — cache de buffers', () => {
  it('load() décode et met en cache par sampleId', async () => {
    const { engine, ctx } = makeEngine();
    expect(engine.isLoaded('sample-1')).toBe(false);
    await engine.load('sample-1', bytes());
    expect(ctx.decodeCalls).toBe(1);
    expect(engine.isLoaded('sample-1')).toBe(true);
  });

  it('unload() retire le buffer du cache', async () => {
    const { engine } = makeEngine();
    await engine.load('sample-1', bytes());
    engine.unload('sample-1');
    expect(engine.isLoaded('sample-1')).toBe(false);
  });
});

describe('AudioEngine — One-Shot', () => {
  it('joue le buffer : source branchée, démarrée, gain = amplitude du gainDb', async () => {
    const { engine, ctx } = makeEngine();
    await engine.load('sample-1', bytes());
    engine.oneShot(pad({ gainDb: 0 }), POLY_PAGE);

    expect(ctx.sources).toHaveLength(1);
    expect((ctx.sources[0] as FakeSourceNode).started).toBe(true);
    expect((ctx.gains[0] as FakeGainNode).gain.value).toBe(1);
  });

  it('applique l’amplitude linéaire d’un gain négatif', async () => {
    const { engine, ctx } = makeEngine();
    await engine.load('sample-1', bytes());
    engine.oneShot(pad({ gainDb: -60 }), POLY_PAGE);
    expect((ctx.gains[0] as FakeGainNode).gain.value).toBe(0);
  });

  it('no-op silencieux si le pad est vide (sampleId null)', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    engine.oneShot(pad({ sampleId: null }), POLY_PAGE);
    expect(ctx.sources).toHaveLength(0);
  });

  it('no-op silencieux si le buffer n’est pas chargé', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    engine.oneShot(pad({ sampleId: 'absent' }), POLY_PAGE);
    expect(ctx.sources).toHaveLength(0);
  });

  it('re-tap : arrête la propre voix du pad avant d’en relancer une', async () => {
    const { engine, ctx } = makeEngine();
    await engine.load('sample-1', bytes());
    engine.oneShot(pad(), POLY_PAGE);
    engine.oneShot(pad(), POLY_PAGE);
    expect(ctx.sources).toHaveLength(2);
    expect((ctx.sources[0] as FakeSourceNode).stopped).toBe(true);
    expect((ctx.sources[1] as FakeSourceNode).started).toBe(true);
  });
});

describe('AudioEngine — reflet des voix actives (onPlayingChanged)', () => {
  it('notifie le pad qui joue au démarrage, puis l’ensemble vide à la fin', async () => {
    const { engine, ctx } = makeEngine();
    const seen: Array<Set<string>> = [];
    engine.onPlayingChanged((ids) => seen.push(new Set(ids)));

    await engine.load('sample-1', bytes());
    engine.oneShot(pad({ id: 'pad-A' }), POLY_PAGE);
    expect(seen.at(-1)).toEqual(new Set(['pad-A']));

    (ctx.sources[0] as FakeSourceNode).fireEnded();
    expect(seen.at(-1)).toEqual(new Set());
  });

  it('reflète deux pads simultanés en page Poly', async () => {
    const { engine } = makeEngine();
    let current = new Set<string>();
    engine.onPlayingChanged((ids) => {
      current = ids;
    });

    await engine.load('sample-1', bytes());
    engine.oneShot(pad({ id: 'pad-A' }), POLY_PAGE);
    engine.oneShot(pad({ id: 'pad-B' }), POLY_PAGE);
    expect(current).toEqual(new Set(['pad-A', 'pad-B']));
  });
});
