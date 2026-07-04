// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du flux éditeur audio M7 (« découper ») : begin → preview → apply/cancel,
// en import comme en retravail. Store, moteur, encodeur et dépôt factices.
import { describe, it, expect, vi } from 'vitest';
import { createCommands } from '../../src/app/commands';
import type { ViewId } from '../../src/app/navigation';
import type { AppStore } from '../../src/app/store.svelte';
import type { Bank, Sample } from '../../src/domain/types';
import { IMPORT_MAX_BYTES } from '../../src/domain/invariants';
import { fakeSampleRepository, fakeTagRepository } from './fake-sample-repository';
import { asEngine, fakeEngine } from './fake-engine';

function makeBank(): Bank {
  return {
    id: 'b',
    name: 'b',
    pages: [{ id: 'pg', name: 'P', voiceMode: 'poly', rows: 4, cols: 4, position: 0, color: null }],
    pads: [
      { id: 'pad', pageId: 'pg', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 0, color: null },
    ],
  };
}

function sample(id: string): Sample {
  return {
    id,
    label: `${id}.wav`,
    fileName: `${id}.ogg`,
    originalName: `${id}.wav`,
    mime: 'audio/ogg',
    sizeBytes: 4,
    durationMs: 1000,
    createdAt: 0,
  };
}

function fakeStore(samples: Sample[] = []): AppStore {
  const store = {
    bank: makeBank(),
    samples,
    settings: { backgroundBehavior: 'stopAll', maxVoices: 8, locale: 'fr' },
    activePageId: 'pg',
    editMode: true,
    selectedPadId: null,
    drawer: null,
    view: 'board' as ViewId,
    get libraryOpen() {
      return store.view === 'library';
    },
    audioEditor: null,
    tags: [],
    sampleTags: new Map<string, Set<string>>(),
    libraryFilter: null,
    assigningSampleId: null,
    poolSampleIds: [],
    poolOpen: false,
    activePadIds: new Set<string>(),
  };
  return store as unknown as AppStore;
}

function setup(samples: Sample[] = []) {
  const store = fakeStore(samples);
  const engine = fakeEngine({
    // 1 s à 8 Hz : 8 échantillons — le rognage se vérifie à l'échantillon près.
    decode: vi.fn().mockResolvedValue({
      channelData: [new Float32Array([0, 1, 2, 3, 4, 5, 6, 7])],
      sampleRate: 8,
      durationMs: 1000,
    }),
  });
  const sampleRepository = fakeSampleRepository();
  const encode = vi.fn(async (pcm: { channelData: Float32Array[] }) =>
    new Uint8Array(pcm.channelData[0]!.length), // taille = nb d'échantillons (traceur)
  );
  let n = 0;
  const commands = createCommands({
    store,
    engine: asEngine(engine),
    encode: encode as never,
    sampleRepository,
    tagRepository: fakeTagRepository(),
    ids: () => `id-${n++}`,
    now: () => 42,
  });
  return { store, engine, commands, sampleRepository, encode };
}

describe('beginImport', () => {
  it('décode et ouvre l’éditeur (session import, pad à assigner mémorisé)', async () => {
    const { store, commands } = setup();
    const error = await commands.beginImport('kick.wav', new ArrayBuffer(8), 'pad');
    expect(error).toBeNull();
    expect(store.audioEditor).toMatchObject({ mode: 'import', fileName: 'kick.wav', assignPadId: 'pad' });
    expect(store.audioEditor!.pcm.sampleRate).toBe(8);
  });

  it("option addToPool (modale d'import) : le sample validé rejoint le pool", async () => {
    const { store, commands } = setup();
    await commands.beginImport('kick.wav', new ArrayBuffer(8), null, true);
    expect(store.audioEditor).toMatchObject({ addToPool: true });
    const result = await commands.applyAudioEditor(0, 1);
    expect(result.ok).toBe(true);
    expect(store.poolSampleIds).toEqual(['id-0']);
  });

  it('garde de taille et de décodage', async () => {
    const { store, engine, commands } = setup();
    expect(await commands.beginImport('big.wav', new ArrayBuffer(IMPORT_MAX_BYTES + 1))).toBe('tooLarge');
    engine.decode.mockRejectedValueOnce(new Error('nope'));
    expect(await commands.beginImport('bad.bin', new ArrayBuffer(4))).toBe('undecodable');
    expect(store.audioEditor).toBeNull();
  });
});

