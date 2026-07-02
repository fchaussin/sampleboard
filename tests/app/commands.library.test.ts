// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du pipeline d'import et de la bibliothèque (M4). Décodage/encodage/moteur factices.
import { describe, it, expect, vi } from 'vitest';
import { createCommands } from '../../src/app/commands';
import type { AppStore } from '../../src/app/store.svelte';
import type { AudioEngine } from '../../src/engine/audio-engine';
import type { Bank, Sample } from '../../src/domain/types';
import { IMPORT_MAX_BYTES } from '../../src/domain/invariants';
import { fakeSampleRepository, fakeTagRepository } from './fake-sample-repository';

function fakeStore(bank: Bank | null = null, samples: Sample[] = []): AppStore {
  return {
    bank,
    samples,
    settings: { backgroundBehavior: 'stopAll', maxVoices: 8, locale: 'fr' },
    activePageId: null,
    editMode: false,
    selectedPadId: null,
    tags: [],
    sampleTags: new Map<string, Set<string>>(),
    libraryFilter: null,
    activePadIds: new Set<string>(),
  } as unknown as AppStore;
}

function fakeEngine() {
  return {
    resume: vi.fn().mockResolvedValue(undefined),
    // 3 échantillons à 2 Hz = 1,5 s — la durée persistée est dérivée du PCM (M7).
    decode: vi.fn().mockResolvedValue({
      channelData: [new Float32Array([0, 0.5, -0.5])],
      sampleRate: 2,
      durationMs: 1500,
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
  const sampleRepository = fakeSampleRepository();
  let n = 0;
  const encode = opts.encode ?? (async () => new Uint8Array([0x4f, 0x67, 0x67, 0x53])); // "OggS"
  const commands = createCommands({
    store,
    engine: engine as unknown as AudioEngine,
    encode: encode as never,
    sampleRepository,
    tagRepository: fakeTagRepository(),
    ids: () => `id-${n++}`,
    now: () => 1_700_000_000_000,
  });
  return { store, engine, commands, sampleRepository };
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
  it('décode → encode → charge le ré-encodé → écrit sur disque → ajoute à la bibliothèque', async () => {
    const { store, engine, commands, sampleRepository } = setup();
    const res = await commands.importSample('kick.wav', new ArrayBuffer(16));
    expect(res).toEqual({ ok: true, sampleId: 'id-0' });
    expect(engine.decode).toHaveBeenCalledOnce();
    expect(engine.load).toHaveBeenCalledWith('id-0', expect.any(ArrayBuffer));
    // Écriture immédiate (§9) : le fichier ré-encodé + la ligne samples, hors debounce.
    expect(sampleRepository.add).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'id-0', fileName: 'id-0.ogg' }),
      expect.any(Uint8Array),
    );
    expect(store.samples).toHaveLength(1);
    expect(store.samples[0]).toMatchObject({
      id: 'id-0',
      label: 'kick.wav',
      mime: 'audio/ogg',
      fileName: 'id-0.ogg',
      durationMs: 1500, // dérivée du PCM (3 échantillons à 2 Hz)
      createdAt: 1_700_000_000_000, // horloge injectée
    });
  });

  it('échec d’écriture sur disque → writeFailed, rien en bibliothèque, buffer déchargé', async () => {
    const { store, engine, commands, sampleRepository } = setup();
    sampleRepository.add.mockRejectedValueOnce(new Error('disk boom'));
    const res = await commands.importSample('kick.wav', new ArrayBuffer(16));
    expect(res).toEqual({ ok: false, reason: 'writeFailed' });
    expect(store.samples).toHaveLength(0);
    expect(engine.unload).toHaveBeenCalledWith('id-0');
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

  it('renameSample change le label et écrit immédiatement via le dépôt', () => {
    const store = fakeStore(null, [sample('s1')]);
    const { commands, sampleRepository } = setup({ store });
    commands.renameSample('s1', 'Snare');
    expect(store.samples[0]!.label).toBe('Snare');
    expect(sampleRepository.rename).toHaveBeenCalledWith('s1', 'Snare');
  });

  it('renameSample ignore un sample inconnu (aucune écriture)', () => {
    const store = fakeStore(null, [sample('s1')]);
    const { commands, sampleRepository } = setup({ store });
    commands.renameSample('inconnu', 'X');
    expect(sampleRepository.rename).not.toHaveBeenCalled();
  });

  it('deleteSample retire l’entrée, décharge le buffer, vide le sampleId des pads (§8) et supprime du disque', () => {
    const bank: Bank = {
      id: 'b',
      name: 'b',
      pages: [{ id: 'pg', name: 'P', voiceMode: 'poly', rows: 4, cols: 4, position: 0, color: null }],
      pads: [
        { id: 'pad', pageId: 'pg', name: '', sampleId: 's1', playMode: 'oneShot', gainDb: 0, position: 0, color: null },
        { id: 'autre', pageId: 'pg', name: '', sampleId: 's2', playMode: 'oneShot', gainDb: 0, position: 1, color: null },
      ],
    };
    const store = fakeStore(bank, [sample('s1'), sample('s2')]);
    const { engine, commands, sampleRepository } = setup({ store });
    commands.deleteSample('s1');
    expect(engine.unload).toHaveBeenCalledWith('s1');
    expect(store.samples.map((s) => s.id)).toEqual(['s2']);
    // Miroir en mémoire du ON DELETE SET NULL (§8) : le pad impacté devient *vide*.
    expect(store.bank!.pads[0]!.sampleId).toBeNull();
    expect(store.bank!.pads[1]!.sampleId).toBe('s2'); // les autres pads sont intacts
    expect(sampleRepository.remove).toHaveBeenCalledWith('s1');
  });

  it('deleteSample ignore un sample inconnu (aucune écriture)', () => {
    const store = fakeStore(null, [sample('s1')]);
    const { commands, sampleRepository } = setup({ store });
    commands.deleteSample('inconnu');
    expect(store.samples).toHaveLength(1);
    expect(sampleRepository.remove).not.toHaveBeenCalled();
  });
});
