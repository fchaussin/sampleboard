# Changelog

Toutes les évolutions notables de **Sampleboard** sont consignées ici.

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ;
versionnage **SemVer** (voir [`roadmap.md`](./roadmap.md) §1).
`1.0.0` n'est pas planifiée : elle sanctionne la première version **stable et complète**.

## [Unreleased]

### Corrigé
- **Import silencieux** (rien ajouté, aucun message) : `crypto.randomUUID` n'existe qu'en
  **contexte sécurisé** (https / localhost) ; ailleurs (http via IP LAN) la génération d'ID jetait
  et l'import était abandonné sans trace. `newId` retombe désormais sur `crypto.getRandomValues`
  (UUID v4) — fonctionne partout. C'était le seul chemin d'échec silencieux ; toute erreur d'import
  restante est maintenant **affichée**.
- **Encodeur** : filet anti-blocage (timeout 60 s) — un worker qui ne rend jamais la main échoue
  proprement au lieu de figer l'import.

### Tests
- Régression unitaire (`newId` sans `randomUUID`) + **E2E** (import en contexte non sécurisé simulé
  via `addInitScript`). E2E d'import étendus au **WAV stéréo & plus long**. Total : 70 unitaires,
  4 E2E.

## [0.5.0] - 2026-07-01 — M4 (Bibliothèque & import)

> **Validé sur web** (navigateur réel, E2E) : import → OGG/Opus → re-décodage → bibliothèque, et
> lecture d'un sample assigné. Chaîne sur appareil Android = 2ᵉ temps (spec §16).

### Ajouté
- **Encodeur Opus/WASM** (`engine/encoder.ts`) : socle **opus-recorder** (MIT, libopus + ogg en
  WASM, worker embarqué), 96 kbps ; `Encoder` injectable. Émet OpusHead + OpusTags + audio.
- **Pipeline d'import** (`commands.importSample`) : garde 20 Mo → `decodeAudioData` → encode Opus →
  **re-décodage garde-fou** → entrée `Sample`. Erreurs typées (`tooLarge` / `undecodable` /
  `encodeFailed`).
- **Bibliothèque** (`Library.svelte`) : import (API File), pré-écoute (`previewSample`), renommage,
  suppression avec **avertissement des pads impactés** (qui passent *introuvable*, §12).
- Moteur : `decode` (PCM + durée) et `previewSample` (voix transitoire).
- **État de pad *introuvable*** (sample assigné puis supprimé) en plus de actif / vide.

### Tests — couche E2E (nouveau, durable)
- **Playwright / Chromium** en Docker (image officielle version-alignée, `docker-compose.e2e.yml`,
  `npm run test:e2e`). Exerce le **vrai** navigateur : Web Audio + Worker WASM (encodeur), import
  et lecture réels — ce que les mocks Vitest ne peuvent pas voir.
- `e2e/import.spec.ts` (encodage OGG/Opus réel), `e2e/play.spec.ts` (assignation + lecture Loop →
  pad actif).
- Hook `tests-gate` étendu : lance l'E2E et **bloque le commit** si un fichier `src/`/`e2e/` est
  touché et que l'E2E échoue (garantit que la dette « encodeur cassé qui passe les mocks » ne
  revienne pas).

### Corrigé
- Encodeur Opus : les en-têtes **OpusHead/OpusTags** manquaient (OGG indécodable) — ajout de la
  requête `getHeaderPages`. Bug invisible aux tests mockés, attrapé par l'E2E.
- Dev : HMR Vite (`ws://0.0.0.0:1421` injoignable) → HMR sur le port de l'app ; serveur en
  `host: true`.

### Retiré
- Loader dev M3 (`DevLibrary`, commandes `devAddSample`/`attachSampleBuffer`) remplacé par la
  Bibliothèque réelle + le pipeline d'import.

## [0.4.0] - 2026-07-01 — M3 (Édition)

> **Validé sur web** : une banque se configure de A à Z sans toucher au code (63 tests).
> Validation Android = 2ᵉ temps (spec §16).

