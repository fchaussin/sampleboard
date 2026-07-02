// SPDX-License-Identifier: GPL-3.0-or-later
// Tests moteur M5 : arrêts liés au réglage Arrière-plan (§12) — stopAll, stopSustained
// (voix entretenues Gate/Loop vs One-Shot qu'on laisse finir) et suspension du contexte.
import { describe, it, expect, vi } from 'vitest';
import { makeEngine, bytes, pad, POLY_PAGE } from './fake-audio-context';

async function engineWithBuffers() {
  const { engine, ctx } = makeEngine();
  await engine.resume();
  await engine.load('sample-1', bytes());
  return { engine, ctx };
}

describe('stopAll', () => {
  it('arrête toutes les voix et notifie un reflet vide', async () => {
    const { engine } = await engineWithBuffers();
    const seen: Array<Set<string>> = [];
    engine.onPlayingChanged((ids) => seen.push(new Set(ids)));
    engine.oneShot(pad({ id: 'one' }), POLY_PAGE);
    engine.press(pad({ id: 'gate', position: 1 }), POLY_PAGE);
    engine.toggleLoop(pad({ id: 'loop', position: 2 }), POLY_PAGE);
    expect(seen.at(-1)).toEqual(new Set(['one', 'gate', 'loop']));
    engine.stopAll();
    expect(seen.at(-1)).toEqual(new Set());
  });

  it('sans voix active : aucune notification superflue', async () => {
    const { engine } = await engineWithBuffers();
    const cb = vi.fn();
    engine.onPlayingChanged(cb);
    engine.stopAll();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('stopSustained', () => {
  it('arrête Gate et Loop, laisse finir les One-Shot (§12)', async () => {
    const { engine } = await engineWithBuffers();
    const seen: Array<Set<string>> = [];
    engine.onPlayingChanged((ids) => seen.push(new Set(ids)));
    engine.oneShot(pad({ id: 'one' }), POLY_PAGE);
    engine.press(pad({ id: 'gate', position: 1 }), POLY_PAGE);
    engine.toggleLoop(pad({ id: 'loop', position: 2 }), POLY_PAGE);
    engine.stopSustained();
    expect(seen.at(-1)).toEqual(new Set(['one']));
  });

  it('le re-déclenchement d’un One-Shot reste non entretenu', async () => {
    const { engine } = await engineWithBuffers();
    const seen: Array<Set<string>> = [];
    engine.onPlayingChanged((ids) => seen.push(new Set(ids)));
    engine.oneShot(pad({ id: 'one' }), POLY_PAGE);
    engine.oneShot(pad({ id: 'one' }), POLY_PAGE); // re-tap : relance depuis 0
    engine.stopSustained();
    expect(seen.at(-1)).toEqual(new Set(['one']));
  });
});

describe('suspend', () => {
  it('suspend le contexte quand il tourne', async () => {
    const { engine, ctx } = await engineWithBuffers();
    await engine.suspend();
    expect(ctx.suspendCalls).toBe(1);
    expect(engine.state).toBe('suspended');
  });

  it('no-op si le contexte ne tourne pas (jamais créé ou déjà suspendu)', async () => {
    const { engine, ctx } = makeEngine();
    await engine.suspend(); // contexte jamais créé
    expect(ctx.suspendCalls).toBe(0);
    await engine.resume();
    await engine.suspend();
    await engine.suspend(); // déjà suspendu
    expect(ctx.suspendCalls).toBe(1);
  });

  it('après suspend, resume() relance le contexte (retour de veille, §12)', async () => {
    const { engine, ctx } = await engineWithBuffers();
    await engine.suspend();
    await engine.resume();
    expect(ctx.state).toBe('running');
  });
});
