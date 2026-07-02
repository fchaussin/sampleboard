// SPDX-License-Identifier: GPL-3.0-or-later
// Implémentation runes du contrat `Watch` (persistence.ts) : un $effect sous $effect.root
// relit `read` à chaque mutation de ce qu'il consulte. Le premier passage (abonnement) ne
// déclenche PAS onChange — l'état vient d'être hydraté, rien à sauvegarder.
// Seul pont entre la réactivité Svelte et la couche app ; le reste demeure TS pur.
import { untrack } from 'svelte';
import type { Watch } from './persistence';

export function createRunesWatch(): Watch {
  return (read, onChange) =>
    $effect.root(() => {
      let first = true;
      $effect(() => {
        const value = read();
        if (first) {
          first = false;
          return;
        }
        // untrack : le traitement du changement ne doit pas élargir les dépendances de l'effet.
        untrack(() => onChange(value));
      });
    });
}
