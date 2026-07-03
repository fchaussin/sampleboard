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
  await importWav(page, 'kick.wav', 5); // 5 s : la pré-écoute couvre les assertions
  await importWav(page, 'nappe.wav');

  await page.locator('.bottombar .mode-toggle').click();
  await page.locator('.grid .pad').first().click();
  await page.locator('.drawer .sample-select').click();

  const picker = page.locator('.picker');
  await expect(picker.locator('.choice')).toHaveCount(3); // « aucun » + 2 samples
  await picker.locator('.search').fill('kick');
  await expect(picker.locator('.choice')).toHaveCount(2); // « aucun » + kick
  await expect(picker.locator('.choice', { hasText: 'kick.wav' })).toBeVisible();

  // Même règle que la bibliothèque : chercher pendant une pré-écoute la stoppe.
  const preview = picker.locator('.preview').first();
  await preview.click();
  await expect(preview).toHaveClass(/active/);
  await picker.locator('.search').fill('kic');
  await expect(preview).not.toHaveClass(/active/);
});

test('bibliothèque : la recherche filtre la liste ; « aucun résultat » propose Tout afficher', async ({ page }) => {
  await gotoApp(page);
  await importWav(page, 'kick.wav');
  await importWav(page, 'nappe.wav');
  await openLibrary(page);

  const library = page.locator('.library');
  await expect(library.locator('.list li')).toHaveCount(2);
  await library.locator('.search').fill('kick');
  await expect(library.locator('.list li')).toHaveCount(1);
  await expect(library.locator('.list .label')).toHaveValue('kick.wav');

  // Sans correspondance : message + bouton de réinitialisation (recherche ET filtre).
  await library.locator('.search').fill('zzz');
  await expect(library.locator('.list')).toHaveCount(0);
  await library.locator('.empty .chip').click();
  await expect(library.locator('.search')).toHaveValue('');
  await expect(library.locator('.list li')).toHaveCount(2);
});

test('pré-écoute : ▶ bascule en ■ ; re-tap ou toute autre action stoppe', async ({ page }) => {
  await gotoApp(page);
  await importWav(page, 'nappe.wav', 5); // 5 s : la lecture couvre les assertions
  await openLibrary(page);

  const preview = page.locator('.library .preview').first();
  await preview.click();
  await expect(preview).toHaveClass(/active/); // ▶ → ■
  await preview.click(); // re-tap : stop
  await expect(preview).not.toHaveClass(/active/);

  await preview.click();
  await page.locator('.library .tags-toggle').click(); // autre action → stop
  await expect(preview).not.toHaveClass(/active/);

  await preview.click();
  await page.locator('.library .search').fill('x'); // la recherche aussi (elle peut masquer le ■)
  await expect(page.locator('.library .preview')).toHaveCount(0); // ligne filtrée…
  await page.locator('.library .search').fill('');
  await expect(preview).not.toHaveClass(/active/); // …et la pré-écoute a bien été stoppée
});

test('pool (#18, Édition seulement) : stocker deux samples, armer depuis la sidebar, assigner à la volée', async ({ page }) => {
  await gotoApp(page);
  await importWav(page, 'kick.wav');
  await importWav(page, 'nappe.wav');

  // Ajouter les deux samples au pool depuis la bibliothèque.
  await openLibrary(page);
  await page.locator('.library .pool-add').nth(0).click(); // boutons directs par ligne
  await page.locator('.library .pool-add').nth(1).click();
  await page.locator('.close-library').click();

  // Le pool est un outil d'ÉDITION : rien en mode Jeu ; en Édition (écran large), la
  // SIDEBAR apparaît systématiquement, sans bouton.
  await expect(page.locator('.pool')).toHaveCount(0);
  await page.locator('.bottombar .mode-toggle').click();

  // Sidebar : armer le premier, assigner deux pads ; armer le second, un pad.
  const pool = page.locator('.pool');
  await expect(pool).toBeVisible();
  await expect(pool.locator('.item')).toHaveCount(2);
  await pool.locator('.item', { hasText: 'kick.wav' }).click();
  await expect(page.locator('.banner')).toBeVisible();
  await page.locator('.grid .pad').nth(1).click();
  await page.locator('.grid .pad').nth(2).click();
  await pool.locator('.item', { hasText: 'nappe.wav' }).click(); // ré-arme l'autre
  await page.locator('.grid .pad').nth(3).click();
  await expect(page.locator('.grid .pad.idle')).toHaveCount(3);
  await page.locator('.banner button').click(); // Terminer

  // « Vider » vide d'un coup ; retour en Jeu → le pool disparaît avec son mode.
  await pool.locator('.clear').click();
  await expect(pool.locator('.item')).toHaveCount(0);
  await page.locator('.bottombar .mode-toggle').click();
  await expect(page.locator('.pool')).toHaveCount(0);
});

test('pool (#18) : glisser une ligne de bibliothèque vers le pool, puis un élément du pool vers un pad', async ({ page }) => {
  await gotoApp(page);
  await importWav(page, 'kick.wav');

  // Édition → sidebar pool (vide), puis bibliothèque par-dessus : le pool flotte au-dessus.
  await page.locator('.bottombar .mode-toggle').click();
  const pool = page.locator('.pool');
  await expect(pool.locator('.item')).toHaveCount(0);
  await pool.locator('.add').click(); // bouton « Ajouter » → ouvre la bibliothèque

  // DnD bibliothèque → pool (prise sur .meta : le champ de renommage ne glisse pas ;
  // le nom vit dans un <input>, invisible pour hasText → unique ligne = first).
  await page.locator('.library .list li').first().locator('.meta').dragTo(pool);
  await expect(pool.locator('.item', { hasText: 'kick.wav' })).toHaveCount(1);
  await page.locator('.close-library').click();

  // DnD pool → pad : assignation directe, sans passer par le mode armé.
  const pad = page.locator('.grid .pad').nth(5);
  await pool.locator('li', { hasText: 'kick.wav' }).dragTo(pad);
  await expect(page.locator('.grid .pad.idle')).toHaveCount(1);
  await expect(pad).toHaveClass(/idle/);
});

test('gestion des tags dans le tiroir droit (#20) : créer, voir le filtre derrière, fermer', async ({ page }) => {
  await gotoApp(page);
  await importWav(page);
  await openLibrary(page);

  // « Gérer les tags » ouvre le TIROIR droit PAR-DESSUS le panneau bibliothèque.
  await page.locator('.manage-tags').click();
  const drawer = page.locator('.drawer');
  await expect(drawer).toBeVisible();

  // Créer un tag depuis le tiroir : la barre de filtres, visible derrière, l'affiche.
  await drawer.locator('.add-tag input').fill('Bruitages');
  await drawer.locator('.add-tag button').click();
  await expect(page.locator('.library .filters .chip', { hasText: 'Bruitages' })).toBeVisible();

  await drawer.locator('.close').click();
  await expect(drawer).toHaveCount(0);
  await expect(page.locator('.library')).toBeVisible(); // la bibliothèque n'a pas bougé
});
