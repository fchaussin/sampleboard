// SPDX-License-Identifier: GPL-3.0-or-later
// Tests de la finition OGG (M8) : CRC de page, granule, pre-skip, rognage de traîne.
import { describe, it, expect } from 'vitest';
import { oggPageCrc, parseOggSampleCount, parsePreSkip, patchGranule, readGranule, trimOggTail } from '../../src/engine/ogg';

/** Page OGG factice minimale : "OggS" + version + type + granule + série + seq + crc + 0 segment. */
function makePage(granule: number): Uint8Array {
  const page = new Uint8Array(27);
  page.set([0x4f, 0x67, 0x67, 0x53]); // OggS
  let value = granule;
  for (let i = 0; i < 8; i++) {
    page[6 + i] = value % 256;
    value = Math.floor(value / 256);
  }
  return page;
}

/** Page d'en-tête factice contenant un paquet OpusHead avec pre-skip donné. */
function makeHeaderPage(preSkip: number): Uint8Array {
  const page = new Uint8Array(48);
  page.set([0x4f, 0x67, 0x67, 0x53]);
  const head = [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64]; // "OpusHead"
  page.set(head, 28);
  page[28 + 10] = preSkip & 0xff;
  page[28 + 11] = (preSkip >> 8) & 0xff;
  return page;
}

describe('oggPageCrc', () => {
  it('vecteur de référence (calculé indépendamment) : CRC(« 123456789 ») = 0x89a1897f', () => {
    const bytes = new Uint8Array([0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39]);
    expect(oggPageCrc(bytes) >>> 0).toBe(0x89a1897f);
  });
});

describe('granule & pre-skip', () => {
  it('readGranule/patchGranule : aller-retour, source intacte, CRC réécrit', () => {
    const page = makePage(123456789);
    expect(readGranule(page)).toBe(123456789);
    const patched = patchGranule(page, 4242);
    expect(readGranule(patched)).toBe(4242);
    expect(readGranule(page)).toBe(123456789); // copie
    const crc = patched[22]! | (patched[23]! << 8) | (patched[24]! << 16) | ((patched[25]! << 24) >>> 0);
    const zeroed = patched.slice();
    zeroed[22] = zeroed[23] = zeroed[24] = zeroed[25] = 0;
    expect(oggPageCrc(zeroed) >>> 0).toBe(crc >>> 0); // CRC cohérent avec le contenu
  });

  it('parsePreSkip lit le u16 après « OpusHead » ; null si absent', () => {
    expect(parsePreSkip(makeHeaderPage(3840))).toBe(3840);
    expect(parsePreSkip(makePage(0))).toBeNull();
  });
});

describe('trimOggTail', () => {
  it('borne la granule finale à pre-skip + échantillons réels', () => {
    const pages = [makeHeaderPage(3840), makePage(3840 + 48000 + 4416)]; // ~92 ms de traîne
    const trimmed = trimOggTail(pages, 48000);
    expect(readGranule(trimmed[1]!)).toBe(3840 + 48000);
    expect(readGranule(pages[1]!)).toBe(3840 + 48000 + 4416); // source intacte
  });

  it('no-op si la granule n’excède pas la cible ou si l’en-tête est illisible', () => {
    const exact = [makeHeaderPage(3840), makePage(3840 + 48000)];
    expect(trimOggTail(exact, 48000)).toBe(exact);
    const broken = [makePage(0), makePage(999999)];
    expect(trimOggTail(broken, 48000)).toBe(broken);
  });
});

describe('parseOggSampleCount', () => {
  it('granule finale − pre-skip sur un flux concaténé ; null si non-Ogg', () => {
    const stream = new Uint8Array([
      ...makeHeaderPage(312),
      ...makePage(312 + 48000),
    ]);
    expect(parseOggSampleCount(stream)).toBe(48000);
    expect(parseOggSampleCount(new Uint8Array(16))).toBeNull();
  });
});
