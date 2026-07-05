// SPDX-License-Identifier: GPL-3.0-or-later
// E2E M10 : persistance NAVIGATEUR (IndexedDB) — le cycle complet survit au rechargement :
// sample importé, renommage, assignation à un pad (autosave de la banque débouncée 400 ms),
// tags par défaut SEMÉS UNE SEULE FOIS (la garde firstLaunch vaut aussi pour le web).
import { test, expect } from '@playwright/test';
import { gotoApp, importWav, openLibrary } from './helpers';

test('import → assignation → RECHARGEMENT : tout est relu depuis IndexedDB', async ({ page }) => {
  await gotoApp(page);
  await importWav(page, 'persist.wav');

  // Assigner à la volée au premier pad (Édition la plus courte : bouton direct de la ligne).
  await openLibrary(page);
  await page.locator('.library .assign-start').click();
  await page.locator('.grid .pad').nth(0).click();
  await page.locator('.banner button').click(); // Terminer
  await expect(page.locator('.grid .pad .name').first()).toHaveText('persist');

  // Laisser l'autosave débouncée (400 ms) écrire, puis RECHARGER.
  await page.waitForTimeout(900);
  await page.reload();

  // La banque relue : pad toujours nommé et assigné (pas « introuvable »).
  await expect(page.locator('.grid .pad .name').first()).toHaveText('persist');
  await expect(page.locator('.grid .pad').first()).not.toHaveClass(/missing/);

  // La bibliothèque relue : le sample est là, PAS re-semé ni dupliqué.
  await openLibrary(page);
  await expect(page.locator('.library .list li')).toHaveCount(1);

  // Les tags par défaut n'ont PAS repoussé (premier lancement UNIQUE, même garde que Tauri).
  const chips = page.locator('.library .filters .chip', { hasText: 'SFX' });
  await expect(chips).toHaveCount(1);
});

test('un tag supprimé ne repousse pas au rechargement (garde firstLaunch persistée)', async ({ page }) => {
  await gotoApp(page);
  await openLibrary(page);
  await expect(page.locator('.library .filters .chip', { hasText: 'SFX' })).toBeVisible();

  // Supprimer le tag « SFX » depuis le tiroir « Gérer les tags ». Le libellé est un
  // <input> éditable (hasText ne voit pas les valeurs) : on repère la ligne par sa valeur.
  await page.locator('.manage-tags').click();
  const inputs = page.locator('.drawer .tag-list li input');
  await expect(inputs.first()).toBeVisible();
  const labels = await inputs.evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
  await page.locator('.drawer .tag-list li').nth(labels.indexOf('SFX')).locator('button.delete').click();
  await page.locator('.drawer .close').click();
  await expect(page.locator('.library .filters .chip', { hasText: 'SFX' })).toHaveCount(0);

  await page.waitForTimeout(600);
  await page.reload();
  await openLibrary(page);
  await expect(page.locator('.library .filters .chip', { hasText: 'Ambience' })).toBeVisible();
  await expect(page.locator('.library .filters .chip', { hasText: 'SFX' })).toHaveCount(0);
});
