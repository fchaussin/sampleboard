// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du glisser-pour-panner de la piste des pages (souris/stylet + molette).
// Élément et évènements factices : pas de DOM réel requis.
import { describe, it, expect, vi } from 'vitest';
import { attachDragScroll, DRAG_THRESHOLD_PX } from '../../src/ui/interaction/drag-scroll';

function fakeEl(opts: { scrollWidth?: number; clientWidth?: number } = {}) {
  const map: Record<string, Array<(e: unknown) => void>> = {};
  const key = (type: string, capture: boolean) => (capture ? `${type}:capture` : type);
  const el = {
    scrollLeft: 0,
    scrollWidth: opts.scrollWidth ?? 600,
    clientWidth: opts.clientWidth ?? 300,
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    addEventListener(type: string, fn: (e: unknown) => void, options?: boolean | object): void {
      (map[key(type, options === true)] ||= []).push(fn);
    },
    removeEventListener(type: string, fn: (e: unknown) => void, options?: boolean | object): void {
      const k = key(type, options === true);
      map[k] = (map[k] || []).filter((f) => f !== fn);
    },
  };
  const dispatch = (type: string, e: unknown, capture = false): void =>
    (map[key(type, capture)] || []).forEach((f) => f(e));
  return { el: el as unknown as HTMLElement & { scrollLeft: number }, dispatch };
}

function pointer(overrides: Record<string, unknown> = {}) {
  return {
    pointerType: 'mouse',
    button: 0,
    pointerId: 1,
    clientX: 100,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  };
}

function attach(opts: Parameters<typeof fakeEl>[0] = {}) {
  const { el, dispatch } = fakeEl(opts);
  const detach = attachDragScroll(el);
  return { el, dispatch, detach };
}

describe('glissement souris', () => {
  it('au-delà du seuil, la piste suit le pointeur (scrollLeft opposé au déplacement)', () => {
    const { el, dispatch } = attach();
    el.scrollLeft = 50;
    dispatch('pointerdown', pointer({ clientX: 100 }));
    dispatch('pointermove', pointer({ clientX: 100 - DRAG_THRESHOLD_PX - 20 }));
    expect(el.scrollLeft).toBe(50 + DRAG_THRESHOLD_PX + 20);
    expect(el.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('sous le seuil : aucun défilement (c’est un clic)', () => {
    const { el, dispatch } = attach();
    el.scrollLeft = 50;
    dispatch('pointerdown', pointer({ clientX: 100 }));
    dispatch('pointermove', pointer({ clientX: 100 - (DRAG_THRESHOLD_PX - 1) }));
    expect(el.scrollLeft).toBe(50);
    expect(el.setPointerCapture).not.toHaveBeenCalled();
  });

  it('le clic qui suit un glissement est avalé (l’onglet sous le pointeur ne s’active pas)', () => {
    const { dispatch } = attach();
    dispatch('pointerdown', pointer({ clientX: 100 }));
    dispatch('pointermove', pointer({ clientX: 40 }));
    dispatch('pointerup', pointer({ clientX: 40 }));
    const click = pointer();
    dispatch('click', click, true);
    expect(click.preventDefault).toHaveBeenCalled();
    expect(click.stopPropagation).toHaveBeenCalled();
  });

  it('un clic simple (sans glissement) n’est PAS avalé', () => {
    const { dispatch } = attach();
    dispatch('pointerdown', pointer({ clientX: 100 }));
    dispatch('pointerup', pointer({ clientX: 100 }));
    const click = pointer();
    dispatch('click', click, true);
    expect(click.preventDefault).not.toHaveBeenCalled();
  });

  it('bouton non principal ignoré', () => {
    const { el, dispatch } = attach();
    dispatch('pointerdown', pointer({ button: 2, clientX: 100 }));
    dispatch('pointermove', pointer({ clientX: 0 }));
    expect(el.scrollLeft).toBe(0);
  });
});

describe('tactile — délégué au pan natif', () => {
  it('un pointeur touch ne déclenche pas le glissement manuel', () => {
    const { el, dispatch } = attach();
    dispatch('pointerdown', pointer({ pointerType: 'touch', clientX: 100 }));
    dispatch('pointermove', pointer({ pointerType: 'touch', clientX: 0 }));
    expect(el.scrollLeft).toBe(0);
  });
});

describe('molette', () => {
  it('molette verticale → défilement horizontal (preventDefault)', () => {
    const { el, dispatch } = attach();
    const wheel = { deltaX: 0, deltaY: 40, preventDefault: vi.fn() };
    dispatch('wheel', wheel);
    expect(el.scrollLeft).toBe(40);
    expect(wheel.preventDefault).toHaveBeenCalled();
  });

  it('piste sans débordement : la molette est laissée au défilement de la page', () => {
    const { el, dispatch } = attach({ scrollWidth: 300, clientWidth: 300 });
    const wheel = { deltaX: 0, deltaY: 40, preventDefault: vi.fn() };
    dispatch('wheel', wheel);
    expect(el.scrollLeft).toBe(0);
    expect(wheel.preventDefault).not.toHaveBeenCalled();
  });
});

describe('détachement', () => {
  it('retire les écouteurs (plus de glissement après detach)', () => {
    const { el, dispatch, detach } = attach();
    detach();
    dispatch('pointerdown', pointer({ clientX: 100 }));
    dispatch('pointermove', pointer({ clientX: 0 }));
    expect(el.scrollLeft).toBe(0);
  });
});
