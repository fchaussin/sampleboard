// SPDX-License-Identifier: GPL-3.0-or-later
// Routeur (#23, spec §16) : synchronisation bidirectionnelle URL ↔ vue.
// URL → affichage : `start` applique la route courante à l'init puis à chaque hashchange
// (retour/avance compris). Affichage → URL : les commandes écrivent l'URL (push/replace/pop),
// jamais la vue directement — applyRoute (commands.ts) est le seul écrivain de store.view.
// Historique DÉLIBÉRÉ : push = navigation réelle (entrée marquée d'une profondeur),
// replace = correction/ajustement, pop = retour naturel si l'entrée courante a été poussée
// par l'app — le geste retour Android et le bouton ✕ dépilent la même chose.
import { DEFAULT_ROUTE, formatHash, parseHash, type Route } from './navigation';

export interface Router {
  /** Branche la sync URL → affichage : applique la route courante puis chaque changement. */
  start(apply: (route: Route) => void): void;
  /** Navigation réelle : nouvelle entrée d'historique (dépilable par `pop`/geste retour). */
  push(route: Route): void;
  /** Correction/ajustement (paramètres, normalisation) : remplace l'entrée courante. */
  replace(route: Route): void;
  /** Quitte la vue courante : retour si l'entrée a été poussée par l'app, sinon `fallback`. */
  pop(fallback: Route): void;
}

/** Surface navigateur minimale requise — injectable en test (pas de jsdom au dépôt). */
export interface RouterWindow {
  location: { hash: string; replace(url: string): void };
  history: {
    state: unknown;
    back(): void;
    replaceState(data: unknown, unused: string, url?: string): void;
  };
  addEventListener(type: 'hashchange', listener: () => void): void;
}

/** Profondeur marquée sur l'entrée d'historique : > 0 ⇔ entrée poussée par l'app. */
function stampedDepth(state: unknown): number {
  const depth = (state as { depth?: unknown } | null)?.depth;
  return typeof depth === 'number' ? depth : 0;
}

export function createHashRouter(win: RouterWindow): Router {
  const stamp = (depth: number): void => win.history.replaceState({ depth }, '');
  const replace = (route: Route): void => {
    const depth = stampedDepth(win.history.state);
    win.location.replace(formatHash(route)); // remplace l'entrée courante ET déclenche hashchange
    stamp(depth); // location.replace efface l'état : re-marquer la même profondeur
  };
  return {
    start(apply) {
      win.addEventListener('hashchange', () => {
        const route = parseHash(win.location.hash);
        if (route) apply(route);
        else replace(DEFAULT_ROUTE); // hash inconnu (saisie manuelle) : normalisé puis ré-émis
      });
      const initial = parseHash(win.location.hash);
      if (initial) apply(initial);
      else replace(DEFAULT_ROUTE); // URL d'arrivée vide/inconnue : normalisée sans entrée
    },
    push(route) {
      const hash = formatHash(route);
      if (win.location.hash === hash) return; // déjà là : pas d'entrée fantôme
      const depth = stampedDepth(win.history.state);
      win.location.hash = hash; // nouvelle entrée d'historique, déclenche hashchange
      stamp(depth + 1);
    },
    replace,
    pop(fallback) {
      if (stampedDepth(win.history.state) > 0) win.history.back(); // hashchange suivra
      else replace(fallback); // entrée d'arrivée directe (rechargement) : rien à dépiler
    },
  };
}

/**
 * Routeur en boucle locale — défaut hors navigateur (tests unitaires) : même contrat, sans
 * URL. `start` n'applique aucune route initiale (pas d'URL d'arrivée à projeter) ; chaque
 * écriture s'applique immédiatement, une pile minimale donne son sens à `pop`.
 */
export function createLoopbackRouter(): Router {
  let apply: (route: Route) => void = () => {};
  let stack: Route[] = [DEFAULT_ROUTE];
  const current = (): Route => stack[stack.length - 1] ?? DEFAULT_ROUTE;
  return {
    start(fn) {
      apply = fn;
    },
    push(route) {
      stack.push(route);
      apply(route);
    },
    replace(route) {
      stack[stack.length - 1] = route;
      apply(route);
    },
    pop(fallback) {
      if (stack.length > 1) stack.pop();
      else stack = [fallback];
      apply(current());
    },
  };
}
