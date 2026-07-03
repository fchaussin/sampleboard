// SPDX-License-Identifier: GPL-3.0-or-later
// E2E M8 : tags (semis par défaut, affectation), filtres (dont « Non classé » virtuel),
// assignation page→pad depuis la bibliothèque, recherche dans la modale de sample.
import { test, expect } from '@playwright/test';
import { gotoApp, importWav, openLibrary } from './helpers';

test('taguer, filtrer (tag et Non classé), assigner un pad depuis la bibliothèque', async ({ page }) => {
  await gotoApp(page);
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

  // Assignation À LA VOLÉE (#11) : bouton DIRECT sur la ligne → le panneau se ferme →
  // chaque pad touché reçoit le sample → Terminer.
  await filters.locator('.chip', { hasText: 'Tous' }).click();
  await page.locator('.library .assign-start').click();
  await expect(page.locator('.banner')).toBeVisible(); // bannière du mode
  await page.locator('.grid .pad').nth(0).click();
  await page.locator('.grid .pad').nth(5).click();
  await expect(page.locator('.grid .pad.idle')).toHaveCount(2); // multi-pads, à la volée
  await page.locator('.banner button').click(); // Terminer
  await expect(page.locator('.banner')).toHaveCount(0);
});

test('modale de choix de sample : la recherche filtre la liste (#12)', async ({ page }) => {
  await gotoApp(page);
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

test('pool : stocker deux samples, armer depuis le tiroir gauche, assigner à la volée', async ({ page }) => {
  await gotoApp(page);
  await importWav(page, 'kick.wav');
  await importWav(page, 'nappe.wav');

  // Ajouter les deux samples au pool depuis la bibliothèque.
  await openLibrary(page);
  await page.locator('.library .pool-add').nth(0).click(); // boutons directs par ligne
  await page.locator('.library .pool-add').nth(1).click();
  await page.locator('.close-library').click();

  // Tiroir gauche : armer le premier, assigner deux pads ; armer le second, un pad.
  await page.locator('.bottombar .open-pool').click();
  const pool = page.locator('.pool');
  await expect(pool.locator('.item')).toHaveCount(2);
  await pool.locator('.item', { hasText: 'kick.wav' }).click();
  await expect(page.locator('.banner')).toBeVisible();
  await page.locator('.grid .pad').nth(1).click();
  await page.locator('.grid .pad').nth(2).click();
  await pool.locator('.item', { hasText: 'nappe.wav' }).click(); // ré-arme l'autre
  await page.locator('.grid .pad').nth(3).click();
  await expect(page.locator('.grid .pad.idle')).toHaveCount(3);
  await page.locator('.banner button').click(); // Terminer
  await pool.locator('.close').click();
  await expect(page.locator('.pool')).toHaveCount(0);
});
