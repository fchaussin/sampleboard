// SPDX-License-Identifier: GPL-3.0-or-later
// Pré-écoute UNIFIÉE (sample de bibliothèque & PCM d'éditeur : un seul comportement,
// une seule lecture à la fois) + bus master : tout ce qui sonne est routé
// `master (Gain) → destination` — jamais `destination` en direct. L'analyseur master est
// un tap en DÉRIVATION créé paresseusement au premier masterWaveform().
import { describe, it, expect, vi } from 'vitest';
import { makeEngine, bytes, pad, POLY_PAGE } from './fake-audio-context';

describe('previewSample (pré-écoute de la bibliothèque)', () => {
  it('false si contexte absent ou buffer non chargé ; démarre et true sinon', async () => {
    const { engine, ctx } = makeEngine();
    expect(engine.previewSample('s1')).toBe(false); // pas encore de contexte
    await engine.resume();
    expect(engine.previewSample('s1')).toBe(false); // buffer non chargé
    await engine.load('s1', bytes());
    expect(engine.previewSample('s1')).toBe(true);
    expect(ctx.sources[0]!.started).toBe(true);
  });

  it('UNE pré-écoute à la fois : sample ou PCM, la nouvelle remplace la précédente', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    await engine.load('s1', bytes());
    engine.previewSample('s1');
    engine.previewPcm({ channelData: [new Float32Array([0.1])], sampleRate: 1 });
    expect(ctx.sources[0]!.stopped).toBe(true); // sample remplacé par le PCM
    engine.previewSample('s1');
    expect(ctx.sources[1]!.stopped).toBe(true); // PCM remplacé par le sample
    expect(ctx.sources[2]!.started).toBe(true);
  });

  it('stopPreview arrête ET déconnecte la source de façon SYNCHRONE (le onended ne tire pas si le contexte se suspend juste après)', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    await engine.load('s1', bytes());
    engine.previewSample('s1');
    engine.stopPreview();
    expect(ctx.sources[0]!.stopped).toBe(true);
    expect(ctx.sources[0]!.disconnected).toBe(true); // sans attendre onended
    engine.stopPreview(); // no-op
  });
});

describe('onEnded — garde par IDENTITÉ de lecture (non-régression : bascule ▶/■)', () => {
  it('notifié à la fin NATURELLE de la lecture courante', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    await engine.load('s1', bytes());
    const onEnded = vi.fn();
    engine.previewSample('s1', onEnded);
    ctx.sources[0]!.fireEnded();
    expect(onEnded).toHaveBeenCalledOnce();
  });

  it('PAS notifié pour une lecture STOPPÉE (le onended tardif du vrai Web Audio arrive après stop())', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    await engine.load('s1', bytes());
    const onEnded = vi.fn();
    engine.previewSample('s1', onEnded);
    engine.stopPreview();
    ctx.sources[0]!.fireEnded(); // dispatch asynchrone simulé APRÈS le stop
    expect(onEnded).not.toHaveBeenCalled();
  });

  it('PAS notifié pour une lecture REMPLACÉE — même par une relecture du MÊME sample', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    await engine.load('s1', bytes());
    const first = vi.fn();
    const second = vi.fn();
    engine.previewSample('s1', first);
    engine.previewSample('s1', second); // ▶ s1, puis re-▶ s1 (remplacement rapide)
    ctx.sources[0]!.fireEnded(); // onended tardif de la 1re lecture
    expect(first).not.toHaveBeenCalled(); // n'efface pas le reflet de la 2e
    ctx.sources[1]!.fireEnded();
    expect(second).toHaveBeenCalledOnce();
  });
});

