// SPDX-License-Identifier: GPL-3.0-or-later
// E2E M8 : tags (semis par défaut, affectation), filtres (dont « Non classé » virtuel),
// assignation page→pad depuis la bibliothèque, recherche dans la modale de sample.
import { test, expect } from '@playwright/test';
import { importWav, openLibrary } from './helpers';

test('taguer, filtrer (tag et Non classé), assigner un pad depuis la bibliothèque', async ({ page }) => {
  await page.goto('/');
  await importWav(page, 'explosion.wav');
  await openLibrary(page);

  // Les tags par défaut sont semés au premier lancement.
  const filters = page.locator('.library .filters');
  await expect(filters.locator('.chip', { hasText: 'SFX' })).toBeVisible();

  // Sans tag → visible sous « Non classé », pas sous « SFX ».
  await filters.locator('.chip', { hasText: 'Non classé' }).click();
  await expect(page.locator('.library .list li')).toHaveCount(1);
  await filters.locator('.chip', { hasText: 'SFX' }).click();
  await expect(page.locator('.library .list')).toHaveCount(0);

  // Affecter « SFX » : déplier la ligne, cocher la chip.
  await filters.locator('.chip', { hasText: 'Tous' }).click();
  await page.locator('.library .tags-toggle').click();
  await page.locator('.library .expansion .chip', { hasText: 'SFX' }).click();
  await filters.locator('.chip', { hasText: 'SFX' }).click();
  await expect(page.locator('.library .list li').first()).toBeVisible();
  await filters.locator('.chip', { hasText: 'Non classé' }).click();
  await expect(page.locator('.library .list')).toHaveCount(0);

  // Assignation À LA VOLÉE (#11) : armer le sample → le panneau se ferme → chaque pad
  // touché reçoit le sample → Terminer.
  await filters.locator('.chip', { hasText: 'Tous' }).click();
  const expansion = page.locator('.library .expansion');
  await expect(expansion).toBeVisible();
  await expansion.locator('.assign-start').click();
  await expect(page.locator('.banner')).toBeVisible(); // bannière du mode
  await page.locator('.grid .pad').nth(0).click();
  await page.locator('.grid .pad').nth(5).click();
  await expect(page.locator('.grid .pad.idle')).toHaveCount(2); // multi-pads, à la volée
  await page.locator('.banner button').click(); // Terminer
  await expect(page.locator('.banner')).toHaveCount(0);
});

test('modale de choix de sample : la recherche filtre la liste (#12)', async ({ page }) => {
  await page.goto('/');
  await importWav(page, 'kick.wav');
  await importWav(page, 'nappe.wav');

  await page.locator('.bottombar .mode-toggle').click();
  await page.locator('.grid .pad').first().click();
  await page.locator('.drawer .sample-select').click();

  const picker = page.locator('.picker');
  await expect(picker.locator('.choice')).toHaveCount(3); // « aucun » + 2 samples
  await picker.locator('.search').fill('kick');
  await expect(picker.locator('.choice')).toHaveCount(2); // « aucun » + kick
  await expect(picker.locator('.choice', { hasText: 'kick.wav' })).toBeVisible();
});
