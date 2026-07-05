// SPDX-License-Identifier: GPL-3.0-or-later
// Points cue par pad (M11) : édition NON destructive. beginPadCue ouvre l'éditeur en mode
// 'cue' avec le cue courant ; applyPadCue écrit dans le pad SANS ré-encoder (bords → null) ;
// clearPadCue efface ; saveEditorSelectionAsSample encode la plage en un NOUVEAU sample,
// l'original restant intact.
import { describe, it, expect, vi } from 'vitest';
import { createCommands } from '../../src/app/commands';
import type { ViewId } from '../../src/app/navigation';
import type { AppStore } from '../../src/app/store.svelte';
import type { Bank, Sample } from '../../src/domain/types';
import { fakeSampleRepository, fakeTagRepository } from './fake-sample-repository';
import { asEngine, fakeEngine } from './fake-engine';

function makeBank(): Bank {
  return {
    id: 'b',
    name: 'b',
    pages: [{ id: 'pg', name: 'P', voiceMode: 'poly', rows: 4, cols: 4, position: 0, color: null }],
    pads: [
      { id: 'pad', pageId: 'pg', name: '', sampleId: 's1', playMode: 'oneShot', gainDb: 0, position: 0, color: null, cueStart: null, cueEnd: null },
    ],
  };
}

const S1: Sample = {
  id: 's1', label: 'Boucle', fileName: 's1.ogg', originalName: 's1.wav',
  mime: 'audio/ogg', sizeBytes: 4, durationMs: 1000, createdAt: 0,
};

function fakeStore(): AppStore {
  const store = {
    bank: makeBank(),
    samples: [S1],
    settings: { backgroundBehavior: 'stopAll', maxVoices: 8, locale: 'fr' },
    activePageId: 'pg',
    editMode: true,
    selectedPadId: 'pad',
    drawer: 'pad',
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
    previewingSampleId: null,
    activePadIds: new Set<string>(),
  };
  return store as unknown as AppStore;
}

function setup() {
  const store = fakeStore();
  const engine = fakeEngine({
    // 1 s à 8 Hz.
    decode: vi.fn().mockResolvedValue({
      channelData: [new Float32Array([0, 1, 2, 3, 4, 5, 6, 7])],
      sampleRate: 8,
      durationMs: 1000,
    }),
  });
  const sampleRepository = fakeSampleRepository();
  sampleRepository.readBytes.mockResolvedValue(new Uint8Array(8));
  const encode = vi.fn(async (pcm: { channelData: Float32Array[] }) => new Uint8Array(pcm.channelData[0]!.length));
  let n = 0;
  const commands = createCommands({
    store,
    engine: asEngine(engine),
    encode: encode as never,
    sampleRepository,
    tagRepository: fakeTagRepository(),
    ids: () => `new-${n++}`,
    now: () => 42,
  });
  const pad = () => store.bank!.pads[0]!;
  return { store, commands, sampleRepository, encode, pad };
}

describe('beginPadCue', () => {
  it('décode le sample du pad et ouvre l’éditeur en mode cue (sélection = plage pleine)', async () => {
    const { store, commands } = setup();
    const err = await commands.beginPadCue('pad');
    expect(err).toBeNull();
    expect(store.audioEditor).toMatchObject({ mode: 'cue', padId: 'pad', fileName: 'Boucle' });
    expect(store.audioEditor!.initialSelection).toEqual({ start: 0, end: 1 });
  });

  it('reprend les points cue courants du pad comme sélection initiale', async () => {
    const { store, commands, pad } = setup();
    pad().cueStart = 0.25;
    pad().cueEnd = 0.75;
    await commands.beginPadCue('pad');
    expect(store.audioEditor!.initialSelection).toEqual({ start: 0.25, end: 0.75 });
  });

  it('pad sans sample : readFailed, aucun éditeur', async () => {
    const { store, commands, pad } = setup();
    pad().sampleId = null;
    expect(await commands.beginPadCue('pad')).toBe('readFailed');
    expect(store.audioEditor).toBeNull();
  });
});

describe('applyPadCue (NON destructif)', () => {
  it('écrit start/end dans le pad et referme — sans ré-encoder', async () => {
    const { store, commands, pad, encode } = setup();
    await commands.beginPadCue('pad');
    commands.applyPadCue(0.2, 0.6);
    expect(pad().cueStart).toBeCloseTo(0.2);
    expect(pad().cueEnd).toBeCloseTo(0.6);
    expect(store.audioEditor).toBeNull();
    expect(encode).not.toHaveBeenCalled(); // aucune écriture d'octets
  });

  it('plage couvrant les bords → null/null (pas de cue = sample entier)', async () => {
    const { commands, pad } = setup();
    await commands.beginPadCue('pad');
    commands.applyPadCue(0, 1); // toute la durée
    expect(pad().cueStart).toBeNull();
    expect(pad().cueEnd).toBeNull();
  });
});

describe('clearPadCue', () => {
  it('remet les points cue à null', () => {
    const { commands, pad } = setup();
    pad().cueStart = 0.3;
    pad().cueEnd = 0.8;
    commands.clearPadCue('pad');
    expect(pad().cueStart).toBeNull();
    expect(pad().cueEnd).toBeNull();
  });
});

describe('saveEditorSelectionAsSample', () => {
  it('encode la plage en un NOUVEAU sample ; l’original reste, le pad inchangé', async () => {
    const { store, commands, pad, encode } = setup();
    await commands.beginPadCue('pad');
    const before = store.samples.length;
    const result = await commands.saveEditorSelectionAsSample(0.25, 0.75);
    expect(result.ok).toBe(true);
    expect(encode).toHaveBeenCalledOnce(); // nouvelle entrée encodée
    expect(store.samples.length).toBe(before + 1); // original toujours là + le nouveau
    expect(store.samples.some((s) => s.id === 's1')).toBe(true);
    expect(pad().cueStart).toBeNull(); // le pad n'est pas touché par « enregistrer sous »
    expect(store.audioEditor).toBeNull(); // terminal : éditeur refermé
  });
});
