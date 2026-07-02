// SPDX-License-Identifier: GPL-3.0-or-later
// Banque par défaut : premier lancement (base vide) et fallback web nu sans persistance.
// Une page 4×4 Poly sans pad — l'app est livrée vide (§2), tout se construit en Édition.
import type { Bank } from '../domain/types';
import { DEFAULT_COLS, DEFAULT_ROWS } from '../domain/invariants';
import { newId } from '../domain/id';

export function createDefaultBank(ids: () => string = () => newId()): Bank {
  return {
    id: ids(),
    name: '',
    pages: [
      {
        id: ids(),
        name: '',
        voiceMode: 'poly',
        rows: DEFAULT_ROWS,
        cols: DEFAULT_COLS,
        position: 0,
      },
    ],
    pads: [],
  };
}
