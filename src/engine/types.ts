// SPDX-License-Identifier: GPL-3.0-or-later
// Contrats du moteur audio (voir specifications.md §7, §9 décision B).
// L'engine est autoritatif sur les voix actives ; il les *notifie*, ne les duplique pas.

/** Notifié quand l'ensemble des pads en train de jouer change. */
export type PlayingChangedCallback = (activePadIds: Set<string>) => void;

/** État de l'AudioContext exposé à l'app (politique autoplay mobile, veille Android). */
export type EngineState = 'suspended' | 'running' | 'closed';
