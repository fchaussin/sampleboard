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

/**
 * Palette de couleurs assignables (pages, pads). Tokens stables persistés en base ;
 * les valeurs visuelles (OKLCH) vivent dans app.css (`--c-<token>`), pas ici.
 */
export const COLORS = [
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'violet',
  'pink',
] as const;

export type Color = (typeof COLORS)[number];
