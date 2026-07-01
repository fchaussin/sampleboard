// SPDX-License-Identifier: GPL-3.0-or-later
// Contrats du moteur audio (voir specifications.md §7, §9 décision B).
// L'engine est autoritatif sur les voix actives ; il les *notifie*, ne les duplique pas.

/** Notifié quand l'ensemble des pads en train de jouer change. */
export type PlayingChangedCallback = (activePadIds: Set<string>) => void;

/** PCM décodé (canaux non entrelacés) + métadonnées, produit par `AudioEngine.decode`. */
export interface DecodedAudio {
  channelData: Float32Array[];
  sampleRate: number;
  durationMs: number;
}

/**
 * État de l'AudioContext exposé à l'app (politique autoplay mobile, veille Android).
 * Reflète directement `AudioContextState` : `interrupted` apparaît sur certaines plateformes
 * mobiles (interruption système) et se traite comme un `suspended` à reprendre (voir §12).
 */
export type EngineState = 'suspended' | 'running' | 'closed' | 'interrupted';