### Ajouté
- **Mode Édition** : bascule Jeu ↔ Édition, sélection de pad (`selectedPadId`).
- **Commandes pads** : `addPad` (1ʳᵉ case libre / position donnée), `renamePad`, `setPadPlayMode`,
  `setPadGainDb` (borné [-60, +6]), `assignSample` (depuis la bibliothèque, ou vider), `deletePad`
  (stoppe la voix), `reorderPads` (échange de position).
- **Commandes pages** : `addPage`, `renamePage`, `deletePage` (refuse la dernière ; stoppe +
  renumérote), `setPageVoiceMode`, `setPageGrid` (**invariant de réduction** : refus si un pad
  tomberait hors grille), `reorderPages`.
- **Bibliothèque** : `hydrateLibrary`, et le pont dev `devAddSample` / `attachSampleBuffer`
  (le loader dev alimente `store.samples` ; remplacé par l'import réel en M4).
- **UI** : `Editor.svelte` (réglages page + pad : mode, gain slider dB, renommage, assignation,
  suppression, redimensionnement de grille avec gardes), sélection de pad et cases « + » dans
  `PadGrid`, ajout de page dans `PageTabs`, bouton bascule Jeu/Édition. `DevLibrary.svelte`
  remplace le loader M2.
- **Domaine** : `id.ts` (`newId`, Web Crypto, injectable), `firstFreePosition`.

### Tests
- 63 tests (Vitest), dont 16 dédiés à l'édition : CRUD pads/pages, invariant de réduction de
  grille, bibliothèque (pont dev), sélection.

## [0.3.0] - 2026-07-01 — M2 (Cœur)

> **Validé sur web** : matrice de comportement §7 couverte par 47 tests + grille jouable en dev
> (banque seed). Validation Android = 2ᵉ temps (spec §16).

### Ajouté
- **Moteur audio (M2)** : Gate (`press`/`release`), Loop (`toggleLoop` start/stop), **choke Mono**
  (démarrer un pad arrête les autres voix de la page), re-déclenchement self, plafond de voix en
  **FIFO** (lu depuis `Settings.maxVoices`), `stopPad` / `stopPage`. Une voix porte désormais sa
  `pageId`.
- **Domaine** : `selectors.ts` (lectures pures de l'arbre banque : `pagesSorted`, `padsOfPage`,
  `padAtPosition`, `findPad`, `findPage`).
- **Store** : arbre banque + `activePageId` + getter dérivé `activePage`.
- **Commandes de jeu** : `firePad`, `pressPad`/`releasePad`, `toggleLoopPad`, `stopPad`,
  `stopPage`, `setActivePage`, `hydrateBank` (chargement d'une banque — réutilisé par la
  persistance M5).
- **Entrée** : `pad-input.ts` (Pointer Events → intentions par Mode de lecture, `setPointerCapture`
  pour Gate, relâchement de sécurité au détachement).
- **UI** : `PageTabs` (navigation), `PadGrid` + `Pad` (grille `rows`×`cols`, état actif/vide,
  indicateur de lecture piloté par `activePadIds`). Libellés de mode via i18n (`mode.*`).
- **Seed dev (temporaire)** : `dev-seed.ts` (2 pages Poly/Mono couvrant les 3 modes) +
  `M2SampleLoader.svelte` (charge des sons dans les slots via l'API File). Remplacés par
  l'édition (M3) / l'import (M4) / la persistance (M5).

### Tests
- 47 tests (Vitest) : bornes/invariants, sélecteurs, moteur One-Shot + matrice §7 (Gate, Loop,
  choke Mono, FIFO, stop), couche commandes, mappage `pad-input`. `AudioContext` factice partagé
  (`tests/engine/fake-audio-context.ts`).

### Retiré
- Harnais de démo M1 (`M1AudioDemo.svelte` + commandes `loadDemoSound`/`fireDemoPad`) remplacé par
  la grille réelle.

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
