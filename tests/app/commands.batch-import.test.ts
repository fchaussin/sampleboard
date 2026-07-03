// SPDX-License-Identifier: GPL-3.0-or-later
// Tests de l'import multiple (M8) : lot séquentiel, expansion d'archives (extracteur
// factice), isolation des erreurs par fichier, interruption, cycle de vie de la modale.
import { describe, it, expect, vi } from 'vitest';
import { createCommands, type BatchSource } from '../../src/app/commands';
import type { AppStore, BatchImportState } from '../../src/app/store.svelte';
import type { ArchiveExtractor } from '../../src/engine/archive';
import { ARCHIVE_MAX_BYTES } from '../../src/domain/invariants';
import { fakeSampleRepository, fakeTagRepository } from './fake-sample-repository';
import { asEngine, fakeEngine } from './fake-engine';

function fakeStore(): AppStore {
  return {
    bank: null,
    samples: [],
    settings: { backgroundBehavior: 'stopAll', maxVoices: 8, locale: 'fr' },
    activePageId: null,
    editMode: false,
    selectedPadId: null,
    drawer: null,
    importOpen: false,
    importAssignPadId: null,
    tags: [],
    sampleTags: new Map<string, Set<string>>(),
    libraryFilter: null,
    assigningSampleId: null,
    poolSampleIds: [],
    poolOpen: false,
    activePadIds: new Set<string>(),
    batchImport: null,
  } as unknown as AppStore;
}

function setup(opts: { extractArchive?: ArchiveExtractor } = {}) {
  const store = fakeStore();
  const engine = fakeEngine();
  const sampleRepository = fakeSampleRepository();
  let n = 0;
  const commands = createCommands({
    store,
    engine: asEngine(engine),
    encode: (async () => new Uint8Array([0x4f, 0x67, 0x67, 0x53])) as never,
    sampleRepository,
    tagRepository: fakeTagRepository(),
    extractArchive: opts.extractArchive,
    ids: () => `id-${n++}`,
    now: () => 1_700_000_000_000,
  });
  return { store, engine, commands, sampleRepository };
}

function src(name: string, bytes: ArrayBuffer | null = new ArrayBuffer(16)): BatchSource {
  return { name, bytes };
}

function batch(store: AppStore): BatchImportState {
  const state = store.batchImport;
  if (!state) throw new Error('batchImport absent');
  return state;
}

describe('importBatch — lot de fichiers', () => {
  it('importe chaque fichier en séquence et clôt le lot', async () => {
    const { store, commands } = setup();
    await commands.importBatch([src('kick.wav'), src('snare.wav')]);
    const state = batch(store);
    expect(state.finished).toBe(true);
    expect(state.cancelled).toBe(false);
    expect(state.settled).toBe(2);
    expect(state.items.map((i) => i.status)).toEqual(['done', 'done']);
    expect(store.samples.map((s) => s.label)).toEqual(['kick.wav', 'snare.wav']);
  });

  it("un échec n'interrompt PAS le lot : l'élément est marqué, la suite continue", async () => {
    const { store, engine, commands } = setup();
    engine.decode.mockRejectedValueOnce(new Error('nope'));
    await commands.importBatch([src('weird.bin'), src('snare.wav')]);
    const state = batch(store);
    expect(state.items[0]).toMatchObject({ status: 'failed', reason: 'undecodable' });
    expect(state.items[1]).toMatchObject({ status: 'done', reason: null });
    expect(store.samples.map((s) => s.label)).toEqual(['snare.wav']);
  });

  it("option addToPool : chaque sample importé rejoint le pool, jamais les échecs", async () => {
    const { store, engine, commands } = setup();
    engine.decode.mockRejectedValueOnce(new Error('nope'));
    await commands.importBatch([src('rate.bin'), src('kick.wav'), src('snare.wav')], {
      addToPool: true,
    });
    // Seuls les deux réussis (id-0, id-1) sont au pool, dans l'ordre d'import.
    expect(store.poolSampleIds).toEqual(store.samples.map((s) => s.id));
    expect(store.poolSampleIds).toHaveLength(2);
  });

  it('sans option, le pool reste intact', async () => {
    const { store, commands } = setup();
    await commands.importBatch([src('kick.wav')]);
    expect(store.poolSampleIds).toHaveLength(0);
  });

  it('une lecture échouée en amont (bytes null) devient readFailed', async () => {
    const { store, commands } = setup();
    await commands.importBatch([src('mort.mp3', null), src('ok.wav')]);
    const state = batch(store);
    expect(state.items[0]).toMatchObject({ status: 'failed', reason: 'readFailed' });
    expect(state.items[1]!.status).toBe('done');
  });
});

