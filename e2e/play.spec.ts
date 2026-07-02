// SPDX-License-Identifier: GPL-3.0-or-later
// E2E : chaîne complète import → édition (assignation + Loop, via le tiroir) → jeu →
// lecture réelle. Couvre le VRAI moteur Web Audio (oneShot/toggleLoop, reflet
// onPlayingChanged → activePadIds) ET le nouvel agencement §11 (bottombar, tiroir).
import { test, expect } from '@playwright/test';
import { importWav } from './helpers';

test('assigner un sample importé à un pad Loop (tiroir), puis le jouer → pad actif', async ({ page }) => {
  await page.goto('/');
  await importWav(page);

  // Édition : créer un pad (case « + ») → son tiroir s'ouvre ; Loop + assignation.
  await page.locator('.bottombar .mode-toggle').click();
  await page.locator('.cell-add').first().click();
  const drawer = page.locator('.drawer');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Loop' }).click();
  await drawer.locator('select').selectOption({ label: 'tone.wav' });

  // Fermer le tiroir (le voile couvre la bottombar), puis retour en Jeu.
  await drawer.locator('.close').click();
  await expect(drawer).not.toBeVisible();
  await page.locator('.bottombar .mode-toggle').click();
  const pad = page.locator('.grid .pad.idle');
  await expect(pad).toHaveCount(1);
  await pad.click();

  // Loop : la voix persiste → le pad reste « actif » (reflet activePadIds réel).
  await expect(page.locator('.grid .pad.active')).toHaveCount(1, { timeout: 5_000 });

  // Stop général (bottombar) : la voix s'arrête, le pad n'est plus actif.
  await page.locator('.bottombar .stop').click();
  await expect(page.locator('.grid .pad.active')).toHaveCount(0, { timeout: 5_000 });
});
