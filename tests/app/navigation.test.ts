// SPDX-License-Identifier: GPL-3.0-or-later
// Tests de la résolution d'URL (#23) : fragment → route (cas par défaut : null → le routeur
// normalise) et sérialisation route → fragment. Module pur, aucun navigateur.
import { describe, it, expect } from 'vitest';
import { formatHash, parseHash, type Route } from '../../src/app/navigation';

describe('parseHash — résolution fragment → route', () => {
  it('résout les vues connues, avec ou sans « # » de tête', () => {
    expect(parseHash('#/board')).toEqual({ view: 'board' });
    expect(parseHash('/board')).toEqual({ view: 'board' });
    expect(parseHash('#/library')).toEqual({ view: 'library', filter: null });
  });

  it('décode le paramètre de filtre de la bibliothèque (tag, « untagged »)', () => {
    expect(parseHash('#/library?tag=t1')).toEqual({ view: 'library', filter: 't1' });
    expect(parseHash('#/library?tag=untagged')).toEqual({ view: 'library', filter: 'untagged' });
    expect(parseHash('#/library?tag=')).toEqual({ view: 'library', filter: null }); // vide = aucun
  });

  it('renvoie null pour une URL vide ou inconnue (le routeur normalisera)', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#')).toBeNull();
    expect(parseHash('#/nawak')).toBeNull();
    expect(parseHash('#/board/extra')).toBeNull();
  });
});

describe('formatHash — sérialisation route → fragment', () => {
  it('sérialise les vues et omet le paramètre absent', () => {
    expect(formatHash({ view: 'board' })).toBe('#/board');
    expect(formatHash({ view: 'library', filter: null })).toBe('#/library');
    expect(formatHash({ view: 'library', filter: 't1' })).toBe('#/library?tag=t1');
  });

  it('aller-retour stable, y compris identifiants à caractères réservés', () => {
    const routes: Route[] = [
      { view: 'board' },
      { view: 'library', filter: null },
      { view: 'library', filter: 'untagged' },
      { view: 'library', filter: 'id avec espaces&=#' },
    ];
    for (const route of routes) expect(parseHash(formatHash(route))).toEqual(route);
  });
});