describe('previewPcm (sélection de l’éditeur M7) — même contrat que previewSample', () => {
  it('joue le PCM et renvoie true ; un nouvel appel remplace la lecture', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    const pcm = { channelData: [new Float32Array([0.1, 0.2])], sampleRate: 2 };
    expect(engine.previewPcm(pcm)).toBe(true);
    expect(ctx.sources[0]!.started).toBe(true);
    engine.previewPcm(pcm);
    expect(ctx.sources[0]!.stopped).toBe(true); // remplacée
  });

  it('sélection vide : renvoie false, aucun démarrage, mais fait office de stop', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    const empty = { channelData: [], sampleRate: 44100 };
    expect(engine.previewPcm(empty)).toBe(false);
    expect(ctx.sources).toHaveLength(0);

    await engine.load('s1', bytes());
    engine.previewSample('s1');
    expect(engine.previewPcm(empty)).toBe(false);
    expect(ctx.sources[0]!.stopped).toBe(true); // la lecture courante est stoppée
  });
});

describe('bus master', () => {
  it('voix et pré-écoutes se raccordent au master — jamais à destination en direct', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    await engine.load('sample-1', bytes());
    engine.oneShot(pad(), POLY_PAGE);
    engine.previewSample('sample-1');

    // Ordre de création : chaîne de voix (gain, analyseur) PUIS gain master au 1er connect.
    const [voiceGain, masterGain] = ctx.gains;
    const [voiceAnalyser] = ctx.analysers;
    const [voiceSource, previewSource] = ctx.sources;

    expect(ctx.gains).toHaveLength(2);
    expect(ctx.analysers).toHaveLength(1); // PAS d'analyseur master tant que personne ne lit
    expect(voiceSource!.connectedTo[0]).toBe(voiceGain);
    expect(voiceGain!.connectedTo[0]).toBe(voiceAnalyser);
    expect(voiceAnalyser!.connectedTo[0]).toBe(masterGain); // la voix sort sur le bus
    expect(previewSource!.connectedTo[0]).toBe(masterGain); // la pré-écoute aussi
    expect(masterGain!.connectedTo[0]).toBe(ctx.destination); // SEULE sortie vers destination
  });

  it('le bus est créé une seule fois (deux lectures → un seul gain master)', async () => {
    const { engine, ctx } = makeEngine();
    await engine.resume();
    await engine.load('s1', bytes());
    engine.previewSample('s1');
    engine.previewSample('s1');
    expect(ctx.gains).toHaveLength(1); // pas de gain de voix ici : previews seules
  });

  it('masterWaveform : analyseur en DÉRIVATION, créé paresseusement au premier appel', async () => {
    const { engine, ctx } = makeEngine();
    const out = new Float32Array(4);
    expect(engine.masterWaveform(out)).toBe(false); // rien n'a encore joué
    await engine.resume();
    await engine.load('s1', bytes());
    engine.previewSample('s1');
    expect(ctx.analysers).toHaveLength(0); // toujours pas d'analyseur : zéro coût de rendu

    expect(engine.masterWaveform(out)).toBe(true);
    expect(out[0]).toBe(-1); // rampe reconnaissable du faux analyseur
    const master = ctx.gains[0]!;
    const analyser = ctx.analysers[0]!;
    expect(master.connectedTo).toContain(ctx.destination); // le son sort toujours en direct
    expect(master.connectedTo).toContain(analyser); // le tap écoute en parallèle
    expect(analyser.connectedTo).toHaveLength(0); // et ne traverse pas

    expect(engine.masterWaveform(out)).toBe(true);
    expect(ctx.analysers).toHaveLength(1); // pas de second analyseur au 2e appel
  });
});

describe('previewProgress (#19 — progression des cartes de bibliothèque)', () => {
  it('null sans pré-écoute ; avancement borné à 1 pendant ; null après stop', async () => {
    const { engine, ctx } = makeEngine();
    expect(engine.previewProgress()).toBeNull(); // pas de contexte
    await engine.resume();
    await engine.load('s1', bytes());
    expect(engine.previewProgress()).toBeNull(); // rien ne joue

    ctx.currentTime = 10;
    engine.previewSample('s1');
    ctx.currentTime = 10.5;
    expect(engine.previewProgress()).toBeCloseTo(0.5); // buffer d'1 s
    ctx.currentTime = 20;
    expect(engine.previewProgress()).toBe(1); // borné, jamais > 1

    engine.stopPreview();
    expect(engine.previewProgress()).toBeNull();
  });
});
