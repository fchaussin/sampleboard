// SPDX-License-Identifier: GPL-3.0-or-later
// E2E M7 : l'éditeur audio (« découper ») dans un vrai Chromium — waveform, poignée
// déplacée au pointeur, rognage AVANT encodage (durée persistée réduite), undo, retravail.
import { test, expect, type Page } from '@playwright/test';
import { makeWav, openLibrary } from './helpers';

/** Glisse la poignée de fin vers `ratio` (0..1) de la largeur de la waveform. */
async function dragEndHandleTo(page: Page, ratio: number): Promise<void> {
  const wave = page.locator('.audio-editor .wave');
  const box = (await wave.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 2, y); // extrémité droite = poignée de fin
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * ratio, y, { steps: 8 });
  await page.mouse.up();
}

test('import → rognage à la poignée → durée persistée réduite ; undo restaure', async ({ page }) => {
  await page.goto('/');
  // WAV d'une seconde : les durées affichées sont non ambiguës (1 s → 0,5 s).
  await page.locator('.bottombar .import input[type=file]').setInputFiles({
    name: 'long.wav',
    mimeType: 'audio/wav',
    buffer: makeWav(1),
  });

  const editor = page.locator('.audio-editor');
  await editor.waitFor({ timeout: 20_000 });

  // Rogne à ~50 %, puis undo (sélection pleine), puis re-rogne à 50 % et valide.
  await dragEndHandleTo(page, 0.5);
  await expect(editor.locator('.times')).toContainText('0,5');
  await editor.locator('.undo').click();
  await expect(editor.locator('.times')).toContainText('· 1');
  await dragEndHandleTo(page, 0.5);
  await editor.locator('.apply').click();
  await editor.waitFor({ state: 'hidden', timeout: 20_000 });

  // La bibliothèque affiche la durée ROGNÉE (~0,5 s), pas 1 s.
  await openLibrary(page);
  await expect(page.locator('.library .list li .meta')).toContainText('0,5');
});

test('retravail depuis la bibliothèque : re-rognage → durée mise à jour', async ({ page }) => {
  await page.goto('/');
  await page.locator('.bottombar .import input[type=file]').setInputFiles({
    name: 'long.wav',
    mimeType: 'audio/wav',
    buffer: makeWav(1),
  });
  const editor = page.locator('.audio-editor');
  await editor.waitFor({ timeout: 20_000 });
  await editor.locator('.apply').click(); // import plage complète (1 s)
  await editor.waitFor({ state: 'hidden', timeout: 20_000 });

  await openLibrary(page);
  await expect(page.locator('.library .list li .meta')).toContainText('1');
  await page.locator('.library .rework').click(); // « découper » le sample existant

  await editor.waitFor({ timeout: 20_000 });
  await dragEndHandleTo(page, 0.5);
  await editor.locator('.apply').click();
  await editor.waitFor({ state: 'hidden', timeout: 20_000 });

  // Même entrée (pas de doublon), durée réduite.
  await expect(page.locator('.library .list li')).toHaveCount(1);
  await expect(page.locator('.library .list li .meta')).toContainText('0,5');
});
