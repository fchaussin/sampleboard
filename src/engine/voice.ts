// SPDX-License-Identifier: GPL-3.0-or-later
// Représentation d'une voix active (voir specifications.md §7).
// Squelette M0 : la logique de création/arrêt des voix arrive au jalon M1.

export interface Voice {
  padId: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** AudioContext.currentTime au démarrage (sert au FIFO du plafond de voix). */
  startedAt: number;
}

/** Convertit un gain en dB vers une amplitude linéaire (voir §7). -60 dB = muet. */
export function gainDbToAmplitude(gainDb: number): number {
  return gainDb <= -60 ? 0 : 10 ** (gainDb / 20);
}
