// SPDX-License-Identifier: GPL-3.0-or-later
// Préchargeur/paceur des buffers audio (#27) : l'app se monte SANS attendre les décodages ;
// les samples se chargent par ordre de PRIORITÉ (pads de la page active → pads des autres
// pages → reste de la bibliothèque) avec une CONCURRENCE bornée (le décodage ne sature ni
// le thread audio ni le CPU mobile). Chaque sample réglé — chargé OU en échec — est
// notifié via `settle` : le pad quitte l'état « loading » (échec → no-op silencieux, §12).
import type { Bank, Sample } from '../domain/types';

export interface PreloadDeps {
  samples: Sample[];
  bank: Bank | null;
  activePageId: string | null;
  /** Charge les octets et le buffer d'UN sample (jette en cas d'échec). */
  load(sample: Sample): Promise<void>;
  /** Notifié quand un sample est réglé (chargé ou en échec) — retire l'état « loading ». */
  settle(sampleId: string): void;
  /** Décodages simultanés maximum. */
  concurrency?: number;
}

/**
 * Ordre de préchargement : page active d'abord (pads opérationnels immédiatement), puis les
 * pads des autres pages, puis les samples non assignés — l'ordre d'origine (createdAt) est
 * conservé à l'intérieur de chaque groupe.
 */
export function prioritizeSamples(
  samples: Sample[],
  bank: Bank | null,
  activePageId: string | null,
): Sample[] {
  const activeIds = new Set<string>();
  const assignedIds = new Set<string>();
  for (const pad of bank?.pads ?? []) {
    if (pad.sampleId === null) continue;
    if (pad.pageId === activePageId) activeIds.add(pad.sampleId);
    else assignedIds.add(pad.sampleId);
  }
  const rank = (s: Sample): number => (activeIds.has(s.id) ? 0 : assignedIds.has(s.id) ? 1 : 2);
  // Tri STABLE (spec ES2019) : l'ordre d'origine survit dans chaque groupe.
  return [...samples].sort((a, b) => rank(a) - rank(b));
}

/** Charge tous les buffers dans l'ordre de priorité, `concurrency` décodages à la fois. */
export async function preloadBuffers({
  samples,
  bank,
  activePageId,
  load,
  settle,
  concurrency = 3,
}: PreloadDeps): Promise<void> {
  const queue = prioritizeSamples(samples, bank, activePageId);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < queue.length) {
      const sample = queue[next];
      next += 1;
      if (!sample) continue;
      try {
        await load(sample);
      } catch (err) {
        // Fichier disparu/illisible (§12) : journalisé, le pad joue un no-op silencieux.
        console.warn(`bibliothèque : octets audio illisibles (${sample.fileName})`, err);
      }
      settle(sample.id);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
}
