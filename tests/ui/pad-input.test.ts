// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du mappage Pointer Events → intentions selon le Mode de lecture (voir §10).
// Élément et évènements factices : pas de DOM réel requis.
import { describe, it, expect, vi } from 'vitest';
import { attachPadInput, type PadInputHandlers } from '../../src/ui/interaction/pad-input';
import type { PlayMode } from '../../src/domain/enums';

function fakeEl() {
  const map: Record<string, Array<(e: unknown) => void>> = {};
  const el = {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    addEventListener(type: string, fn: (e: unknown) => void): void {
      (map[type] ||= []).push(fn);
    },
    removeEventListener(type: string, fn: (e: unknown) => void): void {
      map[type] = (map[type] || []).filter((f) => f !== fn);
    },
  };
  const dispatch = (type: string, e: unknown): void => (map[type] || []).forEach((f) => f(e));
  return { el: el as unknown as HTMLElement, dispatch };
}

function pointer(overrides: Record<string, unknown> = {}): PointerEvent {
  return {
    pointerType: 'touch',
    button: 0,
    pointerId: 1,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as PointerEvent;
}

function handlers(): PadInputHandlers & Record<string, ReturnType<typeof vi.fn>> {
  return {
    fire: vi.fn(),
    press: vi.fn(),
    release: vi.fn(),
    toggleLoop: vi.fn(),
  };
}

function attach(mode: PlayMode) {
  const { el, dispatch } = fakeEl();
  const h = handlers();
  const detach = attachPadInput(el, 'pad-1', mode, h);
  return { el, dispatch, h, detach };
}

describe('One-Shot', () => {
  it('pointerdown → fire', () => {
    const { dispatch, h } = attach('oneShot');
    dispatch('pointerdown', pointer());
    expect(h.fire).toHaveBeenCalledWith('pad-1');
    expect(h.press).not.toHaveBeenCalled();
  });
});

describe('Loop', () => {
  it('pointerdown → toggleLoop', () => {
    const { dispatch, h } = attach('loop');
    dispatch('pointerdown', pointer());
    expect(h.toggleLoop).toHaveBeenCalledWith('pad-1');
  });
});

describe('Gate', () => {
  it('pointerdown → press + setPointerCapture ; pointerup → release + releasePointerCapture', () => {
    const { el, dispatch, h } = attach('gate');
    dispatch('pointerdown', pointer({ pointerId: 7 }));
    expect(h.press).toHaveBeenCalledWith('pad-1');
    expect(el.setPointerCapture).toHaveBeenCalledWith(7);

    dispatch('pointerup', pointer({ pointerId: 7 }));
    expect(h.release).toHaveBeenCalledWith('pad-1');
    expect(el.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('détacher pendant un Gate tenu relâche la voix (filet de sécurité)', () => {
    const { dispatch, h, detach } = attach('gate');
    dispatch('pointerdown', pointer());
    expect(h.release).not.toHaveBeenCalled();
    detach();
    expect(h.release).toHaveBeenCalledWith('pad-1');
  });

  it('pointercancel relâche aussi', () => {
    const { dispatch, h } = attach('gate');
    dispatch('pointerdown', pointer());
    dispatch('pointercancel', pointer());
    expect(h.release).toHaveBeenCalledWith('pad-1');
  });
});

describe('souris — bouton non principal ignoré', () => {
  it('pointerdown souris bouton droit → aucun déclenchement', () => {
    const { dispatch, h } = attach('oneShot');
    dispatch('pointerdown', pointer({ pointerType: 'mouse', button: 2 }));
    expect(h.fire).not.toHaveBeenCalled();
  });
});

describe('détachement', () => {
  it('retire les écouteurs (plus de déclenchement après detach)', () => {
    const { dispatch, h, detach } = attach('oneShot');
    detach();
    dispatch('pointerdown', pointer());
    expect(h.fire).not.toHaveBeenCalled();
  });
});
