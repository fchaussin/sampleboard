// SPDX-License-Identifier: GPL-3.0-or-later
// Module unique Pointer Events → intentions, selon le Mode de lecture (voir §10).
// Squelette M0 : le mappage complet (One-Shot / Gate + setPointerCapture / Loop) arrive au M2.
import type { PlayMode } from '../../domain/enums';

export interface PadInputHandlers {
  fire(padId: string): void;
  press(padId: string): void;
  release(padId: string): void;
  toggleLoop(padId: string): void;
}

/**
 * Attache la gestion Pointer Events d'un pad selon son Mode de lecture.
 * TODO(M2) : pointerdown/up/cancel, preventDefault, setPointerCapture pour Gate.
 */
export function attachPadInput(
  _element: HTMLElement,
  _padId: string,
  _playMode: PlayMode,
  _handlers: PadInputHandlers,
): () => void {
  // Renvoie une fonction de détachement.
  return () => {};
}
