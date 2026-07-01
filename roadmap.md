# Sampleboard — Roadmap & gestion de projet

> Pilotage du projet : phases, jalons, tâches, versionnage, backlog.
> La **spécification technique** est dans [`specifications.md`](./specifications.md) (vocabulaire, archi, décisions).
> Ce document est **vivant** : les tâches et le backlog évoluent ; les décisions verrouillées, elles, vivent dans la spec.

---

## 1. Versionnage — SemVer `major.minor.patch`

Départ : **`0.1.0`**.

| Élément | Règle |
|---|---|
| **`major = 0`** | Tant que l'app n'est **pas stable & complète**. Le modèle de données peut encore bouger (via migrations). |
| **`minor`** (`0.x.0`) | Incrémenté à chaque **jalon livré** (lot cohérent de fonctionnalités validé). |
| **`patch`** (`0.x.y`) | Corrections / ajustements **sans nouvelle fonctionnalité**. |
| **`1.0.0`** | **NON planifiable.** Décernée quand l'app est **stable ET complète** : tous les jalons v1 terminés, testée sur appareil réel, empaquetée et publiable F-Droid. C'est un *critère de qualité*, pas une échéance. |
| Au-delà de 1.0 | Nouvelle feature → `minor` (`1.1.0`…) ; changement cassant → `major` (`2.0.0`). |

- Un **`CHANGELOG.md`** (format *Keep a Changelog*) est tenu à jour à chaque version.
- Une version = un **tag git** `vX.Y.Z` une fois le jalon validé.

### Critères d'éligibilité à `1.0.0`
- [ ] Tous les jalons M0→M6 livrés et validés.
- [ ] Testée sur ≥ 2 appareils Android réels (latence, autoplay, arrière-plan).
- [ ] Chaîne import→encodage Opus fiable sur appareil réel.
- [ ] Persistance robuste (rechargement fidèle, migrations testées).
- [ ] i18n : au moins FR complet, mécanique EN prête.
- [ ] Build reproductible + audit FOSS OK + métadonnées F-Droid prêtes.
- [ ] Aucun bug bloquant ouvert.

---

## 2. Phases → jalons → versions

| Phase | Jalons | Version cible | But |
|---|---|---|---|
| **A — Fondations** | M0 | `0.1.0` | Le socle technique tourne. |
| **B — Cœur jouable** | M1, M2 | `0.2.0`, `0.3.0` | On entend du son, on joue la grille. |
| **C — Configuration** | M3, M4 | `0.4.0`, `0.5.0` | On édite ses pads et on gère la bibliothèque. |
| **D — Durabilité** | M5 | `0.6.0` | Tout est persisté et rechargé. |
| **E — Livraison** | M6 | `0.7.0` | Empaqueté pour F-Droid. |
| **F — Stabilisation** | — | → `1.0.0` | Durcissement, tests réels, complétude. |

Statuts de tâche : `[ ]` à faire · `[~]` en cours · `[x]` fait.

---

## 3. Tâches par jalon

### M0 — Socle · `0.1.0` · Phase A
- [x] Init dépôt + `package.json`, Vite + Svelte 5 (runes).
- [x] `tsconfig.json` strict.
- [x] `svelte.config.js` : SPA statique, SSR désactivé (Vite + Svelte, sans routeur — voir note).
- [x] Init Tauri v2 (`src-tauri/`), Rust minimal.
- [x] Plugins Tauri : `sql`, `fs`, `dialog` (config + capabilities).
- [x] Arborescence `domain / engine / storage / app / ui` (dossiers + stubs).
- [x] Composition root `create-app.ts` (injection explicite, pas de singletons).
- [x] i18n minimal : `i18n/index.ts` (loader + `t()`), `fr.json` starter, rune `locale` (dans le store).
- [x] `LICENSE` GPL-3.0-or-later + en-têtes SPDX de base + `README.md`.
- [x] **Validation** : coquille Tauri compilée en Docker rootless (Rust + plugins + front embarqué,
  binaire produit) ; front rend `t()` (`svelte-check` 0 erreur, `vite build` OK). Fenêtre `tauri dev`
  ouvrable via l'overlay GUI (WSLg).

