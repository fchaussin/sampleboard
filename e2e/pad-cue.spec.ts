// SPDX-License-Identifier: GPL-3.0-or-later
// Points cue par pad (M11) : depuis le tiroir du pad, éditer les points cue dans l'éditeur
// waveform (NON destructif — écrit dans le pad), puis vérifier la persistance au rechargement.
import { test, expect } from '@playwright/test';
import { gotoApp, importWav, openLibrary } from './helpers';

test('points cue par pad : éditer depuis le tiroir, appliquer, persister au rechargement', async ({ page }) => {
  await gotoApp(page);
  await importWav(page, 'cue.wav', 2);

  // Assigner le sample au pad 0 (à la volée depuis la bibliothèque).
  await openLibrary(page);
  await page.locator('.library .assign-start').click();
  await page.locator('.grid .pad').nth(0).click();
  await page.locator('.banner button').click();

  // Édition → tiroir du pad 0 → « Points cue » affiche « Full sample ».
  await page.locator('.bottombar .mode-toggle').click();
  await page.locator('.grid .pad').nth(0).click();
  const drawer = page.locator('.drawer');
  await expect(drawer.locator('.cue-edit')).toHaveText('Full sample');
  await drawer.locator('.cue-edit').click();

  // L'éditeur s'ouvre en mode cue : titre « Cue points » + option « Save as new sample ».
  const editor = page.locator('.audio-editor');
  await expect(editor).toBeVisible();
  await expect(editor.locator('h2')).toContainText('Cue points');
  await expect(editor.locator('.save-as-new')).toBeVisible();

  // Glisser la poignée de fin vers le milieu (crée une fenêtre cue < sample entier).
  const wave = editor.locator('.wave');
  const box = (await wave.boundingBox())!;
  await page.mouse.move(box.x + box.width - 5, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();

  // Appliquer AU PAD (non destructif) : l'éditeur se ferme, le pad porte désormais un cue.
  await editor.locator('.apply').click();
  await expect(editor).toHaveCount(0);
  await expect(drawer.locator('.cue-reset')).toBeVisible();
  await expect(drawer.locator('.cue-edit')).not.toHaveText('Full sample');

  // Laisser l'autosave (400 ms) écrire la banque, puis RECHARGER : le cue persiste (IndexedDB).
  await page.waitForTimeout(700);
  await page.reload();
  await page.locator('.bottombar .mode-toggle').click();
  await page.locator('.grid .pad').nth(0).click();
  await expect(page.locator('.drawer .cue-reset')).toBeVisible();
  await expect(page.locator('.drawer .cue-edit')).not.toHaveText('Full sample');
});
