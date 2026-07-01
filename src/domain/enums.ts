// SPDX-License-Identifier: GPL-3.0-or-later
// Domaine pur : énumérations du modèle. Aucune dépendance (voir specifications.md §4, §6).

/** Mode de lecture d'un pad (terminologie contrôleur MIDI / MPC). */
export type PlayMode = 'oneShot' | 'gate' | 'loop';

/** Polyphonie d'une page : voix superposées ou non. */
export type VoiceMode = 'mono' | 'poly';

/** Comportement de l'app en arrière-plan (Android). */
export type BackgroundBehavior = 'stopAll' | 'stopSustained' | 'keepPlaying';

/** État visuel d'un pad dérivé de son assignation (voir Glossaire). */
export type PadStatus = 'active' | 'missing' | 'empty' | 'idle';