> **Note (M0)** — `svelte.config.js` : la spec dit « adapter-static / SSR off ». Interprété comme
> **SPA statique Vite + Svelte 5 sans SvelteKit** (montage manuel via `main.ts`), cohérent avec
> « pas de routeur » (spec §4). Aucun SSR n'existe donc à désactiver. À confirmer/figer en spec §16.

### M1 — Audio · `0.2.0` · Phase B
- [x] `AudioEngine` + `AudioContext` (fabrique injectable pour les tests).
- [x] `resume()` idempotent sur 1er geste (politique autoplay ; reprend aussi depuis `interrupted`).
- [x] Cache de buffers `load()` / `unload()` (`Map<sampleId, AudioBuffer>`) + `isLoaded()`.
- [x] `voice.ts` (structure d'une voix active + `gainDbToAmplitude`).
- [x] `oneShot()` : `AudioBufferSourceNode` → `GainNode` (conversion dB→amplitude) → sortie ; re-tap = relance depuis 0 (fade anti-clic ~8 ms).
- [x] `onPlayingChanged` callback (reflet des voix actives ; no-op silencieux si pad vide/buffer absent).
- [x] Un pad **codé en dur** qui joue un buffer importé (One-Shot) — harnais démo `M1AudioDemo.svelte` (temporaire, retiré au M2/M4).
- [x] **Tests** : suite Vitest du cœur audio (18 tests, verts en Docker) — voir `doc/moteur-audio.md`.
- [x] **Validation web (1er temps)** : son émis + `resume()` OK en dev via `M1AudioDemo` (http://localhost:1420 + `tauri dev` bureau) ; tests verts + `svelte-check` + build.
- [ ] **Validation Android (2ᵉ temps)** : son émis + `resume()` sur **appareil réel** — web d'abord, Android ensuite (voir spec §16).

### M2 — Cœur · `0.3.0` · Phase B
- [x] `domain/types.ts` + `enums.ts` + `invariants.ts` + `selectors.ts` (+ tests purs).
- [x] `store.svelte.ts` : arbre banque, `activePageId`, `editMode`, `activePadIds` (+ getter `activePage`).
- [x] `commands.ts` — jeu : `firePad`, `pressPad`/`releasePad`, `toggleLoopPad`, `stopPad`, `stopPage` (+ `hydrateBank`, `setActivePage`).
- [x] `pad-input.ts` : Pointer Events → intentions par Mode de lecture (+ `setPointerCapture` Gate, relâchement de sécurité au détachement).
- [x] Multi-pages + `PageTabs` (navigation) ; `PadGrid` + `Pad` (grille `rows`×`cols`, état actif/vide).
- [x] 3 Modes de lecture (One-Shot / Gate / Loop).
- [x] Polyphonie Mono/Poly : choke Mono, re-déclenchement self.
- [x] `maxVoices` en FIFO (interne, plafond lu depuis les réglages).
- [x] **Tests** : 47 tests (domaine, moteur M2, commandes, pad-input), verts en Docker.
- [x] **Validation web (1er temps)** : matrice §7 couverte par les tests + grille jouable (banque seed dev) sur http://localhost:1420. Android = 2ᵉ temps (voir §16).

### M3 — Édition · `0.4.0` · Phase C
- [ ] `toggleEditMode` + bascule Édition ↔ Jeu.
- [ ] Commandes pads : `addPad`, `renamePad`, `setPadPlayMode`, `setPadGainDb`, `assignSample`, `deletePad`, `reorderPads`.
- [ ] Commandes pages : `addPage`, `renamePage`, `deletePage`, `setPageVoiceMode`, `setPageGrid`, `reorderPages`.
- [ ] `Editor.svelte` : Mode de lecture, gain (slider dB), renommage, assignation, suppression.
- [ ] Grille redimensionnable `rows`×`cols` + invariant de réduction.
- [ ] **Validation** : configurer une banque de A à Z sans toucher au code.

### M4 — Bibliothèque & import · `0.5.0` · Phase C
- [ ] `engine/encoder.ts` : intégration **WASM libopus** (build + fallback WebCodecs opportuniste).
- [ ] Pipeline import : `dialog` → `fs` → validation 20 Mo → `decodeAudioData` → `durationMs` → encode Opus 96 kbps → écriture `{sampleId}.ogg`.
- [ ] `Library.svelte` : import, renommage `label`, suppression (avertissement pads impactés), **pré-écoute**.
- [ ] `assignSample` depuis la bibliothèque (sélecteur dans l'Editor).
- [ ] États pad : *actif / introuvable / vide*.
- [ ] **Validation** : chaîne décode→encode fiable sur **appareil réel**.

### M5 — Persistance & réglages · `0.6.0` · Phase D
- [ ] `db.ts` : wrapper `tauri-plugin-sql` + migrations (`user_version`).
- [ ] Schéma SQLite complet (`bank`, `pages`, `samples`, `pads`, `settings`).
- [ ] `BankRepository`, `SampleRepository`, `SettingsRepository`.
- [ ] `persistence.ts` : autosave débouncé (config) + écritures immédiates (import, réglages).
- [ ] `Settings.svelte` : Arrière-plan, Nombre maximum de voix, langue (`setLocale`).
- [ ] Application de `backgroundBehavior` sur cycle de vie Android.
- [ ] Hydratation du store au démarrage.
- [ ] **Validation** : fermer/rouvrir → tout est rechargé fidèlement.

### M6 — Empaquetage · `0.7.0` · Phase E
- [ ] Build Android (APK).
- [ ] Audit FOSS de **toutes** les dépendances (plugins Tauri, WASM libopus) : zéro transitive propriétaire.
- [ ] Build reproductible (toolchain épinglée, déterministe).
- [ ] En-têtes SPDX complets + conformité licence.
- [ ] Métadonnées F-Droid (fastlane : descriptions, captures, changelog).
- [ ] Soumission F-Droid (RFP / merge request metadata).
- [ ] **Validation** : APK installable, app fonctionnelle hors Play Services.

### Phase F — Stabilisation · → `1.0.0`
- [ ] Tests sur plusieurs appareils réels (latence, autoplay, veille).
- [ ] Perf : polyphonie, latence de déclenchement.
- [ ] i18n : FR complet, EN de référence.
- [ ] Résorption des bugs du backlog.
- [ ] Revue des critères §1 → tag `v1.0.0`.

---

## 4. Backlog — features à trier

> Toute nouvelle idée atterrit ici d'abord (statut **À trier**), puis reçoit une **cible** (un `minor` v0.x, la v2, ou *rejetée*) lors d'un point de tri. Rien ne part en dev sans passer par le backlog.

### v2 (post-1.0, connues — issues de la spec §17)
- [ ] **Découpe/rognage** de sample (« découper » : trim, sélection d'extrait à l'import).
- [ ] **Multi-banques** (plusieurs banques, bascule ; schéma déjà prêt).
- [ ] Conteneur intermédiaire **« pool »** (bibliothèque ↔ banque) — à évaluer.
- [ ] Raccourcis clavier.
- [ ] Enregistrement de samples (micro).
- [ ] Effets : volume master, fondu, pitch.
- [ ] Affichage waveform.
- [ ] Réorganisation drag-and-drop avancée.
- [ ] MIDI.
- [ ] Mode navigateur pur (implémentation web des repositories).
- [ ] Export/import de banque (fichier portable).
- [ ] **Import par URL** — importer un sample depuis une URL (réutilise le pipeline d'import ; limite `Content-Length` configurable via `.env`, commune import local + URL). Accès réseau **demandé à la volée** (autorisation just-in-time au déclenchement, pas de permission permanente) → impact F-Droid. _(trié 2026-07-01)_
- [ ] iOS.

### Entrantes — à trier
_(vide — à alimenter au fil du dev)_

| # | Feature | Décrite le | Cible proposée | Statut |
|---|---|---|---|---|
| — | — | — | — | À trier |

---

## 5. Processus (léger)

- **Une tâche = une case** rattachée à un jalon ; **un jalon = une version** `minor`.
- **Nouvelle feature en cours de dev** → ligne dans *Backlog › Entrantes* (statut *À trier*), jamais insérée en douce dans un jalon en cours. Au tri : soit un `minor` futur, soit v2, soit rejetée.
- **Correctif** trouvé pendant un jalon → traité dans le jalon (sortie en `patch` si déjà livré).
- **Fin de jalon** : cocher les tâches, mettre à jour `CHANGELOG.md`, tag `vX.Y.Z`.
- Les **décisions structurantes** se figent dans `specifications.md` (§16), pas ici.
