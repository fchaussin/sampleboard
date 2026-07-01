// SPDX-License-Identifier: GPL-3.0-or-later
// Représentation d'une voix active (voir specifications.md §7).
// Une voix = une lecture en cours (One-Shot, Gate ou Loop). Créée/arrêtée par l'AudioEngine.

export interface Voice {
  padId: string;
  /** Page d'origine : sert au choke Mono et à `stopPage` (voir §7). */
  pageId: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** AudioContext.currentTime au démarrage (sert au FIFO du plafond de voix). */
  startedAt: number;
}

/** Convertit un gain en dB vers une amplitude linéaire (voir §7). -60 dB = muet. */
export function gainDbToAmplitude(gainDb: number): number {
  return gainDb <= -60 ? 0 : 10 ** (gainDb / 20);
}
