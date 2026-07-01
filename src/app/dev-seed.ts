// SPDX-License-Identifier: GPL-3.0-or-later
// TEMP(M2) : banque de départ codée en dur pour rendre la grille jouable avant l'édition (M3)
// et la persistance (M5). Deux pages (Poly / Mono) et des pads couvrant les 3 Modes de lecture,
// référençant deux slots de sample chargés par le loader dev. À retirer au profit de
// l'hydratation SQLite (M5) et de l'édition réelle (M3).
import type { Bank, Pad } from '../domain/types';
import { DEFAULT_GAIN_DB } from '../domain/invariants';

/** Slots de sample que les pads seed référencent (le loader dev y charge des fichiers). */
export const DEV_SAMPLE_A = 'dev-sample-a';
export const DEV_SAMPLE_B = 'dev-sample-b';

function pad(
  id: string,
  pageId: string,
  name: string,
  position: number,
  playMode: Pad['playMode'],
  sampleId: string | null,
): Pad {
  return { id, pageId, name, position, playMode, sampleId, gainDb: DEFAULT_GAIN_DB };
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
      // Page Poly : les voix se superposent.
      pad('seed-p-oneshot-a', poly, 'One-Shot A', 0, 'oneShot', DEV_SAMPLE_A),
      pad('seed-p-gate-a', poly, 'Gate A', 1, 'gate', DEV_SAMPLE_A),
      pad('seed-p-loop-b', poly, 'Loop B', 2, 'loop', DEV_SAMPLE_B),
      pad('seed-p-oneshot-b', poly, 'One-Shot B', 3, 'oneShot', DEV_SAMPLE_B),
      pad('seed-p-empty', poly, 'Vide', 4, 'oneShot', null),
      // Page Mono : démarrer un pad coupe les autres voix de la page.
      pad('seed-m-oneshot-a', mono, 'One-Shot A', 0, 'oneShot', DEV_SAMPLE_A),
      pad('seed-m-oneshot-b', mono, 'One-Shot B', 1, 'oneShot', DEV_SAMPLE_B),
      pad('seed-m-gate-b', mono, 'Gate B', 2, 'gate', DEV_SAMPLE_B),
      pad('seed-m-loop-a', mono, 'Loop A', 3, 'loop', DEV_SAMPLE_A),
    ],
  };
}