describe('importBatch — archives (zip/rar)', () => {
  it("déplie l'archive : entrées audio ajoutées au lot puis importées, le reste ignoré", async () => {
    const extractArchive = vi.fn().mockResolvedValue([
      { name: 'a.mp3', bytes: new ArrayBuffer(8) },
      { name: 'lisez-moi.txt', bytes: new ArrayBuffer(8) },
      { name: 'b.ogg', bytes: new ArrayBuffer(8) },
    ]);
    const { store, commands } = setup({ extractArchive });
    await commands.importBatch([src('pack.zip')]);
    const state = batch(store);
    expect(extractArchive).toHaveBeenCalledWith('pack.zip', expect.any(ArrayBuffer));
    // L'archive elle-même + ses 2 entrées audio (le .txt n'entre jamais dans le lot).
    expect(state.items.map((i) => ({ name: i.name, status: i.status }))).toEqual([
      { name: 'pack.zip', status: 'done' },
      { name: 'a.mp3', status: 'done' },
      { name: 'b.ogg', status: 'done' },
    ]);
    expect(store.samples.map((s) => s.label)).toEqual(['a.mp3', 'b.ogg']);
  });

  it('archive sans fichier audio → archiveEmpty', async () => {
    const extractArchive = vi.fn().mockResolvedValue([{ name: 'notes.txt', bytes: new ArrayBuffer(8) }]);
    const { store, commands } = setup({ extractArchive });
    await commands.importBatch([src('vide.rar')]);
    expect(batch(store).items[0]).toMatchObject({ status: 'failed', reason: 'archiveEmpty' });
    expect(store.samples).toHaveLength(0);
  });

  it('extraction impossible → archiveFailed, le reste du lot continue', async () => {
    const extractArchive = vi.fn().mockRejectedValue(new Error('corrompue'));
    const { store, commands } = setup({ extractArchive });
    await commands.importBatch([src('corrompue.zip'), src('ok.wav')]);
    const state = batch(store);
    expect(state.items[0]).toMatchObject({ status: 'failed', reason: 'archiveFailed' });
    expect(state.items[1]!.status).toBe('done');
  });

  it("archive trop lourde refusée AVANT extraction (garde ARCHIVE_MAX_BYTES)", async () => {
    const extractArchive = vi.fn();
    const { store, commands } = setup({ extractArchive });
    // byteLength factice : on ne matérialise pas 200 Mo en mémoire de test.
    const heavy = { byteLength: ARCHIVE_MAX_BYTES + 1 } as ArrayBuffer;
    await commands.importBatch([{ name: 'enorme.zip', bytes: heavy }]);
    expect(batch(store).items[0]).toMatchObject({ status: 'failed', reason: 'tooLarge' });
    expect(extractArchive).not.toHaveBeenCalled();
  });

  it("sans extracteur injecté, une archive échoue en archiveFailed (jamais de crash)", async () => {
    const { store, commands } = setup();
    await commands.importBatch([src('pack.zip')]);
    expect(batch(store).items[0]).toMatchObject({ status: 'failed', reason: 'archiveFailed' });
  });
});

describe('importBatch — interruption et cycle de vie', () => {
  it("cancelBatchImport interrompt après l'élément en cours ; les restants sont « skipped »", async () => {
    const { store, engine, commands } = setup();
    engine.decode.mockImplementation(async () => {
      // Interruption demandée PENDANT le premier import : il se termine, la suite non.
      commands.cancelBatchImport();
      return { channelData: [new Float32Array([0])], sampleRate: 2 };
    });
    await commands.importBatch([src('a.wav'), src('b.wav'), src('c.wav')]);
    const state = batch(store);
    expect(state.cancelled).toBe(true);
    expect(state.finished).toBe(true);
    expect(state.items.map((i) => i.status)).toEqual(['done', 'skipped', 'skipped']);
    expect(store.samples).toHaveLength(1);
  });

  it('closeBatchImport ne referme que les lots terminés', async () => {
    const { store, commands } = setup();
    store.batchImport = { items: [], settled: 0, finished: false, cancelled: false };
    commands.closeBatchImport();
    expect(store.batchImport).not.toBeNull(); // en cours : la modale reste
    store.batchImport = { items: [], settled: 0, finished: true, cancelled: false };
    commands.closeBatchImport();
    expect(store.batchImport).toBeNull();
  });

  it("openImport ouvre la modale (et ferme le tiroir) ; closeImport la referme", () => {
    const { store, commands } = setup();
    store.drawer = 'settings';
    commands.openImport();
    expect(store.importOpen).toBe(true);
    expect(store.drawer).toBeNull(); // une seule surcouche à la fois (§11)
    commands.closeImport();
    expect(store.importOpen).toBe(false);
  });

  it('openImport(padId) mémorise le pad à assigner ; closeImport le réinitialise', () => {
    const { store, commands } = setup();
    commands.openImport('pad-1');
    expect(store.importOpen).toBe(true);
    expect(store.importAssignPadId).toBe('pad-1');
    commands.closeImport();
    expect(store.importAssignPadId).toBeNull();
  });

  it('openImport sans argument ne cible aucun pad (import bibliothèque)', () => {
    const { store, commands } = setup();
    store.importAssignPadId = 'pad-obsolete';
    commands.openImport();
    expect(store.importAssignPadId).toBeNull();
  });

  it('closeBatchImport réinitialise aussi le pad à assigner', async () => {
    const { store, commands } = setup();
    commands.openImport('pad-1');
    await commands.importBatch([src('a.wav')]);
    commands.closeBatchImport();
    expect(store.importAssignPadId).toBeNull();
  });

  it('closeBatchImport referme AUSSI la modale d’import ouverte depuis la bottombar', async () => {
    const { store, commands } = setup();
    commands.openImport();
    await commands.importBatch([src('a.wav')]);
    commands.closeBatchImport();
    expect(store.batchImport).toBeNull();
    expect(store.importOpen).toBe(false);
  });

  it('un seul lot à la fois : importBatch est un no-op si un lot est déjà en cours', async () => {
    const { store, commands } = setup();
    const running: BatchImportState = { items: [], settled: 0, finished: false, cancelled: false };
    store.batchImport = running;
    await commands.importBatch([src('a.wav')]);
    expect(store.batchImport).toBe(running); // strictement inchangé
    expect(store.samples).toHaveLength(0);
  });
});
