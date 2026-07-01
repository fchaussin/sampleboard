// SPDX-License-Identifier: GPL-3.0-or-later
// Utilitaires E2E partagés.
import type { Page } from '@playwright/test';

/** Génère un WAV PCM 16-bit mono (sinus) — décodable partout, sans fixture binaire. */
export function makeWav(seconds = 0.25, sampleRate = 44100, freq = 440): Buffer {
  const n = Math.floor(sampleRate * seconds);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const s = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.5;
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Importe un WAV via la Bibliothèque et attend son apparition dans la liste. */
export async function importWav(page: Page, name = 'tone.wav'): Promise<void> {
  await page
    .locator('.library input[type=file]')
    .setInputFiles({ name, mimeType: 'audio/wav', buffer: makeWav() });
  await page.locator('.library .list li').first().waitFor({ timeout: 20_000 });
}
