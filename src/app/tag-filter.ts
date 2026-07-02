// SPDX-License-Identifier: GPL-3.0-or-later
// Filtre de bibliothèque (M8) — logique PURE, partagée par le panneau Bibliothèque et la
// modale de choix de sample. « Non classé » = absence d'affectation (décision §16).
import type { Sample } from '../domain/types';
import type { LibraryFilter } from './store.svelte';

/** Vrai si le sample passe le filtre (tag, 'untagged' virtuel, ou null = tous). */
export function matchesFilter(
  sampleId: string,
  sampleTags: ReadonlyMap<string, ReadonlySet<string>>,
  filter: LibraryFilter,
): boolean {
  if (filter === null) return true;
  const tags = sampleTags.get(sampleId);
  if (filter === 'untagged') return !tags || tags.size === 0;
  return tags?.has(filter) ?? false;
}

/** Samples passant le filtre, et une recherche texte optionnelle sur le label. */
export function filterSamples(
  samples: readonly Sample[],
  sampleTags: ReadonlyMap<string, ReadonlySet<string>>,
  filter: LibraryFilter,
  search = '',
): Sample[] {
  const needle = search.trim().toLocaleLowerCase();
  return samples.filter(
    (s) =>
      matchesFilter(s.id, sampleTags, filter) &&
      (needle === '' || s.label.toLocaleLowerCase().includes(needle)),
  );
}
