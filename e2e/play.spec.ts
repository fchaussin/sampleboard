// SPDX-License-Identifier: GPL-3.0-or-later
// E2E : chaîne complète import → édition (assignation + Loop, via le tiroir) → jeu →
// lecture réelle. Couvre le VRAI moteur Web Audio (oneShot/toggleLoop, reflet
// onPlayingChanged → activePadIds) ET le nouvel agencement §11 (bottombar, tiroir).
import { test, expect } from '@playwright/test';
import { importWav } from './helpers';

test('assigner un sample importé à un pad Loop (tiroir), puis le jouer → pad actif', async ({ page }) => {
  await page.goto('/');
  await importWav(page);

  // Édition : le board naît COMPLET (M6) — tap sur le premier pad → son tiroir s'ouvre.
  await page.locator('.bottombar .mode-toggle').click();
  await page.locator('.grid .pad').first().click();
  const drawer = page.locator('.drawer');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Loop' }).click();
  // Assignation via la modale de choix de sample (<dialog>).
  await drawer.locator('.sample-select').click();
  await page.locator('.picker .choice', { hasText: 'tone.wav' }).click();

  // Fermer le tiroir (le voile couvre la bottombar), puis retour en Jeu.
  // `> header` : le ✕ du tiroir lui-même, pas celui de la modale imbriquée.
  await drawer.locator('> header .close').click();
  await expect(drawer).not.toBeVisible();
  await page.locator('.bottombar .mode-toggle').click();
  const pad = page.locator('.grid .pad.idle');
  await expect(pad).toHaveCount(1);
  await pad.click();

  // Loop : la voix persiste → pad « actif », bouton stop, et les visualiseurs tracent
  // (onde dans le pad + visualiseur global de la topbar).
  await expect(page.locator('.grid .pad.active')).toHaveCount(1, { timeout: 5_000 });
  await expect(page.locator('.grid .pad-stop')).toHaveCount(1);
  await expect(page.locator('.grid .pad.active canvas')).toHaveCount(1);
  await expect(page.locator('.topbar canvas')).toBeVisible();

  // Stop du pad (bouton en bas à droite du pad) : la voix s'arrête.
  await page.locator('.grid .pad-stop').click();
  await expect(page.locator('.grid .pad.active')).toHaveCount(0, { timeout: 5_000 });

  // Rejouer, puis Stop général (bottombar) : même résultat.
  await page.locator('.grid .pad.idle').click();
  await expect(page.locator('.grid .pad.active')).toHaveCount(1, { timeout: 5_000 });
  await page.locator('.bottombar .stop').click();
  await expect(page.locator('.grid .pad.active')).toHaveCount(0, { timeout: 5_000 });
});
