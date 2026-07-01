// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du générateur d'ids — dont le repli quand `crypto.randomUUID` est absent
// (contexte non sécurisé : http via IP LAN). Régression : un import réussissait mais
// `ids()` jetait, abortant silencieusement l'ajout à la bibliothèque.
import { describe, it, expect } from 'vitest';
import { newId } from '../../src/domain/id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newId', () => {
  it('génère des ids uniques, préfixe optionnel', () => {
    expect(newId()).not.toBe(newId());
    expect(newId('sample')).toMatch(/^sample-[0-9a-f]{8}-/);
  });

  it('fonctionne sans crypto.randomUUID (contexte non sécurisé)', () => {
    const proto = Object.getPrototypeOf(globalThis.crypto);
    const orig =
      Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID') ??
      Object.getOwnPropertyDescriptor(proto, 'randomUUID');
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      expect(newId()).toMatch(UUID_V4);
    } finally {
      delete (globalThis.crypto as { randomUUID?: unknown }).randomUUID;
      if (orig && !Object.getOwnPropertyDescriptor(proto, 'randomUUID')) {
        Object.defineProperty(globalThis.crypto, 'randomUUID', orig);
      }
    }
  });
});
