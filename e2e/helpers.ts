// SPDX-License-Identifier: GPL-3.0-or-later
// Utilitaires E2E partagés.
import type { Page } from '@playwright/test';

/** Génère un WAV PCM 16-bit (mono ou stéréo, sinus) — décodable partout, sans fixture binaire. */
export function makeWav(seconds = 0.25, sampleRate = 44100, freq = 440, channels = 1): Buffer {
  const n = Math.floor(sampleRate * seconds);
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const data = Buffer.alloc(n * blockAlign);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.5 * 32767);
    for (let c = 0; c < channels; c++) data.writeInt16LE(v, i * blockAlign + c * bytesPerSample);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/**
 * Ouvre l'app SANS semis d'usine (#14) : en navigateur, chaque chargement est un « premier
 * lancement » (dépôts mémoire) et le semis remplirait bibliothèque et board — ces scénarios
 * exigent une app vierge et déterministe. Le semis réel a son spec dédié (factory-seed.spec.ts).
 */
export async function gotoApp(page: Page): Promise<void> {
  await page.route('**/factory-samples/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
}

/** Ouvre le panneau Bibliothèque depuis la bottombar. */
export async function openLibrary(page: Page): Promise<void> {
  await page.locator('.bottombar .open-library').click();
}

/** Valide l'éditeur audio (M7 : tout import l'ouvre) sans toucher à la sélection. */
export async function applyAudioEditor(page: Page): Promise<void> {
  const editor = page.locator('.audio-editor');
  await editor.waitFor({ timeout: 20_000 });
  await editor.locator('.apply').click();
  await editor.waitFor({ state: 'hidden', timeout: 20_000 });
}

/**
 * Ouvre la MODALE d'import (#13 : l'import passe par elle, plus d'input direct) depuis le
 * bouton `opener`, puis y sélectionne le fichier — un seul fichier audio → éditeur M7.
 */
export async function pickImportFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
  opener = '.bottombar .import',
): Promise<void> {
  await page.locator(opener).click();
  await page.locator('.import-modal input[type=file]').setInputFiles(file);
}

/**
 * Importe un WAV via l'« Import rapide » de la bottombar (éditeur audio validé plage
 * complète), vérifie son apparition dans le panneau Bibliothèque, puis referme le panneau.
 */
export async function importWav(page: Page, name = 'tone.wav', seconds = 0.25): Promise<void> {
  await pickImportFile(page, { name, mimeType: 'audio/wav', buffer: makeWav(seconds) });
  await applyAudioEditor(page);
  await openLibrary(page);
  await page.locator('.library .list li').first().waitFor({ timeout: 20_000 });
  await page.locator('.close-library').click();
}
