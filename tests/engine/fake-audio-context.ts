// SPDX-License-Identifier: GPL-3.0-or-later
// AudioContext factice pour les tests du moteur : simule Web Audio sans navigateur.
// Injecté via `AudioEngine({ createContext })` ; enregistre les nœuds créés pour assertions.
import { vi } from 'vitest';
import { AudioEngine, type AudioEngineOptions } from '../../src/engine/audio-engine';
import type { Pad, Page } from '../../src/domain/types';

export class FakeParam {
  value = 1;
  cancelScheduledValues = vi.fn();
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
}

export class FakeGainNode {
  gain = new FakeParam();
  connect(dest: unknown): unknown {
    return dest;
  }
  disconnect(): void {}
}

export class FakeSourceNode {
  buffer: unknown = null;
  loop = false;
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

export class FakeAudioContext {
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
  suspendCalls = 0;
  async suspend(): Promise<void> {
    this.suspendCalls++;
    this.state = 'suspended';
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

export function makeEngine(opts: { maxVoices?: number } = {}): {
  engine: AudioEngine;
  ctx: FakeAudioContext;
} {
  const ctx = new FakeAudioContext();
  const options: AudioEngineOptions = { createContext: () => ctx as unknown as AudioContext };
  if (opts.maxVoices !== undefined) {
    const n = opts.maxVoices;
    options.getMaxVoices = () => n;
  }
  return { engine: new AudioEngine(options), ctx };
}

/** ArrayBuffer bidon pour `load`. */
export function bytes(): ArrayBuffer {
  return new ArrayBuffer(8);
}

export const POLY_PAGE: Page = {
  id: 'poly',
  name: 'poly',
  voiceMode: 'poly',
  rows: 4,
  cols: 4,
  position: 0,
  color: null,
};

export const MONO_PAGE: Page = { ...POLY_PAGE, id: 'mono', voiceMode: 'mono', position: 1 };

export function pad(overrides: Partial<Pad> = {}): Pad {
  return {
    id: 'pad-1',
    pageId: 'poly',
    name: 'pad',
    sampleId: 'sample-1',
    playMode: 'oneShot',
    gainDb: 0,
    position: 0,
    color: null,
    ...overrides,
  };
}
