// SPDX-License-Identifier: GPL-3.0-or-later
// Glisser-déposer de samples (#18) : type MIME partagé entre les sources (ligne de
// bibliothèque, élément du pool) et les cibles (pool, pads en Édition). Complète le
// flux tactile « armer puis toucher » (M8) — le DnD HTML5 est un raccourci pointeur.

export const SAMPLE_DND_TYPE = 'application/x-sampleboard-sample';

/** Déclare le sample transporté au début du glissement. */
export function setSampleDrag(e: DragEvent, sampleId: string): void {
  if (!e.dataTransfer) return;
  e.dataTransfer.setData(SAMPLE_DND_TYPE, sampleId);
  e.dataTransfer.effectAllowed = 'copy';
}

/** Vrai si le glissement en cours transporte un sample (seuls les types sont lisibles en survol). */
export function carriesSample(e: DragEvent): boolean {
  return e.dataTransfer?.types.includes(SAMPLE_DND_TYPE) ?? false;
}

/** Id du sample déposé, ou null si le dépôt ne vient pas d'une source de samples. */
export function droppedSampleId(e: DragEvent): string | null {
  return e.dataTransfer?.getData(SAMPLE_DND_TYPE) || null;
}
