// SPDX-License-Identifier: GPL-3.0-or-later
// Glisser-pour-panner d'une piste horizontale à défilement masqué (piste des pages, §11).
// Souris/stylet : le conteneur s'attrape n'importe où et se fait glisser (un seuil distingue
// le glissement du tap sur un enfant, dont le clic reste intact) ; molette verticale →
// défilement horizontal. Tactile : ignoré ici, le pan natif (`touch-action: pan-x`) suffit.

/** Distance (px) au-delà de laquelle un appui devient un glissement (sous : c'est un clic). */
export const DRAG_THRESHOLD_PX = 6;

/**
 * Attache le glisser-pour-panner à un conteneur défilable horizontalement.
 * Renvoie une fonction de détachement.
 */
export function attachDragScroll(element: HTMLElement): () => void {
  let pointerId: number | null = null;
  let startX = 0;
  let startScrollLeft = 0;
  let dragging = false;

  const onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return; // pan natif (touch-action: pan-x)
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = element.scrollLeft;
    dragging = false; // le glissement ne démarre qu'au-delà du seuil
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (pointerId === null || event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    if (!dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      dragging = true;
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // Capture indisponible : le glissement fonctionne tant que le pointeur reste dessus.
      }
    }
    element.scrollLeft = startScrollLeft - dx;
  };

  const endDrag = (event: PointerEvent): void => {
    if (pointerId === null || event.pointerId !== pointerId) return;
    pointerId = null;
    try {
      element.releasePointerCapture(event.pointerId);
    } catch {
      // Capture jamais prise (clic simple) : sans conséquence.
    }
    // `dragging` reste vrai jusqu'au `click` qui suit le pointerup, pour l'avaler.
  };

  /** Un glissement ne doit PAS déclencher l'enfant sous le pointeur au relâchement. */
  const onClickCapture = (event: MouseEvent): void => {
    if (!dragging) return;
    dragging = false;
    event.preventDefault();
    event.stopPropagation();
  };

  /** Molette verticale → défilement horizontal (la piste n'a pas d'axe vertical). */
  const onWheel = (event: WheelEvent): void => {
    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (delta === 0 || element.scrollWidth <= element.clientWidth) return;
    event.preventDefault();
    element.scrollLeft += delta;
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', endDrag);
  element.addEventListener('pointercancel', endDrag);
  element.addEventListener('click', onClickCapture, true);
  element.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', endDrag);
    element.removeEventListener('pointercancel', endDrag);
    element.removeEventListener('click', onClickCapture, true);
    element.removeEventListener('wheel', onWheel);
  };
}
