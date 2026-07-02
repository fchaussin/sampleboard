// SPDX-License-Identifier: GPL-3.0-or-later
// Finition du flux OGG/Opus (M8) — l'encodeur WASM comble son dernier tampon avec du
// SILENCE (traîne audible, gap en Loop). Le remède standard Ogg-Opus : la granule position
// de la DERNIÈRE page fixe la durée réelle — les décodeurs rognent l'excédent nativement.
// On la réécrit ici (+ recalcul du CRC de page). TS pur, testable.

/** Table CRC-32 d'Ogg (polynôme 0x04c11db7, non réfléchi, init 0, sans xorout). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let r = n << 24;
    for (let k = 0; k < 8; k++) {
      r = r & 0x80000000 ? ((r << 1) ^ 0x04c11db7) >>> 0 : (r << 1) >>> 0;
    }
    table[n] = r >>> 0;
  }
  return table;
})();

/** CRC d'une page OGG (champ CRC supposé à zéro dans `bytes`). */
export function oggPageCrc(bytes: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
    crc = (((crc << 8) >>> 0) ^ CRC_TABLE[((crc >>> 24) ^ bytes[i]!) & 0xff]!) >>> 0;
  }
  return crc >>> 0;
}

/** Lit le pre-skip (échantillons 48 kHz) dans la page d'en-tête OpusHead ; null si absent. */
export function parsePreSkip(headerPage: Uint8Array): number | null {
  // Motif ASCII « OpusHead » ; pre-skip = u16 little-endian à +10 du motif.
  const pattern = [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64];
  for (let i = 0; i + pattern.length + 12 <= headerPage.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (headerPage[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) return headerPage[i + 10]! | (headerPage[i + 11]! << 8);
  }
  return null;
}

/** Granule position (u64 LE, offset 6) d'une page OGG — lue en Number (durées réalistes). */
export function readGranule(page: Uint8Array): number {
  let value = 0;
  for (let i = 7; i >= 0; i--) value = value * 256 + page[6 + i]!;
  return value;
}

/** Réécrit granule position + CRC d'une page (copie ; la source reste intacte). */
export function patchGranule(page: Uint8Array, granule: number): Uint8Array {
  const out = page.slice();
  let value = granule;
  for (let i = 0; i < 8; i++) {
    out[6 + i] = value % 256;
    value = Math.floor(value / 256);
  }
  // CRC : champ (offsets 22..25) à zéro pendant le calcul, puis écrit en little-endian.
  out[22] = out[23] = out[24] = out[25] = 0;
  const crc = oggPageCrc(out);
  out[22] = crc & 0xff;
  out[23] = (crc >>> 8) & 0xff;
  out[24] = (crc >>> 16) & 0xff;
  out[25] = (crc >>> 24) & 0xff;
  return out;
}

/**
 * Borne la durée du flux aux échantillons réellement fournis : granule de la dernière
 * page = pre-skip + `samples48k`. No-op si la granule actuelle n'excède pas la cible ou
 * si le flux est illisible (on ne casse jamais un OGG valide).
 */
export function trimOggTail(pages: Uint8Array[], samples48k: number): Uint8Array[] {
  const first = pages[0];
  const last = pages[pages.length - 1];
  if (!first || !last) return pages;
  const preSkip = parsePreSkip(first);
  if (preSkip === null) return pages;
  const target = preSkip + samples48k;
  if (readGranule(last) <= target) return pages;
  return [...pages.slice(0, -1), patchGranule(last, target)];
}

/**
 * Échantillons 48 kHz ANNONCÉS par un flux Ogg-Opus complet (granule de la dernière page
 * − pre-skip), ou null si le flux est illisible. Sert au moteur : decodeAudioData (Chromium)
 * ignore la granule finale et restitue le padding de l'encodeur — on rogne d'après ceci.
 */
export function parseOggSampleCount(bytes: Uint8Array): number | null {
  const preSkip = parsePreSkip(bytes);
  if (preSkip === null) return null;
  let lastPage = -1;
  for (let i = 0; i + 27 <= bytes.length; i++) {
    if (bytes[i] === 0x4f && bytes[i + 1] === 0x67 && bytes[i + 2] === 0x67 && bytes[i + 3] === 0x53) {
      lastPage = i;
    }
  }
  if (lastPage < 0) return null;
  const samples = readGranule(bytes.subarray(lastPage)) - preSkip;
  return samples >= 0 ? samples : null;
}
