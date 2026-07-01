// SPDX-License-Identifier: GPL-3.0-or-later
// E2E : chaîne complète import → édition (assignation + Loop) → jeu → lecture réelle.
// Couvre le VRAI moteur Web Audio (oneShot/toggleLoop, reflet onPlayingChanged → activePadIds),
// que les tests unitaires ne voient qu'à travers un AudioContext factice.
import { test, expect } from '@playwright/test';
import { importWav } from './helpers';

test('assigner un sample importé à un pad Loop, puis le jouer → pad actif', async ({ page }) => {
  await page.goto('/');
  await importWav(page);

  // Édition : créer un pad (case « + »), le passer en Loop, lui assigner le sample.
  await page.locator('.mode-toggle').click();
  await page.locator('.cell-add').first().click();
  await page.locator('.editor').getByRole('button', { name: 'Loop' }).click();
  await page.locator('.editor select').selectOption({ label: 'tone.wav' });

  // Retour en Jeu et déclenchement du pad (le seul « idle » = celui qui porte un sample).
  await page.locator('.mode-toggle').click();
  const pad = page.locator('.grid .pad.idle');
  await expect(pad).toHaveCount(1);
  await pad.click();

  // Loop : la voix persiste → le pad reste « actif » (reflet activePadIds réel).
  await expect(page.locator('.grid .pad.active')).toHaveCount(1, { timeout: 5_000 });
});
