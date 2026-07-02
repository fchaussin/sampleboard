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
- [ ] Tous les jalons M0→M7 livrés et validés.
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
| **D' — Interface** | M6 | `0.7.0` | L'UI/UX refondue : topbar, bottombar, drawer. |
| **E — Livraison** | M7 | `0.8.0` | Empaqueté pour F-Droid. |
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
- [x] `toggleEditMode` + bascule Édition ↔ Jeu (sélection de pad `selectedPadId`).
- [x] Commandes pads : `addPad`, `renamePad`, `setPadPlayMode`, `setPadGainDb`, `assignSample`, `deletePad`, `reorderPads`.
- [x] Commandes pages : `addPage`, `renamePage`, `deletePage`, `setPageVoiceMode`, `setPageGrid`, `reorderPages`.
- [x] `Editor.svelte` : Mode de lecture, gain (slider dB), renommage, assignation, suppression ; réglages de page.
- [x] Grille redimensionnable `rows`×`cols` + invariant de réduction (réduction refusée si un pad tomberait hors grille).
- [x] Assignation depuis la bibliothèque (sélecteur Editor) ; loader dev `DevLibrary` alimente `store.samples` (pont vers l'import M4).
- [x] **Tests** : 63 tests (dont 16 dédiés à l'édition), verts en Docker.
- [x] **Validation web (1er temps)** : configurer une banque de A à Z sans toucher au code, sur http://localhost:1420. Android = 2ᵉ temps (§16).

### M4 — Bibliothèque & import · `0.5.0` · Phase C
- [x] `engine/encoder.ts` : **WASM libopus** via opus-recorder (worker embarqué, OpusHead/Tags + audio, 96 kbps), `Encoder` injectable. _(fallback WebCodecs opportuniste : non requis, plus tard ; build-from-source → M6)_
- [x] Pipeline import : validation 20 Mo → `decodeAudioData` → `durationMs` → encode Opus 96 kbps → garde-fou re-décodage → entrée bibliothèque. _(source via API File ; `dialog`/`fs` + écriture disque `{sampleId}.ogg` → **M5** avec la persistance, Tauri-only)_
- [x] `Library.svelte` : import, renommage `label`, suppression (avertissement pads impactés), **pré-écoute**.
- [x] `assignSample` depuis la bibliothèque (sélecteur dans l'Editor).
- [x] États pad : *actif / introuvable / vide*.
- [x] **Tests E2E (Playwright/Chromium)** : encodeur Opus réel + import + lecture — la couche qui manquait (dette encodeur résolue).
- [x] **Validation web (1er temps)** : chaîne décode→encode→re-décode fiable en navigateur réel (E2E). Chaîne sur **appareil réel** Android = 2ᵉ temps (§16).

### M5 — Persistance & réglages · `0.6.0` · Phase D
- [x] `db.ts` : contrat `SqlExecutor` + migrations (`user_version`) + verrou d'écriture partagé
  (pool sqlx du plugin : une seule écriture logique à la fois, transactions sûres).
- [x] Schéma SQLite complet (`bank`, `pages`, `samples`, `pads`, `settings`) — migration 1.
- [x] `BankRepository` (transaction, upsert-puis-élagage), `SampleRepository` (fichiers
  `{appDataDir}/audio/` + métadonnées), `SettingsRepository` (ligne unique) ; adaptateurs
  Tauri (`storage/tauri.ts`, sql + fs, capabilities étendues) et **fallback mémoire** pour le
  navigateur nu (`storage/memory.ts`, session seulement).
- [x] `persistence.ts` : autosave débouncé 400 ms (banque) + écritures immédiates (import,
  réglages) + `flush()` au passage en arrière-plan. Réactivité injectée (`watch.svelte.ts`).
- [x] `Settings.svelte` : Arrière-plan, Nombre maximum de voix, langue (`setLocale`).
- [x] Application de `backgroundBehavior` sur cycle de vie (visibilitychange) : `stopAll` /
  `stopSustained` (voix entretenues Gate/Loop) / `keepPlaying` ; moteur `stopAll`,
  `stopSustained`, `suspend`.
- [x] Hydratation du store au démarrage (réglages → bibliothèque + buffers → banque ; banque
  par défaut au premier lancement). Seed dev retirée.
- [x] **Tests** : 128 unitaires (dont storage contre un **vrai SQLite** via `node:sqlite`,
  persistance aux timers simulés) + 4 E2E, verts en Docker ; build + `cargo check` OK.
- [x] **Validation (fenêtre `tauri dev`)** : fermer/rouvrir → rechargé fidèlement. Nécessitait
  deux correctifs d'environnement (volume `app-home` — le conteneur `--rm` emportait la base ;
  `PULSE_SERVER` WSLg). Persistance vérifiée par sonde : banque par défaut écrite par la
  transaction réelle du plugin puis relue depuis un autre conteneur. **Son dans la fenêtre
  WSLg toujours muet** (environnement non idéal) → suivi en backlog (Entrantes #3), à
  recorriger avant/pendant M6 ; audio sur appareil Android = 2ᵉ temps (§16).

### M6 — Interface · `0.7.0` · Phase D'

> Issu du tri backlog #2 (2026-07-02). Décisions figées : bottombar complète (bascule
> Jeu ↔ Édition, Stop général, Bibliothèque, Import rapide, pages, accès Réglages) ;
> bibliothèque en **panneau plein écran** ; drawer pad ouvert **en Édition seulement**
> (en Jeu, un tap joue) ; drawer page/Réglages accessibles dans les deux modes.

- [x] État UI : `drawer` (`'pad' | 'page' | 'settings' | null`) + `libraryOpen` dans le store ;
  commandes `openPadDrawer` / `openPageDrawer` / `openSettingsDrawer` / `closeDrawer`,
  `openLibrary` / `closeLibrary`, `stopAllVoices` (panique bottombar).
- [x] `Topbar.svelte` : infos de la page active (nom/numéro, chip Édition, Polyphonie, grille)
  → tap = drawer page.
- [x] `Bottombar.svelte` : bascule Jeu ↔ Édition, Stop général, pages (défilables + ajout en
  Édition), Import rapide (erreurs en snackbar), Bibliothèque, Réglages. Icônes SVG inline
  (`Icon.svelte`, zéro dépendance).
- [x] `Drawer.svelte` (droite, avec voile) : contenus `PadSettings` / `PageSettings` /
  `Settings` (réglages généraux) ; fermeture ✕ / tap hors.
- [x] `LibraryPanel.svelte` : bibliothèque en panneau plein écran (contenu `Library`).
- [x] Éclatement d'`Editor.svelte` → `PadSettings.svelte` + `PageSettings.svelte` (drawer) ;
  `PageTabs` absorbé par la bottombar ; aide d'import partagée (`ui/import-file.ts`).
- [x] Pad en Édition : tap → drawer pad ; case « + » : création + drawer ; suppression du pad
  sélectionné → fermeture ; changement de mode → fermeture.
- [x] Passe esthétique globale : palette (`--panel`/`--border`/`--danger`), cibles tactiles
  ≥ 44 px, grille centrée plein écran `100dvh`, safe-areas Android, formulaire de tiroir
  mutualisé (`.drawer-form`).
- [x] i18n : nouvelles clés (bottombar, drawer, panneau bibliothèque).
- [x] **Tests** : 141 unitaires (dont 13 commandes UI) + 4 e2e adaptés aux nouveaux parcours
  (import rapide, tiroir, Stop général), verts en Docker.
- [x] **Validation web (1er temps)** : parcours complet couvert en e2e (import → tiroir →
  assignation → jeu → stop) + captures 390×844 revues. Android/captures fastlane ensuite (M7).

### M7 — Empaquetage · `0.8.0` · Phase E

> Entamé en avance (2026-07-02) puis suspendu au profit de M6 — Interface : les captures
> fastlane dépendent de la nouvelle UI.
- [x] Build Android (APK) : toolchain Docker épinglée (`docker-compose.android.yml`),
  `tauri android init` (projet `gen/android` committé), APK **debug** (154 Mo) et **release
  non signé** (8,7 Mo, aarch64) produits. Vérifié à l'aapt : `versionCode 6000` /
  `versionName 0.6.0`, **zéro permission** (INTERNET relégué à l'overlay debug, §16),
  minSdk 24. Signature = F-Droid (ou clé locale à créer pour distribution directe).
- [x] Audit FOSS de **toutes** les dépendances (npm 5 paquets runtime, 467 crates Rust,
  Gradle AndroidX/Material) : zéro propriétaire, zéro Play Services — voir `doc/audit-foss.md`.
- [ ] Build reproductible (toolchain épinglée ✓ ; déterminisme APK + WASM opus build-from-source à traiter).
- [x] En-têtes SPDX complets + conformité licence (audit : 1 manquant corrigé, 100 % couvert).
- [~] Métadonnées F-Droid (fastlane) : descriptions FR/EN ✓ ; captures + changelogs (par
  versionCode) restants.
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

| # | Feature | Décrite le | Cible proposée | Statut |
|---|---|---|---|---|
| 1 | Signalement visuel d'un sample dont le **fichier disque a disparu** (aujourd'hui : sample listé, pad muet no-op — voir doc M5) | 2026-07-02 | — | À trier |
| 2 | **Refonte de l'agencement UI** : *bottombar* (actions principales + pages + accès Réglages généraux) ; *topbar* (infos importantes de la page) ; *drawer* contextuel à droite (réglages page & pad). Spec affinée le 2026-07-02 (voir jalon M6). | 2026-07-02 | `0.7.0` | **Planifiée → M6** |
| 3 | **Correctif env dev** : son muet dans la fenêtre `tauri dev` sous WSLg malgré `PULSE_SERVER` (diagnostiquer WebKitGTK/GStreamer/Pulse — cookie ? sink ?). N'affecte pas la cible Android. | 2026-07-02 | — | À trier |

---

## 5. Processus (léger)

- **Une tâche = une case** rattachée à un jalon ; **un jalon = une version** `minor`.
- **Nouvelle feature en cours de dev** → ligne dans *Backlog › Entrantes* (statut *À trier*), jamais insérée en douce dans un jalon en cours. Au tri : soit un `minor` futur, soit v2, soit rejetée.
- **Correctif** trouvé pendant un jalon → traité dans le jalon (sortie en `patch` si déjà livré).
- **Fin de jalon** : cocher les tâches, mettre à jour `CHANGELOG.md`, tag `vX.Y.Z`.
- Les **décisions structurantes** se figent dans `specifications.md` (§16), pas ici.
