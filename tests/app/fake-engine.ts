// SPDX-License-Identifier: GPL-3.0-or-later
// Moteur factice PARTAGÉ des tests de commandes : superset des méthodes du moteur,
// surchargeable au besoin — chaque test n'assertionne que ce qui le concerne.
// (Le moteur RÉEL est testé contre le faux AudioContext, voir tests/engine/.)
import { vi } from 'vitest';
import type { AudioEngine } from '../../src/engine/audio-engine';

export function fakeEngine(overrides: Record<string, unknown> = {}) {
  return {
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    // 3 échantillons à 2 Hz = 1,5 s — la durée persistée est dérivée du PCM (M7).
    decode: vi.fn().mockResolvedValue({
      channelData: [new Float32Array([0, 0.5, -0.5])],
      sampleRate: 2,
      durationMs: 1500,
    }),
    load: vi.fn().mockResolvedValue(undefined),
    unload: vi.fn(),
    oneShot: vi.fn(),
    press: vi.fn(),
    release: vi.fn(),
    toggleLoop: vi.fn(),
    stopPad: vi.fn(),
    stopPage: vi.fn(),
    stopAll: vi.fn(),
    stopSustained: vi.fn(),
    previewSample: vi.fn((_sampleId: string, _onEnded?: () => void) => true),
    previewPcm: vi.fn(),
    stopPreview: vi.fn(),
    ...overrides,
  };
}

/** Cast unique vers le type attendu par createCommands. */
export function asEngine(engine: ReturnType<typeof fakeEngine>): AudioEngine {
  return engine as unknown as AudioEngine;
}
