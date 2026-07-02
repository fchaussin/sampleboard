// SPDX-License-Identifier: GPL-3.0-or-later
// Tests M6 : validation des tokens de palette + nom de pad par défaut (label rogné).
import { describe, it, expect } from 'vitest';
import { COLORS } from '../../src/domain/enums';
import { defaultPadName, isValidColor, PAD_NAME_MAX } from '../../src/domain/invariants';

describe('isValidColor', () => {
  it('accepte chaque token de la palette', () => {
    for (const color of COLORS) expect(isValidColor(color)).toBe(true);
  });

  it('refuse tout le reste', () => {
    expect(isValidColor('fuchsia-disco')).toBe(false);
    expect(isValidColor('')).toBe(false);
    expect(isValidColor(null)).toBe(false);
    expect(isValidColor(3)).toBe(false);
  });
});

describe('defaultPadName', () => {
  it('retire l’extension et rogne à 12 caractères', () => {
    expect(defaultPadName('kick.wav')).toBe('kick');
    expect(defaultPadName('explosion-de-fin-du-monde.mp3')).toBe('explosion-de');
    expect(defaultPadName('explosion-de-fin-du-monde.mp3').length).toBe(PAD_NAME_MAX);
  });

  it('sans extension : rogne simplement', () => {
    expect(defaultPadName('ambiance nocturne forêt')).toBe('ambiance noc');
  });

  it('ne mange pas un nom à points sans extension finale courte', () => {
    expect(defaultPadName('v1.2 intro.ogg')).toBe('v1.2 intro');
  });

  it('espaces de bord rognés', () => {
    expect(defaultPadName('la .wav')).toBe('la');
  });
});
