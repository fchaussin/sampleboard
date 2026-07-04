// SPDX-License-Identifier: GPL-3.0-or-later
// Navigation pilotée par l'URL (#23, spec §16) : la vue affichée est une PROJECTION de
// l'URL, jamais une variable indépendante. Module PUR (aucun accès navigateur) :
// identifiants de vue, résolution fragment → route (avec cas par défaut) et sérialisation
// route → fragment. La table vue → composant vit dans App.svelte (couche ui).
import type { LibraryFilter } from './store.svelte';

/** Identifiants des vues de <main> — clés de la table vue → composant (App.svelte). */
export type ViewId = 'board' | 'library';

/** Route résolue : la vue et ses paramètres variables décodés (cardinalité vue + paramètres). */
export type Route = { view: 'board' } | { view: 'library'; filter: LibraryFilter };

/** Cas par défaut de la résolution : URL vide ou inconnue → le board. */
export const DEFAULT_ROUTE: Route = { view: 'board' };

/** Sérialise une route en fragment — toute écriture d'URL passe par là (via le routeur). */
export function formatHash(route: Route): string {
  if (route.view === 'library' && route.filter !== null) {
    return `#/library?tag=${encodeURIComponent(route.filter)}`;
  }
  return route.view === 'library' ? '#/library' : '#/board';
}

/** Résout un fragment en route, ou `null` si l'URL est inconnue (le routeur normalisera). */
export function parseHash(hash: string): Route | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const queryAt = raw.indexOf('?');
  const path = queryAt === -1 ? raw : raw.slice(0, queryAt);
  const query = queryAt === -1 ? '' : raw.slice(queryAt + 1);
  if (path === '/board') return { view: 'board' };
  if (path === '/library') {
    const tag = new URLSearchParams(query).get('tag');
    return { view: 'library', filter: tag === null || tag === '' ? null : tag };
  }
  return null;
}
