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

## Couverture actuelle (M1 → M8 en cours) — 271 unitaires + 12 E2E

> Liste ci-dessous non exhaustive pour M8 (tags, import multiple, samples d'usine) — voir
> `doc/bibliotheque-import.md` et `doc/samples-usine.md`.

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
- `tests/app/commands.library.test.ts` — import M4/M5 : pipeline (taille/décodage/encodage/
  écriture disque), preview, rename, delete (pads → `sampleId` null, §8), échecs d'écriture.
- `tests/ui/pad-input.test.ts` — mappage Pointer Events par Mode de lecture (élément factice).
- `tests/engine/audio-engine.m5.test.ts` — arrêts liés à l'Arrière-plan : `stopAll`,
  `stopSustained` (voix entretenues vs One-Shot), `suspend`.
- `tests/app/commands.settings.test.ts` — réglages M5 (bornes `maxVoices`, hydratation) +
  `applyBackgroundBehavior`.
- `tests/app/persistence.test.ts` — autosave : debounce, rafale → un save, flush, stop,
  résilience aux échecs (réactivité factice, timers simulés).
- `tests/app/commands.ui.test.ts` — interface M6 (§11) : tiroir contextuel (pad Édition
  seulement, page, réglages, fermetures), panneau bibliothèque (une surcouche à la fois),
  Stop général.
- `tests/engine/pcm.test.ts`, `tests/app/selection-history.test.ts`,
  `tests/app/commands.audio-editor.test.ts` — M7 : rognage/pics/bornes purs, historique
  undo/redo, flux éditeur complet (import/retravail, échecs, restauration).
- `tests/storage/db.test.ts`, `bank-repository.test.ts`, `sample-settings-repository.test.ts`,
  `write-lock.test.ts` — couche storage contre un **vrai SQLite en mémoire** (`node:sqlite`) :
  migrations, aller-retour banque (upsert/élagage, cascades, `ON DELETE SET NULL`), bibliothèque,
  réglages, verrou d'écriture. Utilitaires : `node-sqlite-executor.ts`, `node-sqlite.d.ts`.
- `tests/app/tag-filter.test.ts` — recherche texte de la bibliothèque (`filterSamples`) :
  casse/espaces, combinaison ET avec le filtre par tag et « Non classé ».
- `tests/engine/fake-audio-context.ts` — `AudioContext` factice partagé (utilitaire, pas un test).
- `tests/app/fake-sample-repository.ts` — dépôt bibliothèque factice partagé (utilitaire).

**E2E (navigateur réel) :**

- `e2e/import.spec.ts` — import WAV → **OGG/Opus réel** (encodeur WASM) → re-décodage → entrée
  bibliothèque.
- `e2e/play.spec.ts` — import → assignation à un pad Loop → lecture → pad *actif* (moteur Web Audio
  + reflet `activePadIds` réels).
- `e2e/audio-editor.spec.ts` — M7 : rognage à la poignée (drag réel), undo, durée persistée
  réduite, retravail d'un sample existant.
- `e2e/library-tags.spec.ts` — M8 : tags/filtres, assignation à la volée, pool, recherche
  (modale de sample ET panneau bibliothèque — état « aucun résultat » + Tout afficher).
- `e2e/helpers.ts` — génération de WAV + helpers d'import/éditeur (utilitaire, pas un test).

> Au navigateur nu, la persistance passe par les dépôts **mémoire** (voir doc M5) : l'E2E couvre
> le boot asynchrone et la banque par défaut, pas SQLite — celui-ci est couvert par les tests
> `tests/storage/*` (vrai SQLite) et la validation manuelle `tauri dev`.
