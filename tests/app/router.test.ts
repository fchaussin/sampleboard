// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du routeur (#23) : sync URL → affichage (init, hashchange, retour), écritures
// délibérées (push marqué, replace sans entrée, pop = retour ou repli) — fenêtre factice
// (pas de jsdom au dépôt) simulant fragment + pile d'historique. Boucle locale incluse.
import { describe, it, expect } from 'vitest';
import { createHashRouter, createLoopbackRouter, type RouterWindow } from '../../src/app/router';
import type { Route } from '../../src/app/navigation';

/** Fenêtre factice : pile d'entrées {hash, state}, hashchange synchrone (le vrai est différé). */
function fakeWindow(initialHash = '') {
  const listeners: Array<() => void> = [];
  const entries: Array<{ hash: string; state: unknown }> = [{ hash: initialHash, state: null }];
  let index = 0;
  const current = () => entries[index] as { hash: string; state: unknown };
  const normalize = (url: string) => (url.startsWith('#') ? url : `#${url}`);
  const fire = () => listeners.forEach((listener) => listener());
  const win: RouterWindow = {
    location: {
      get hash() {
        return current().hash;
      },
      set hash(value: string) {
        const hash = normalize(value);
        if (hash === current().hash) return; // le navigateur n'empile pas un hash identique
        entries.splice(index + 1);
        entries.push({ hash, state: null });
        index += 1;
        fire();
      },
      replace(url: string) {
        const hash = normalize(url);
        const changed = hash !== current().hash;
        entries[index] = { hash, state: null }; // remplace l'entrée, efface l'état
        if (changed) fire();
      },
    },
    history: {
      get state() {
        return current().state;
      },
      back() {
        if (index === 0) return;
        index -= 1;
        fire();
      },
      replaceState(data: unknown) {
        current().state = data;
      },
    },
    addEventListener(_type, listener) {
      listeners.push(listener);
    },
  };
  return { win, entryCount: () => entries.length, index: () => index };
}

function record() {
  const applied: Route[] = [];
  return { applied, apply: (route: Route) => applied.push(route) };
}

describe('createHashRouter — URL → affichage', () => {
  it("normalise l'URL d'arrivée vide vers le board SANS entrée d'historique", () => {
    const { win, entryCount } = fakeWindow('');
    const { applied, apply } = record();
    createHashRouter(win).start(apply);
    expect(win.location.hash).toBe('#/board');
    expect(entryCount()).toBe(1);
    expect(applied.at(-1)).toEqual({ view: 'board' });
  });

  it("applique l'URL d'arrivée valide telle quelle (paramètre compris)", () => {
    const { win, entryCount } = fakeWindow('#/library?tag=t1');
    const { applied, apply } = record();
    createHashRouter(win).start(apply);
    expect(applied).toEqual([{ view: 'library', filter: 't1' }]);
    expect(entryCount()).toBe(1);
  });

  it('un hash inconnu survenant en cours de route est normalisé puis appliqué', () => {
    const { win } = fakeWindow('#/board');
    const { applied, apply } = record();
    createHashRouter(win).start(apply);
    win.location.hash = '#/nawak'; // saisie manuelle
    expect(win.location.hash).toBe('#/board');
    expect(applied.at(-1)).toEqual({ view: 'board' });
  });
});

describe('createHashRouter — écritures délibérées', () => {
  it('push crée une entrée marquée et applique via hashchange ; pas d’entrée fantôme', () => {
    const { win, entryCount } = fakeWindow('#/board');
    const { applied, apply } = record();
    const router = createHashRouter(win);
    router.start(apply);
    router.push({ view: 'library', filter: null });
    expect(win.location.hash).toBe('#/library');
    expect(entryCount()).toBe(2);
    expect(applied.at(-1)).toEqual({ view: 'library', filter: null });
    router.push({ view: 'library', filter: null }); // même route : rien
    expect(entryCount()).toBe(2);
  });

  it("replace change l'URL sans entrée d'historique (ajustement de paramètre)", () => {
    const { win, entryCount } = fakeWindow('#/board');
    const { applied, apply } = record();
    const router = createHashRouter(win);
    router.start(apply);
    router.push({ view: 'library', filter: null });
    router.replace({ view: 'library', filter: 't1' });
    expect(win.location.hash).toBe('#/library?tag=t1');
    expect(entryCount()).toBe(2);
    expect(applied.at(-1)).toEqual({ view: 'library', filter: 't1' });
  });

  it('pop après push = retour naturel (le geste retour dépile la même entrée)', () => {
    const { win, index } = fakeWindow('#/board');
    const { applied, apply } = record();
    const router = createHashRouter(win);
    router.start(apply);
    router.push({ view: 'library', filter: null });
    router.pop({ view: 'board' });
    expect(win.location.hash).toBe('#/board');
    expect(index()).toBe(0); // dépilé, pas empilé
    expect(applied.at(-1)).toEqual({ view: 'board' });
  });

  it("pop sur une URL d'arrivée directe (rechargement) : repli par remplacement", () => {
    const { win, entryCount } = fakeWindow('#/library');
    const { applied, apply } = record();
    const router = createHashRouter(win);
    router.start(apply);
    router.pop({ view: 'board' });
    expect(win.location.hash).toBe('#/board');
    expect(entryCount()).toBe(1); // aucune entrée créée : rien à dépiler ensuite
    expect(applied.at(-1)).toEqual({ view: 'board' });
  });

  it('replace conserve la profondeur marquée (pop reste un retour après ajustement)', () => {
    const { win, index } = fakeWindow('#/board');
    const { apply } = record();
    const router = createHashRouter(win);
    router.start(apply);
    router.push({ view: 'library', filter: null });
    router.replace({ view: 'library', filter: 't1' }); // ajuste le paramètre
    router.pop({ view: 'board' });
    expect(win.location.hash).toBe('#/board');
    expect(index()).toBe(0);
  });
});

describe('createLoopbackRouter — même contrat, sans URL', () => {
  it("start n'applique rien (pas d'URL d'arrivée) ; push/replace appliquent immédiatement", () => {
    const { applied, apply } = record();
    const router = createLoopbackRouter();
    router.start(apply);
    expect(applied).toEqual([]);
    router.push({ view: 'library', filter: null });
    router.replace({ view: 'library', filter: 't1' });
    expect(applied).toEqual([
      { view: 'library', filter: null },
      { view: 'library', filter: 't1' },
    ]);
  });

  it('pop dépile vers la route précédente, ou applique le repli à la base', () => {
    const { applied, apply } = record();
    const router = createLoopbackRouter();
    router.start(apply);
    router.push({ view: 'library', filter: null });
    router.pop({ view: 'board' });
    expect(applied.at(-1)).toEqual({ view: 'board' });
    router.pop({ view: 'board' }); // déjà à la base : repli
    expect(applied.at(-1)).toEqual({ view: 'board' });
  });
});
