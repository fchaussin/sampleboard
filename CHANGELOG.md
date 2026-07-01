# Changelog

Toutes les évolutions notables de **Sampleboard** sont consignées ici.

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ;
versionnage **SemVer** (voir [`roadmap.md`](./roadmap.md) §1).
`1.0.0` n'est pas planifiée : elle sanctionne la première version **stable et complète**.

## [Unreleased]

## [0.2.0] - 2026-07-01 — M1 (Audio)

> **Validé sur web** (1er temps) : son émis + `resume()` en dev, tests verts, `svelte-check` +
> build OK. La **validation sur Android réel** est le **2ᵉ temps** (web d'abord, Android ensuite —
> spec §16), suivie hors de ce tag.

### Ajouté
- **Moteur audio** (`engine/audio-engine.ts`, Web Audio) : création/reprise de l'`AudioContext`
  (`resume()` idempotent, politique autoplay ; reprend aussi depuis `interrupted`), cache de
  buffers (`load` / `unload` / `isLoaded`), lecture **One-Shot** (`AudioBufferSourceNode` →
  `GainNode` → sortie, gain **dB → amplitude**), re-tap = relance depuis 0 avec fade anti-clic
  (~8 ms), et reflet des voix actives via `onPlayingChanged` (no-op silencieux si pad vide /
  buffer absent).
- Commandes `resumeAudio` (reprise sur geste) + harnais **temporaire** de démo M1
  (`loadDemoSound`, `fireDemoPad`, composant `ui/dev/M1AudioDemo.svelte`) : un pad codé en dur
  qui joue un fichier audio chargé via l'API File (testable en Vite nu ET WebView Tauri).
- **Tests** : Vitest ajouté ; suite du cœur audio (`voice.test.ts`, `audio-engine.test.ts`,
  18 tests) — Web Audio simulé par injection, aucune dépendance navigateur.

### Outillage
- Conteneur Docker **dev permanent** (`docker-compose.dev.yml up dev`) — Vite sur
  http://localhost:1420, HMR, pour observer l'évolution en continu.
- Hook `.claude/hooks/tests-gate.sh` (PreToolUse `git commit`) : avertit si du code est commité
  sans test, **exécute la suite en Docker et bloque le commit si elle échoue** (règle projet :
  tests écrits → exécutés → validés, puis doc).

### Validé (dev)
- `npm run test` : 18/18 verts · `svelte-check` : 0 erreur / 0 warning · `vite build` : OK
  (le tout exécuté en Docker rootless).

## [0.1.0] - 2026-07-01 — M0 (Socle)

### Ajouté
- Scaffold Vite + Svelte 5 (runes) + TypeScript **strict**, SPA statique (SSR off, sans routeur).
- Coquille **Tauri v2** (`src-tauri/`, Rust minimal) + plugins `sql`, `fs`, `dialog` (config + capabilities).
- Arborescence `domain / engine / storage / app / ui` avec stubs par jalon.
- Composition root explicite `create-app.ts` (injection de dépendances, pas de singletons).
- Store réactif (runes) + couche de commandes (seul point de mutation).
- i18n minimal : loader + `t()`, `fr.json` (défaut & fallback), langue réactive dans le store.
- `LICENSE` GPL-3.0-or-later + en-têtes SPDX + `README.md` ; icônes placeholder Tauri.

### Environnement de développement
- Docker **rootless** dev/prod séparés (`docker-compose.dev.yml` / `docker-compose.prod.yml`),
  durci (`cap_drop: ALL`, `no-new-privileges`), toolchain isolée en image/volumes.
- Doc vivante `doc/` (séparée des specs) + mécanisme **doc-sync** (`.claude/`).

### Validé
- `svelte-check` 0 erreur, `vite build` OK, texte `t()` présent dans le bundle.
- Compilation complète de la coquille Tauri (Rust + plugins + front embarqué) en Docker rootless :
  binaire `target/debug/sampleboard` produit.

### Documentation
- Spécification technique figée — `specifications.md` (vocabulaire, architecture, décisions).
- Roadmap & gestion de projet — `roadmap.md` (phases, jalons, versionnage, backlog).
- Onboarding projet — `CLAUDE.md`.
