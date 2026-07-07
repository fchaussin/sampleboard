// SPDX-License-Identifier: GPL-3.0-or-later
// Captures fastlane / manuel (M9, revu M11) — REPRODUCTIBLES : premier lancement réel
// (semis d'usine complet), viewport téléphone (393×852 @3x → 1179×2556), écrites dans
// fastlane/metadata/android/en-US/images/phoneScreenshots/.
// Huit vues couvrant le manuel : 1 board (Jeu), 2 lecture, 3 pool d'assignation (Édition),
// 4 tiroir Pad (mode/gain/couleur/cue points/pool), 5 réglages de page, 6 bibliothèque,
// 7 éditeur waveform (Découper / cue), 8 Réglages.
// Hors suite e2e normale : ne tourne qu'avec FASTLANE_SHOTS=1.
import { test, expect, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';

const OUT = 'fastlane/metadata/android/en-US/images/phoneScreenshots';
const shot = (n: number) => `${OUT}/${n}.png`;

// Nombre de sons de la banque de référence — lu du manifest (25 starter + kit batterie #28)
// pour ne pas coder en dur un total qui bouge avec les planches d'usine.
const SAMPLE_COUNT = (
  JSON.parse(readFileSync('public/factory-samples/manifest.json', 'utf8')) as { samples: unknown[] }
).samples.length;

test.skip(!process.env.FASTLANE_SHOTS, 'captures fastlane : lancer avec FASTLANE_SHOTS=1');

test.use({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

// Les tiroirs et le pool s'ouvrent en ANIMÉ (slide-in + opacité) : attendre la fin des
// animations, sinon la capture fige un panneau semi-transparent en plein vol.
async function settle(el: Locator): Promise<void> {
  await el.evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished)));
}

test('captures fastlane : board, lecture, pool, pad, page, bibliothèque, éditeur, réglages', async ({
  page,
}) => {
  // Semis d'usine complet (25 sons, banque de référence CC0) — même marge que factory-seed.
  test.setTimeout(300_000);
  await page.goto('/');
  await expect(page.locator('.grid .pad .name').first()).toHaveText('Buzzer', {
    timeout: 120_000,
  });
  // Le semis est NON bloquant (§16, #27) : attendre qu'il soit terminé — plus aucun pad
  // « (empty) » sur la page — sinon la capture fige un board à moitié rempli.
  await expect(page.locator('.grid .pad .name', { hasText: '(empty)' })).toHaveCount(0, {
    timeout: 120_000,
  });

  // 1 — board Principal semé (mode Jeu, visualiseur idle). Air horn = Gate, drones = Loop :
  // les trois modes de lecture sont visibles.
  await page.screenshot({ path: shot(1) });

  // 2 — lecture : pad Loop (drone « Suspense ») actif, visualiseur vivant.
  const loopPad = page.locator('.grid .pad', { hasText: 'Suspense' }).first();
  await loopPad.click();
  await page.waitForTimeout(600); // laisser le visualiseur prendre de l'amplitude
  await page.screenshot({ path: shot(2) });
  await loopPad.click(); // re-tap = stop (Loop)

  // Passage en Édition (livrée MIDI-map) pour les captures pool / pad / page.
  await page.locator('.bottombar .mode-toggle').click();

  // 4 — tiroir « Pad » du premier pad (Buzzer) : nom, mode, gain, couleur, sample,
  // points cue (M11) et « Add to the assignment pool ». Capturé avant de peupler le pool
  // pour que le bouton pool soit encore actif.
  const drawer = page.locator('.drawer');
  await page.locator('.grid .pad').first().click();
  await expect(drawer).toBeVisible();
  await settle(drawer);
  await page.screenshot({ path: shot(4) });

  // Peupler le pool d'assignation : le sample du pad courant + deux autres (via le tiroir).
  await drawer.locator('.pool-add').click();
  await page.locator('.drawer > header .close').click();
  for (const i of [1, 2]) {
    await page.locator('.grid .pad').nth(i).click();
    await expect(drawer).toBeVisible();
    await drawer.locator('.pool-add').click();
    await page.locator('.drawer > header .close').click();
  }

  // 3 — pool d'assignation (Édition) : liste de travail, un son ARMÉ se pose ensuite sur les pads.
  await page.locator('.bottombar .open-pool').click();
  const pool = page.locator('.pool.overlay');
  await expect(pool.locator('ul li').first()).toBeVisible();
  await settle(pool);
  // Armer le premier son du pool pour montrer l'état d'assignation actif.
  await pool.locator('ul li .item').first().click();
  await page.screenshot({ path: shot(3) });
  // Désarmer puis refermer via le bouton du tiroir pool : en overlay (étroit), le pool
  // RECOUVRE la bottombar/topbar à gauche — son propre « close » est le seul point sûr.
  await pool.locator('ul li .item').first().click(); // re-tap = désarme
  await pool.locator('.close').click(); // referme le pool

  // 5 — réglages de PAGE (depuis la topbar) : renommer, Polyphonie Mono/Poly, grille rows×cols.
  await page.locator('.topbar .page-info').click();
  await expect(drawer).toBeVisible();
  await settle(drawer);
  await page.screenshot({ path: shot(5) });
  await page.locator('.drawer > header .close').click();

  // 6 — bibliothèque : la banque de référence complète, recherche + chips de tags + actions de ligne.
  await page.locator('.bottombar .open-library').click();
  await expect(page.locator('.library .list li')).toHaveCount(SAMPLE_COUNT, { timeout: 120_000 });
  await page.screenshot({ path: shot(6) });

  // 7 — éditeur audio « Découper » / cue : waveform réelle d'un sample d'usine.
  await page.locator('.library .rework').first().click();
  const editor = page.locator('.audio-editor');
  await editor.waitFor({ timeout: 30_000 });
  await editor.locator('.times').waitFor();
  await page.waitForTimeout(500); // rendu canvas de la waveform
  await page.screenshot({ path: shot(7) });
  await editor.locator('.close').click();
  await page.locator('.close-library').click();

  // 8 — Réglages : langue, bus master / pré-écoute, Application (version, mise à jour, reset usine).
  await page.locator('.bottombar .open-settings').click();
  await expect(drawer).toBeVisible();
  await settle(drawer);
  await page.screenshot({ path: shot(8) });
});
