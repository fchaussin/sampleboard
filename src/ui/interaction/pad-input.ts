// SPDX-License-Identifier: GPL-3.0-or-later
// Module unique Pointer Events → intentions, selon le Mode de lecture (voir §7, §10).
// One-Shot : tap → fire. Gate : appui maintenu → press/release (+ setPointerCapture pour
// recevoir le relâchement même si le doigt sort du pad). Loop : tap → toggle.
import type { PlayMode } from '../../domain/enums';

export interface PadInputHandlers {
  fire(padId: string): void;
  press(padId: string): void;
  release(padId: string): void;
  toggleLoop(padId: string): void;
}

/**
 * Attache la gestion Pointer Events d'un pad selon son Mode de lecture.
 * Renvoie une fonction de détachement (retire les écouteurs ; relâche un Gate encore tenu).
 */
export function attachPadInput(
  element: HTMLElement,
  padId: string,
  playMode: PlayMode,
  handlers: PadInputHandlers,
): () => void {
  let gateHeld = false;

  const onPointerDown = (event: PointerEvent): void => {
    // Souris : bouton principal uniquement. Tactile/stylet : toujours accepté.
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();

    switch (playMode) {
      case 'oneShot':
        handlers.fire(padId);
        break;
      case 'loop':
        handlers.toggleLoop(padId);
        break;
      case 'gate':
        try {
          element.setPointerCapture(event.pointerId);
        } catch {
          // Capture indisponible : on continue, pointerup arrivera quand même le plus souvent.
        }
        gateHeld = true;
        handlers.press(padId);
        break;
    }
  };

  const endGate = (event: PointerEvent): void => {
    if (playMode !== 'gate' || !gateHeld) return;
    gateHeld = false;
    try {
      element.releasePointerCapture(event.pointerId);
    } catch {
      // Capture déjà relâchée : sans conséquence.
    }
    handlers.release(padId);
  };

  const onPointerUp = (event: PointerEvent): void => {
    event.preventDefault();
    endGate(event);
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', endGate);

  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointerup', onPointerUp);
    element.removeEventListener('pointercancel', endGate);
    // Filet de sécurité : un Gate encore tenu au démontage doit être relâché.
    if (gateHeld) {
      gateHeld = false;
      handlers.release(padId);
    }
  };
}
