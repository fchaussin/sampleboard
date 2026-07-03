// SPDX-License-Identifier: GPL-3.0-or-later
// Tests de la commande seedFactorySample (#14) : copie des octets OGG SANS réencodage
// (l'encodeur ne doit JAMAIS être appelé), libellé curaté, durée dérivée du PCM décodé,
// échec d'écriture → déchargement moteur et résultat writeFailed.
import { describe, it, expect, vi } from 'vitest';
import { createCommands } from '../../src/app/commands';
import type { AppStore } from '../../src/app/store.svelte';
import type { AudioEngine } from '../../src/engine/audio-engine';
import { fakeSampleRepository, fakeTagRepository } from './fake-sample-repository';

function fakeStore(): AppStore {
  return {
    bank: null,
    samples: [],
    settings: { backgroundBehavior: 'stopAll', maxVoices: 8, locale: 'fr' },
    tags: [],
    sampleTags: new Map<string, Set<string>>(),
    poolSampleIds: [],
    activePadIds: new Set<string>(),
    batchImport: null,
  } as unknown as AppStore;
}

function setup() {
  const store = fakeStore();
  const engine = {
    resume: vi.fn().mockResolvedValue(undefined),
    decode: vi.fn().mockResolvedValue({
      // 3 échantillons à 2 Hz → 1500 ms.
      channelData: [new Float32Array([0, 0.5, -0.5])],
      sampleRate: 2,
    }),
    load: vi.fn().mockResolvedValue(undefined),
    unload: vi.fn(),
  };
  const encode = vi.fn();
  const sampleRepository = fakeSampleRepository();
  let n = 0;
  const commands = createCommands({
    store,
    engine: engine as unknown as AudioEngine,
    encode: encode as never,
    sampleRepository,
    tagRepository: fakeTagRepository(),
    ids: () => `id-${n++}`,
    now: () => 1_700_000_000_000,
  });
  return { store, engine, encode, commands, sampleRepository };
}

describe('seedFactorySample', () => {
  it('copie les octets tels quels, libellé curaté, durée du PCM — sans JAMAIS réencoder', async () => {
    const { store, engine, encode, commands } = setup();
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;

    const result = await commands.seedFactorySample('brut.ogg', 'Libellé curaté', bytes);

    expect(result).toEqual({ ok: true, sampleId: 'id-0' });
    expect(encode).not.toHaveBeenCalled();
    expect(engine.load).toHaveBeenCalledOnce();
    const sample = store.samples[0]!;
    expect(sample.label).toBe('Libellé curaté');
    expect(sample.originalName).toBe('brut.ogg');
    expect(sample.fileName).toBe('id-0.ogg');
    expect(sample.sizeBytes).toBe(4);
    expect(sample.durationMs).toBe(1500);
  });

  it('rejette un fichier indécodable sans toucher à la bibliothèque', async () => {
    const { store, engine, commands } = setup();
    engine.decode.mockRejectedValueOnce(new Error('nope'));
    const result = await commands.seedFactorySample('x.ogg', 'X', new ArrayBuffer(4));
    expect(result).toEqual({ ok: false, reason: 'undecodable' });
    expect(store.samples).toEqual([]);
  });

  it("décharge le moteur et signale writeFailed si l'écriture échoue", async () => {
    const { store, engine, commands, sampleRepository } = setup();
    sampleRepository.add.mockRejectedValueOnce(new Error('disque plein'));
    const result = await commands.seedFactorySample('x.ogg', 'X', new ArrayBuffer(4));
    expect(result).toEqual({ ok: false, reason: 'writeFailed' });
    expect(engine.unload).toHaveBeenCalledWith('id-0');
    expect(store.samples).toEqual([]);
  });
});
