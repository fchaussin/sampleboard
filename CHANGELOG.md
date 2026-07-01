# Changelog

Toutes les évolutions notables de **Sampleboard** sont consignées ici.

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ;
versionnage **SemVer** (voir [`roadmap.md`](./roadmap.md) §1).
`1.0.0` n'est pas planifiée : elle sanctionne la première version **stable et complète**.

## [Unreleased]

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
