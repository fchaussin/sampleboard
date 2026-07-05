// SPDX-License-Identifier: GPL-3.0-or-later
// E2E : le pipeline d'import réel dans un vrai Chromium — décodage Web Audio + encodeur Opus
// (Worker WASM) + re-décodage de l'OGG produit. C'est LA couverture que les mocks Vitest ne
// peuvent pas donner (l'encodeur cassé — en-têtes OGG manquantes — passait les tests mockés).
// Depuis M6 (§11), l'import passe par le panneau Bibliothèque (plein écran, bottombar).
import { test, expect } from '@playwright/test';
import { applyAudioEditor, gotoApp, makeWav, openLibrary, pickImportFile } from './helpers';

test('import WAV → OGG/Opus : le sample apparaît dans la bibliothèque', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await gotoApp(page);
  await openLibrary(page);
  await pickImportFile(page, {
    name: 'tone.wav',
    mimeType: 'audio/wav',
    buffer: makeWav(),
  }, '.panel .import');
  await applyAudioEditor(page);

  const items = page.locator('.library .list li');
  try {
    await expect(items).toHaveCount(1, { timeout: 20_000 });
  } finally {
    console.log('\n--- BROWSER LOGS ---\n' + logs.join('\n') + '\n--------------------');
    const err = page.locator('.library .error');
    if (await err.count()) console.log('UI error:', await err.textContent());
  }
});

test('import sans crypto.randomUUID (contexte non sécurisé) : ajouté quand même', async ({ page }) => {
  // Simule un contexte non sécurisé (http via IP LAN) où crypto.randomUUID n'existe pas.
  await page.addInitScript(() => {
    try {
      // @ts-expect-error suppression volontaire pour le test
      delete Object.getPrototypeOf(crypto).randomUUID;
      // @ts-expect-error idem sur l'instance
      delete crypto.randomUUID;
    } catch {
      /* ignore */
    }
  });

  await gotoApp(page);
  await openLibrary(page);
  await pickImportFile(page, {
    name: 'insecure.wav',
    mimeType: 'audio/wav',
    buffer: makeWav(),
  }, '.panel .import');
  await applyAudioEditor(page);
  await expect(page.locator('.library .list li')).toHaveCount(1, { timeout: 20_000 });
});

test('import WAV stéréo & plus long : ajouté à la bibliothèque', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await gotoApp(page);
  await openLibrary(page);
  await pickImportFile(page, {
    name: 'stereo.wav',
    mimeType: 'audio/wav',
    buffer: makeWav(2, 44100, 440, 2), // 2 s, stéréo
  }, '.panel .import');
  await applyAudioEditor(page);

  try {
    await expect(page.locator('.library .list li')).toHaveCount(1, { timeout: 25_000 });
  } finally {
    console.log('\n--- BROWSER LOGS (stereo) ---\n' + logs.join('\n') + '\n--------------------');
    const err = page.locator('.library .error');
    if (await err.count()) console.log('UI error:', await err.textContent());
  }
});
