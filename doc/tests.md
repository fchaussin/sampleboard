<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Tests

**Règle projet :** pour chaque feature, les tests nécessaires doivent être **écrits → exécutés →
validés (verts)**, *puis seulement* la doc est mise à jour.

## Deux niveaux

**1. Unitaire — [Vitest](https://vitest.dev)** (natif Vite, TS). Cœur pur (`domain` / `engine` /
`app`), environnement Node : rapide, déterministe. Le Web Audio y est **simulé par injection**
(un `AudioContext` factice via `AudioEngine({ createContext })`). Fichiers dans le répertoire dédié
`tests/**/*.test.ts` (config `vitest.config.ts`).

**2. E2E — [Playwright](https://playwright.dev) / Chromium** dans un **vrai navigateur**. Couvre
ce que les mocks NE PEUVENT PAS voir : Web Audio réel, **Worker WASM de l'encodeur Opus**, import
réel. C'est la leçon d'une dette concrète : un encodeur cassé (en-têtes OGG manquantes) **passait**
les tests unitaires mockés — seul un navigateur réel l'a attrapé. Fichiers `e2e/*.spec.ts` (config
`playwright.config.ts`) ; Playwright démarre lui-même Vite.

## Lancer (en Docker rootless — zéro dépendance sur l'hôte)

```bash
# Unitaires
docker compose -f docker-compose.dev.yml run --rm dev npm run test        # (test:watch pour le watch)
# Types + build
docker compose -f docker-compose.dev.yml run --rm dev npm run check
docker compose -f docker-compose.dev.yml run --rm dev npm run build
# E2E (image officielle Playwright, navigateurs préinstallés)
docker compose -f docker-compose.e2e.yml run --rm e2e
```

Validation complète d'une feature = unitaires + `check` + `build` + **E2E** au vert. Pour toute
feature qui touche au navigateur (audio, encodeur, UI), l'E2E est **obligatoire** (les mocks ne
suffisent pas).

## Garde automatique : `tests-gate`

`.claude/hooks/tests-gate.sh` (hook `PreToolUse` sur `git commit`) applique la règle :

1. **Présence** *(non bloquant)* — du code d'implémentation commité sans aucun test → avertit.
2. **Unitaires** *(bloquant)* — Vitest en Docker ; échec → commit refusé (`exit 2`).
3. **E2E** *(bloquant si code navigateur touché)* — si des fichiers `src/` ou `e2e/` sont commités
   et que l'image Playwright est présente, lance la suite E2E ; échec → commit refusé. Image
   absente ou Docker indisponible → averti sans bloquer (à valider à la main).

Complète le hook `doc-sync` (rappel de mise à jour de `doc/`). Les deux sont déclarés dans
`.claude/settings.json`.

## Couverture actuelle (M1 → M4) — 68 unitaires + 2 E2E

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
  grille, sélection.
- `tests/app/commands.library.test.ts` — import M4 : pipeline (taille/décodage/encodage), preview,
  rename, delete (pad → *introuvable*).
- `tests/ui/pad-input.test.ts` — mappage Pointer Events par Mode de lecture (élément factice).
- `tests/engine/fake-audio-context.ts` — `AudioContext` factice partagé (utilitaire, pas un test).

**E2E (navigateur réel) :**

- `e2e/import.spec.ts` — import WAV → **OGG/Opus réel** (encodeur WASM) → re-décodage → entrée
  bibliothèque.
- `e2e/play.spec.ts` — import → assignation à un pad Loop → lecture → pad *actif* (moteur Web Audio
  + reflet `activePadIds` réels).
- `e2e/helpers.ts` — génération de WAV + helper d'import (utilitaire, pas un test).
