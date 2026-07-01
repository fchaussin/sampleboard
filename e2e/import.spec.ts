// SPDX-License-Identifier: GPL-3.0-or-later
// E2E : le pipeline d'import réel dans un vrai Chromium — décodage Web Audio + encodeur Opus
// (Worker WASM) + re-décodage de l'OGG produit. C'est LA couverture que les mocks Vitest ne
// peuvent pas donner (l'encodeur cassé — en-têtes OGG manquantes — passait les tests mockés).
import { test, expect } from '@playwright/test';
import { makeWav } from './helpers';

test('import WAV → OGG/Opus : le sample apparaît dans la bibliothèque', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto('/');
  await page.locator('.library input[type=file]').setInputFiles({
    name: 'tone.wav',
    mimeType: 'audio/wav',
    buffer: makeWav(),
  });

  const items = page.locator('.library .list li');
  try {
    await expect(items).toHaveCount(1, { timeout: 20_000 });
  } finally {
    console.log('\n--- BROWSER LOGS ---\n' + logs.join('\n') + '\n--------------------');
    const err = page.locator('.library .error');
    if (await err.count()) console.log('UI error:', await err.textContent());
  }
});
