// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du pipeline d'import et de la bibliothèque (M4). Décodage/encodage/moteur factices.
import { describe, it, expect, vi } from 'vitest';
import { createCommands } from '../../src/app/commands';
import type { AppStore } from '../../src/app/store.svelte';
import type { AudioEngine } from '../../src/engine/audio-engine';
import type { Bank, Sample } from '../../src/domain/types';
import { IMPORT_MAX_BYTES } from '../../src/domain/invariants';

function fakeStore(bank: Bank | null = null, samples: Sample[] = []): AppStore {
  return {
    bank,
    samples,
    settings: { backgroundBehavior: 'stopAll', maxVoices: 8, locale: 'fr' },
    activePageId: null,
    editMode: false,
    selectedPadId: null,
    activePadIds: new Set<string>(),
  } as unknown as AppStore;
}

function fakeEngine() {
  return {
    resume: vi.fn().mockResolvedValue(undefined),
    decode: vi.fn().mockResolvedValue({
      channelData: [new Float32Array([0, 0.5, -0.5])],
      sampleRate: 44100,
      durationMs: 1234.6,
    }),
    load: vi.fn().mockResolvedValue(undefined),
    unload: vi.fn(),
    previewSample: vi.fn(),
    stopPad: vi.fn(),
    stopPage: vi.fn(),
  };
}

function setup(opts: { store?: AppStore; encode?: (p: unknown) => Promise<Uint8Array> } = {}) {
  const store = opts.store ?? fakeStore();
  const engine = fakeEngine();
  let n = 0;
  const encode = opts.encode ?? (async () => new Uint8Array([0x4f, 0x67, 0x67, 0x53])); // "OggS"
  const commands = createCommands({
    store,
    engine: engine as unknown as AudioEngine,
    encode: encode as never,
    ids: () => `id-${n++}`,
  });
  return { store, engine, commands };
}

function sample(id: string): Sample {
  return {
    id,
    label: id,
    fileName: `${id}.ogg`,
    originalName: id,
    mime: 'audio/ogg',
    sizeBytes: 0,
    durationMs: null,
    createdAt: 0,
  };
}

describe('importSample — pipeline', () => {
  it('décode → encode → charge le ré-encodé → ajoute à la bibliothèque', async () => {
    const { store, engine, commands } = setup();
    const res = await commands.importSample('kick.wav', new ArrayBuffer(16));
    expect(res).toEqual({ ok: true, sampleId: 'id-0' });
    expect(engine.decode).toHaveBeenCalledOnce();
    expect(engine.load).toHaveBeenCalledWith('id-0', expect.any(ArrayBuffer));
    expect(store.samples).toHaveLength(1);
    expect(store.samples[0]).toMatchObject({
      id: 'id-0',
      label: 'kick.wav',
      mime: 'audio/ogg',
      fileName: 'id-0.ogg',
      durationMs: 1235, // arrondi
    });
  });

  it('refuse un fichier trop lourd (> 20 Mo) avant tout décodage', async () => {
    const { engine, commands } = setup();
    const res = await commands.importSample('big.wav', new ArrayBuffer(IMPORT_MAX_BYTES + 1));
    expect(res).toEqual({ ok: false, reason: 'tooLarge' });
    expect(engine.decode).not.toHaveBeenCalled();
  });

  it('rejette un format non décodable', async () => {
    const { store, engine, commands } = setup();
    engine.decode.mockRejectedValueOnce(new Error('nope'));
    const res = await commands.importSample('weird.bin', new ArrayBuffer(16));
    expect(res).toEqual({ ok: false, reason: 'undecodable' });
    expect(store.samples).toHaveLength(0);
  });

  it('rejette si l’encodage échoue', async () => {
    const { store, commands } = setup({
      encode: async () => {
        throw new Error('encode boom');
      },
    });
    const res = await commands.importSample('x.wav', new ArrayBuffer(16));
    expect(res).toEqual({ ok: false, reason: 'encodeFailed' });
    expect(store.samples).toHaveLength(0);
  });
});

describe('bibliothèque — preview / rename / delete', () => {
  it('previewSample délègue au moteur', () => {
    const { engine, commands } = setup();
    commands.previewSample('s1');
    expect(engine.previewSample).toHaveBeenCalledWith('s1');
  });

  it('renameSample change le label', () => {
    const store = fakeStore(null, [sample('s1')]);
    const { commands } = setup({ store });
    commands.renameSample('s1', 'Snare');
    expect(store.samples[0]!.label).toBe('Snare');
  });

  it('deleteSample retire l’entrée, décharge le buffer, mais garde le sampleId des pads (introuvable)', () => {
    const bank: Bank = {
      id: 'b',
      name: 'b',
      pages: [{ id: 'pg', name: 'P', voiceMode: 'poly', rows: 4, cols: 4, position: 0 }],
      pads: [
        { id: 'pad', pageId: 'pg', name: '', sampleId: 's1', playMode: 'oneShot', gainDb: 0, position: 0 },
      ],
    };
    const store = fakeStore(bank, [sample('s1')]);
    const { engine, commands } = setup({ store });
    commands.deleteSample('s1');
    expect(engine.unload).toHaveBeenCalledWith('s1');
    expect(store.samples).toHaveLength(0);
    expect(store.bank!.pads[0]!.sampleId).toBe('s1'); // pad devient *introuvable*, pas purgé
  });
});
