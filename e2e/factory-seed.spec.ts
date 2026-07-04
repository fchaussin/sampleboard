// SPDX-License-Identifier: GPL-3.0-or-later
// E2E #14 : PREMIER lancement réel (sans blocage du manifest) — le semis d'usine remplit la
// bibliothèque depuis public/factory-samples/ et pré-assigne la sélection « board » à la
// page Principal. Non bloquant : l'app est jouable pendant le remplissage.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openLibrary } from './helpers';

const manifest = JSON.parse(readFileSync('public/factory-samples/manifest.json', 'utf8')) as {
  samples: unknown[];
  board: unknown[];
};

test('semis d’usine : bibliothèque remplie et board Principal pré-assigné', async ({ page }) => {
  // Le semis complet (25 sons, banque de référence CC0) peut dépasser le timeout Playwright
  // par défaut (30 s) — l'aligner sur les timeouts des assertions ci-dessous.
  test.setTimeout(180_000);
  await page.goto('/');

  // La grille est disponible immédiatement (semis non bloquant)…
  await page.locator('.grid .pad').first().waitFor();

  // …et le pad du premier slot board finit nommé d'après son sample (« Buzzer »).
  await expect(page.locator('.grid .pad .name').first()).toHaveText('Buzzer', {
    timeout: 120_000,
  });

  // Bibliothèque : tous les samples du manifest sont là.
  await openLibrary(page);
  await expect(page.locator('.library .list li')).toHaveCount(manifest.samples.length, {
    timeout: 120_000,
  });
});
