// SPDX-License-Identifier: GPL-3.0-or-later
// Captures fastlane (M9) — REPRODUCTIBLES : premier lancement réel (semis d'usine complet),
// viewport téléphone (393×852 @3x → 1179×2556), écrit directement dans
// fastlane/metadata/android/fr-FR/images/phoneScreenshots/.
// Hors suite e2e normale : ne tourne qu'avec FASTLANE_SHOTS=1 (npm run shots:fastlane).
import { test, expect } from '@playwright/test';

const OUT = 'fastlane/metadata/android/en-US/images/phoneScreenshots';
const shot = (n: number) => `${OUT}/${n}.png`;

test.skip(!process.env.FASTLANE_SHOTS, 'captures fastlane : lancer avec FASTLANE_SHOTS=1');

test.use({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

test('captures fastlane : board, lecture, bibliothèque, éditeur, édition', async ({ page }) => {
  // Semis d'usine complet (25 sons, banque de référence CC0) — même marge que factory-seed.
  test.setTimeout(300_000);
  await page.goto('/');
  await expect(page.locator('.grid .pad .name').first()).toHaveText('Buzzer', {
    timeout: 120_000,
  });

  // 1 — board Principal semé (mode Jeu, visualiseur idle).
  await page.screenshot({ path: shot(1) });

  // 2 — lecture : pad Loop (drone « Suspense ») actif, visualiseur vivant.
  const loopPad = page.locator('.grid .pad', { hasText: 'Suspense' }).first();
  await loopPad.click();
  await page.waitForTimeout(600); // laisser le visualiseur prendre de l'amplitude
  await page.screenshot({ path: shot(2) });
  await loopPad.click(); // re-tap = stop (Loop)

  // 3 — bibliothèque : la banque de référence complète, recherche + chips de tags.
  await page.locator('.bottombar .open-library').click();
  await expect(page.locator('.library .list li')).toHaveCount(25, { timeout: 120_000 });
  await page.screenshot({ path: shot(3) });

  // 4 — éditeur audio « Découper » : waveform réelle d'un sample d'usine.
  await page.locator('.library .rework').first().click();
  const editor = page.locator('.audio-editor');
  await editor.waitFor({ timeout: 30_000 });
  await editor.locator('.times').waitFor();
  await page.waitForTimeout(500); // rendu canvas de la waveform
  await page.screenshot({ path: shot(4) });
  await editor.locator('.close').click();
  await page.locator('.close-library').click();

  // 5 — mode Édition (livrée MIDI-map) + tiroir de réglages du pad.
  await page.locator('.bottombar .mode-toggle').click();
  await page.locator('.grid .pad').first().click();
  await expect(page.locator('.drawer')).toBeVisible();
  // L'ouverture du tiroir est ANIMÉE (slide-in 160 ms, opacité 0,4 → 1) : attendre la fin
  // des animations, sinon la capture fige un tiroir semi-transparent en plein vol.
  await page
    .locator('.drawer')
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await page.screenshot({ path: shot(5) });
});
