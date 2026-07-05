// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du pipeline d'import et de la bibliothèque (M4). Décodage/encodage/moteur factices.
import { describe, it, expect } from 'vitest';
import { createCommands, PREVIEW_STOPPING_COMMANDS } from '../../src/app/commands';
import type { AppStore } from '../../src/app/store.svelte';
import type { Bank, Sample } from '../../src/domain/types';
import { IMPORT_MAX_BYTES } from '../../src/domain/invariants';
import { fakeSampleRepository, fakeTagRepository } from './fake-sample-repository';
import { asEngine, fakeEngine } from './fake-engine';

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
    previewingSampleId: null,
    assigningSampleId: null,
    poolSampleIds: [],
    poolOpen: false,
    activePadIds: new Set<string>(),
  } as unknown as AppStore;
}

function setup(opts: { store?: AppStore; encode?: (p: unknown) => Promise<Uint8Array> } = {}) {
  const store = opts.store ?? fakeStore();
  const engine = fakeEngine();
  const sampleRepository = fakeSampleRepository();
  let n = 0;
  const encode = opts.encode ?? (async () => new Uint8Array([0x4f, 0x67, 0x67, 0x53])); // "OggS"
  const commands = createCommands({
    store,
    engine: asEngine(engine),
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

describe('bibliothèque — pré-écoute (bascule ▶/■, stop par toute action)', () => {
  it('lance, reflète le sample en cours ; la fin de lecture efface le reflet', () => {
    const { store, engine, commands } = setup();
    commands.previewSample('s1');
    expect(engine.previewSample).toHaveBeenCalledWith('s1', expect.any(Function));
    expect(store.previewingSampleId).toBe('s1');
    // Fin NATURELLE (le moteur ne notifie que la lecture courante — garde par identité).
    const onEnded = engine.previewSample.mock.calls[0]![1] as () => void;
    onEnded();
    expect(store.previewingSampleId).toBeNull();
  });

  it('re-tap sur le sample en cours : bascule → stop, sans relancer', () => {
    const { store, engine, commands } = setup();
    commands.previewSample('s1');
    commands.previewSample('s1');
    expect(engine.previewSample).toHaveBeenCalledOnce();
    expect(store.previewingSampleId).toBeNull();
  });

  it('échec de lancement (buffer non chargé) : l’ancienne pré-écoute est STOPPÉE, reflet null — jamais de son orphelin', () => {
    const { store, engine, commands } = setup();
    commands.previewSample('s1');
    expect(store.previewingSampleId).toBe('s1');
    engine.previewSample.mockReturnValueOnce(false);
    commands.previewSample('s2');
    // Le stop précède TOUJOURS le lancement : s1 ne survit pas à l'échec de s2.
    expect(engine.stopPreview).toHaveBeenCalledTimes(2);
    expect(store.previewingSampleId).toBeNull();
  });

  it('RÈGLE §16, test GÉNÉRIQUE : chaque commande de PREVIEW_STOPPING_COMMANDS stoppe la pré-écoute (un ajout à la liste est couvert d’office ; un oubli d’ajout se voit en revue via ce test)', () => {
    const store = fakeStore(null, [sample('s1'), sample('s2')]);
    const { commands } = setup({ store });
    // Arguments plausibles par commande (défaut : aucun). Les commandes qui échouent en
    // interne (cible inconnue, éditeur fermé…) doivent stopper QUAND MÊME : l'action a eu lieu.
    const args: Partial<Record<(typeof PREVIEW_STOPPING_COMMANDS)[number], unknown[]>> = {
      setLibraryFilter: [null],
      startAssigning: ['s2'],
      addToPool: ['s2'],
      removeFromPool: ['s2'],
      assignSample: ['p1', 's2'],
      renameSample: ['s2', 'X'],
      toggleSampleTag: ['s2', 't1'],
      deleteSample: ['s2'],
      createTag: ['Nouveau'],
      renameTag: ['t1', 'X'],
      deleteTag: ['t1'],
      beginSampleRework: ['inconnu'],
      previewEditorSelection: [0, 1],
      applyAudioEditor: [0, 1],
    };
    for (const name of PREVIEW_STOPPING_COMMANDS) {
      commands.previewSample('s1');
      expect(store.previewingSampleId).toBe('s1');
      (commands[name] as (...a: unknown[]) => unknown)(...(args[name] ?? []));
      expect(store.previewingSampleId, `la commande « ${name} » doit stopper la pré-écoute`).toBeNull();
    }
  });
});

describe('bibliothèque — preview / rename / delete', () => {

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
        { id: 'pad', pageId: 'pg', name: '', sampleId: 's1', playMode: 'oneShot', gainDb: 0, position: 0, color: null, cueStart: null, cueEnd: null },
        { id: 'autre', pageId: 'pg', name: '', sampleId: 's2', playMode: 'oneShot', gainDb: 0, position: 1, color: null, cueStart: null, cueEnd: null },
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
