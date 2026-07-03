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
  /** Cibles de connect(), pour asserter la topologie du graphe (bus master). */
  connectedTo: unknown[] = [];
  connect(dest: unknown): unknown {
    this.connectedTo.push(dest);
    return dest;
  }
  disconnect(): void {}
}

export class FakeAnalyserNode {
  fftSize = 2048;
  connectedTo: unknown[] = [];
  connect(dest: unknown): unknown {
    this.connectedTo.push(dest);
    return dest;
  }
  disconnect(): void {}
  /** Onde factice reconnaissable : une rampe de -1 à +1. */
  getFloatTimeDomainData(out: Float32Array): void {
    for (let i = 0; i < out.length; i++) out[i] = (i / out.length) * 2 - 1;
  }
}

export class FakeSourceNode {
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  disconnected = false;
  connectedTo: unknown[] = [];
  connect(dest: unknown): unknown {
    this.connectedTo.push(dest);
    return dest;
  }
  disconnect(): void {
    this.disconnected = true;
  }
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
  analysers: FakeAnalyserNode[] = [];

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
  createAnalyser(): FakeAnalyserNode {
    const a = new FakeAnalyserNode();
    this.analysers.push(a);
    return a;
  }
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBuffer {
    const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    return {
      duration: length / sampleRate,
      length,
      numberOfChannels,
      sampleRate,
      getChannelData: (c: number) => channels[c],
      copyToChannel: (source: Float32Array, c: number) => channels[c]!.set(source),
    } as unknown as AudioBuffer;
  }
  async decodeAudioData(_data: ArrayBuffer): Promise<AudioBuffer> {
    this.decodeCalls++;
    // Buffer factice d'une seconde, 8 échantillons connus (sert aussi aux pics/peaks).
    const samples = new Float32Array([0, 0.5, -1, 0.25, 0.75, -0.5, 0.1, -0.9]);
    return {
      duration: 1,
      length: samples.length,
      numberOfChannels: 1,
      getChannelData: () => samples,
    } as unknown as AudioBuffer;
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
