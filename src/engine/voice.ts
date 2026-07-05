// SPDX-License-Identifier: GPL-3.0-or-later
// Représentation d'une voix active (voir specifications.md §7).
// Une voix = une lecture en cours (One-Shot, Gate ou Loop). Créée/arrêtée par l'AudioEngine.

export interface Voice {
  padId: string;
  /** Page d'origine : sert au choke Mono et à `stopPage` (voir §7). */
  pageId: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** Point d'écoute de la voix pour les visualiseurs (forme d'onde temps réel, M6). */
  analyser: AnalyserNode;
  /** AudioContext.currentTime au démarrage (sert au FIFO du plafond de voix). */
  startedAt: number;
  /** Voix entretenue (Gate tenu, Loop) — ciblée par Arrière-plan 'stopSustained' (§12). */
  sustained: boolean;
  /** Durée de la FENÊTRE jouée (points cue, M11), en secondes — sert à `progress()`. */
  windowDuration: number;
}

/** Convertit un gain en dB vers une amplitude linéaire (voir §7). -60 dB = muet. */
export function gainDbToAmplitude(gainDb: number): number {
  return gainDb <= -60 ? 0 : 10 ** (gainDb / 20);
}
