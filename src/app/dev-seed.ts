// SPDX-License-Identifier: GPL-3.0-or-later
// TEMP(M2/M3) : banque de départ pour avoir des pages/pads avant la persistance (M5).
// Depuis M4, la bibliothèque se remplit par l'import réel : les pads seed démarrent vides
// (sampleId null) et sont assignés depuis la bibliothèque en Édition. À retirer au M5
// (hydratation SQLite).
import type { Bank, Pad } from '../domain/types';
import { DEFAULT_GAIN_DB } from '../domain/invariants';

function pad(id: string, pageId: string, name: string, position: number, playMode: Pad['playMode']): Pad {
  return { id, pageId, name, position, playMode, sampleId: null, gainDb: DEFAULT_GAIN_DB };
}

export function createSeedBank(): Bank {
  const poly = 'seed-page-poly';
  const mono = 'seed-page-mono';
  return {
    id: 'seed-bank',
    name: 'Demo',
    pages: [
      { id: poly, name: 'Poly', voiceMode: 'poly', rows: 4, cols: 4, position: 0 },
      { id: mono, name: 'Mono', voiceMode: 'mono', rows: 4, cols: 4, position: 1 },
    ],
    pads: [
      pad('seed-p-1', poly, '', 0, 'oneShot'),
      pad('seed-p-2', poly, '', 1, 'gate'),
      pad('seed-p-3', poly, '', 2, 'loop'),
      pad('seed-m-1', mono, '', 0, 'oneShot'),
      pad('seed-m-2', mono, '', 1, 'loop'),
    ],
  };
}
