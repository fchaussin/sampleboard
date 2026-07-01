// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du moteur audio (voir specifications.md §7). Web Audio simulé par un AudioContext
// factice injecté : on vérifie la logique (contexte, cache, One-Shot, reflet des voix)
// sans dépendre d'un navigateur.
import { describe, it, expect, vi } from 'vitest';
import { AudioEngine } from '../../src/engine/audio-engine';
import type { Pad, Page } from '../../src/domain/types';

// --- AudioContext factice ------------------------------------------------------------------
class FakeParam {
  value = 1;
  cancelScheduledValues = vi.fn();
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
}

class FakeGainNode {
  gain = new FakeParam();
  connect(dest: unknown): unknown {
    return dest;
  }
  disconnect(): void {}
}

class FakeSourceNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  connect(dest: unknown): unknown {
    return dest;
  }
  disconnect(): void {}
  start(): void {
    this.started = true;
  }
  stop(): void {
    this.stopped = true;
  }
  /** Helper test : simule la fin naturelle de la lecture. */
  fireEnded(): void {
    this.onended?.();
  }
}

class FakeAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = {} as AudioNode;
  resumeCalls = 0;
  decodeCalls = 0;
  sources: FakeSourceNode[] = [];
  gains: FakeGainNode[] = [];

  async resume(): Promise<void> {
    this.resumeCalls++;
    this.state = 'running';
  }
  createGain(): FakeGainNode {
    const g = new FakeGainNode();
    this.gains.push(g);
    return g;
  }
  createBufferSource(): FakeSourceNode {
    const s = new FakeSourceNode();
    this.sources.push(s);
    return s;
  }
  async decodeAudioData(_data: ArrayBuffer): Promise<AudioBuffer> {
    this.decodeCalls++;
    return { duration: 1 } as AudioBuffer;
  }
}

function makeEngine(): { engine: AudioEngine; ctx: FakeAudioContext } {
  const ctx = new FakeAudioContext();
  const engine = new AudioEngine({ createContext: () => ctx as unknown as AudioContext });
  return { engine, ctx };
}

const PAGE: Page = { id: 'p', name: 'p', voiceMode: 'poly', rows: 4, cols: 4, position: 0 };

function pad(overrides: Partial<Pad> = {}): Pad {
  return {
    id: 'pad-1',
    pageId: 'p',
    name: 'pad',
    sampleId: 'sample-1',
    playMode: 'oneShot',
    gainDb: 0,
    position: 0,
    ...overrides,
  };
}
// -------------------------------------------------------------------------------------------

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
    await engine.load('sample-1', new ArrayBuffer(8));
    expect(ctx.decodeCalls).toBe(1);
    expect(engine.isLoaded('sample-1')).toBe(true);
  });

  it('unload() retire le buffer du cache', async () => {
    const { engine } = makeEngine();
    await engine.load('sample-1', new ArrayBuffer(8));
    engine.unload('sample-1');
    expect(engine.isLoaded('sample-1')).toBe(false);
  });
});

describe('AudioEngine — One-Shot', () => {
  it('joue le buffer : source branchée, démarrée, gain = amplitude du gainDb', async () => {
    const { engine, ctx } = makeEngine();
    await engine.load('sample-1', new ArrayBuffer(8));
    engine.oneShot(pad({ gainDb: 0 }), PAGE);

    expect(ctx.sources).toHaveLength(1);
    const source = ctx.sources[0] as FakeSourceNode;
    expect(source.started).toBe(true);
    expect((ctx.gains[0] as FakeGainNode).gain.value).toBe(1);
  });

  it('applique l’amplitude linéaire d’un gain négatif', async () => {
    const { engine, ctx } = makeEngine();
    await engine.load('sample-1', new ArrayBuffer(8));
    engine.oneShot(pad({ gainDb: -60 }), PAGE);
    expect((ctx.gains[0] as FakeGainNode).gain.value).toBe(0);
  });

  it('no-op silencieux si le pad est vide (sampleId null)', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    engine.oneShot(pad({ sampleId: null }), PAGE);
    expect(ctx.sources).toHaveLength(0);
  });

  it('no-op silencieux si le buffer n’est pas chargé', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    engine.oneShot(pad({ sampleId: 'absent' }), PAGE);
    expect(ctx.sources).toHaveLength(0);
  });

  it('re-tap : arrête la propre voix du pad avant d’en relancer une', async () => {
    const { engine, ctx } = makeEngine();
    await engine.load('sample-1', new ArrayBuffer(8));
    engine.oneShot(pad(), PAGE);
    engine.oneShot(pad(), PAGE);
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

    await engine.load('sample-1', new ArrayBuffer(8));
    engine.oneShot(pad({ id: 'pad-A' }), PAGE);
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

    await engine.load('sample-1', new ArrayBuffer(8));
    engine.oneShot(pad({ id: 'pad-A' }), PAGE);
    engine.oneShot(pad({ id: 'pad-B' }), PAGE);
    expect(current).toEqual(new Set(['pad-A', 'pad-B']));
  });
});