describe('previewEditorSelection / cancelAudioEditor', () => {
  it('pré-écoute la sélection ROGNÉE ; cancel stoppe et referme', async () => {
    const { store, engine, commands } = setup();
    await commands.beginImport('kick.wav', new ArrayBuffer(8));
    commands.previewEditorSelection(0.25, 0.75);
    const pcm = engine.previewPcm.mock.calls[0]![0] as { channelData: Float32Array[] };
    expect(Array.from(pcm.channelData[0]!)).toEqual([2, 3, 4, 5]);
    commands.cancelAudioEditor();
    expect(engine.stopPreview).toHaveBeenCalled();
    expect(store.audioEditor).toBeNull();
  });
});

describe('applyAudioEditor — import', () => {
  it('rogne, encode, entre en bibliothèque, assigne le pad et referme', async () => {
    const { store, commands, encode, sampleRepository } = setup();
    await commands.beginImport('kick.wav', new ArrayBuffer(8), 'pad');
    const result = await commands.applyAudioEditor(0.25, 0.75);
    expect(result).toEqual({ ok: true, sampleId: 'id-0' });
    // L'encodeur a reçu le PCM rogné (4 échantillons sur 8).
    expect((encode.mock.calls[0]![0] as { channelData: Float32Array[] }).channelData[0]).toHaveLength(4);
    expect(sampleRepository.add).toHaveBeenCalled();
    expect(store.samples[0]).toMatchObject({ id: 'id-0', durationMs: 500, sizeBytes: 4 });
    expect(store.bank!.pads[0]!.sampleId).toBe('id-0'); // assigné
    expect(store.bank!.pads[0]!.name).toBe('kick'); // nom par défaut depuis le label
    expect(store.audioEditor).toBeNull();
  });

  it('échec d’écriture : writeFailed et l’éditeur RESTE ouvert', async () => {
    const { store, commands, sampleRepository } = setup();
    sampleRepository.add.mockRejectedValueOnce(new Error('disk boom'));
    await commands.beginImport('kick.wav', new ArrayBuffer(8));
    const result = await commands.applyAudioEditor(0, 1);
    expect(result).toEqual({ ok: false, reason: 'writeFailed' });
    expect(store.audioEditor).not.toBeNull();
  });

  it('sans session ouverte : readFailed', async () => {
    const { commands } = setup();
    expect(await commands.applyAudioEditor(0, 1)).toEqual({ ok: false, reason: 'readFailed' });
  });
});

describe('beginSampleRework / applyAudioEditor — retravail', () => {
  it('relit, re-décode, remplace (mêmes id et fichier) et met la bibliothèque à jour', async () => {
    const s1 = sample('s1');
    const { store, engine, commands, sampleRepository } = setup([s1]);
    sampleRepository.readBytes.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));

    expect(await commands.beginSampleRework('s1')).toBeNull();
    expect(store.audioEditor).toMatchObject({ mode: 'rework', fileName: 's1.wav' });

    const result = await commands.applyAudioEditor(0, 0.5); // garde 4 échantillons
    expect(result).toEqual({ ok: true, sampleId: 's1' });
    expect(engine.unload).toHaveBeenCalledWith('s1'); // purge buffer + pics
    expect(engine.load).toHaveBeenCalledWith('s1', expect.any(ArrayBuffer));
    expect(sampleRepository.replace).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1', fileName: 's1.ogg', durationMs: 500, sizeBytes: 4 }),
      expect.any(Uint8Array),
    );
    expect(store.samples[0]).toMatchObject({ durationMs: 500, sizeBytes: 4 });
    expect(store.audioEditor).toBeNull();
  });

  it('sample inconnu ou octets illisibles : readFailed', async () => {
    const { commands, sampleRepository } = setup([sample('s1')]);
    expect(await commands.beginSampleRework('fantome')).toBe('readFailed');
    sampleRepository.readBytes.mockRejectedValueOnce(new Error('gone'));
    expect(await commands.beginSampleRework('s1')).toBe('readFailed');
  });

  it('échec du remplacement disque : restauration du buffer d’origine (meilleur effort)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s1 = sample('s1');
    const { store, engine, commands, sampleRepository } = setup([s1]);
    sampleRepository.readBytes.mockResolvedValue(new Uint8Array([9, 9]));
    sampleRepository.replace.mockRejectedValueOnce(new Error('disk boom'));

    await commands.beginSampleRework('s1');
    const result = await commands.applyAudioEditor(0, 1);
    expect(result).toEqual({ ok: false, reason: 'writeFailed' });
    // restore : relit les octets d'origine et recharge le buffer.
    expect(sampleRepository.readBytes).toHaveBeenCalledTimes(2);
    expect(engine.load).toHaveBeenCalledTimes(2);
    expect(store.audioEditor).not.toBeNull(); // l'éditeur reste ouvert
    consoleError.mockRestore();
  });
});
