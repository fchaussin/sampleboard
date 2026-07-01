<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Tests

**Règle projet :** pour chaque feature, les tests nécessaires doivent être **écrits → exécutés →
validés (verts)**, *puis seulement* la doc est mise à jour.

## Runner

[Vitest](https://vitest.dev) — natif Vite, TypeScript. Tests unitaires **TS purs** du cœur
(`domain` / `engine`), environnement Node : aucune dépendance navigateur, le Web Audio est
**simulé par injection** (un `AudioContext` factice passé via `AudioEngine({ createContext })`).

Fichiers dans un **répertoire dédié** `tests/` (miroir de `src/`), séparé du code source :
`tests/**/*.test.ts`. Config : `vitest.config.ts`.

## Lancer (en Docker rootless — zéro dépendance sur l'hôte)

```bash
# suite complète (CI-like)
docker compose -f docker-compose.dev.yml run --rm dev npm run test
# mode watch
docker compose -f docker-compose.dev.yml run --rm dev npm run test:watch
```

Validation complète d'une feature = les trois au vert :

```bash
docker compose -f docker-compose.dev.yml run --rm dev npm run test    # tests
docker compose -f docker-compose.dev.yml run --rm dev npm run check    # svelte-check (types)
docker compose -f docker-compose.dev.yml run --rm dev npm run build    # build Vite
```

## Garde automatique : `tests-gate`

`.claude/hooks/tests-gate.sh` (hook `PreToolUse` sur `git commit`) applique la règle :

1. **Présence** *(non bloquant)* — du code d'implémentation commité sans aucun fichier de test →
   avertit.
2. **Exécution** *(bloquant)* — lance la suite en Docker ; **si elle échoue, le commit est
   refusé** (`exit 2`). Si Docker est indisponible, avertit sans bloquer (à valider à la main).

Complète le hook `doc-sync` (rappel de mise à jour de `doc/`). Les deux sont déclarés dans
`.claude/settings.json`.

## Couverture actuelle (M1 → M3) — 63 tests

- `tests/engine/voice.test.ts` — conversion gain dB → amplitude (bornes, plancher -60 dB,
  monotonie).
- `tests/engine/audio-engine.test.ts` — contexte & autoplay (`resume` idempotent, `state`), cache
  (`load` / `unload` / `isLoaded`), One-Shot, reflet des voix (`onPlayingChanged`).
- `tests/engine/audio-engine.m2.test.ts` — matrice §7 : Gate (press/release), Loop (toggle),
  choke Mono, plafond FIFO, `stopPad` / `stopPage`.
- `tests/domain/invariants.test.ts` — bornes gain/grille, `padsFitGrid`.
- `tests/domain/selectors.test.ts` — lectures dérivées de l'arbre banque.
- `tests/app/commands.test.ts` — résolution pad/page + délégation au moteur (store & moteur
  factices).
- `tests/app/commands.edit.test.ts` — édition M3 : CRUD pads/pages, invariant de réduction de
  grille, bibliothèque (pont dev), sélection.
- `tests/ui/pad-input.test.ts` — mappage Pointer Events par Mode de lecture (élément factice).
- `tests/engine/fake-audio-context.ts` — `AudioContext` factice partagé (utilitaire, pas un test).
