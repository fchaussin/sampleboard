// SPDX-License-Identifier: GPL-3.0-or-later
// E2E M8 : la durée de l'OGG produit égale la durée du PCM fourni (±30 ms) — le rognage de
// traîne (granule de dernière page, ogg.ts) est vérifié en re-décodant l'OGG dans un VRAI
// Chromium. Sans lui, l'encodeur WASM laisse ~100 ms de silence (gap audible en Loop).
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

test('OGG encodé : durée fidèle au PCM (pas de traîne de silence)', async ({ page }) => {
  await gotoApp(page);
  await page.locator('.grid .pad').first().waitFor();

  const durations = await page.evaluate(async () => {
    // Vite (dev) transforme les modules source à la volée : VRAIS encodeur et moteur.
    const { createOpusEncoder } = await import('/src/engine/encoder.ts');
    const { AudioEngine } = await import('/src/engine/audio-engine.ts');
    const seconds = 1;
    const sampleRate = 48000;
    const pcm = new Float32Array(sampleRate * seconds);
    for (let i = 0; i < pcm.length; i++) pcm[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;

    const ogg = await createOpusEncoder()({ channelData: [pcm], sampleRate });
    const engine = new AudioEngine();
    await engine.load('probe', ogg.slice().buffer);
    return { source: seconds, engine: engine.duration('probe') };
  });

  // Le moteur rogne le buffer à la durée annoncée par le flux (granule) : fidèle à ±10 ms.
  expect(durations.engine).not.toBeNull();
  expect(Math.abs(durations.engine! - durations.source)).toBeLessThan(0.01);
});
