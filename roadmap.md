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
- [ ] Tous les jalons M0→M9 livrés et validés.
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
| **D'' — Éditeur audio** | M7 | `0.8.0` | « Découper » : waveform + rognage + undo/redo. |
| **D''' — Bibliothèque avancée** | M8 | `0.9.0` | Tags + filtres, assignation directe, combobox. |
| **E — Livraison** | M9 | `0.10.0` | Empaqueté pour F-Droid. |
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
- [x] **Couleurs** (2ᵉ passe, demandes du 2026-07-02) : prop `color` (token) sur pages et
  pads — palette **OKLCH** homogène (8 teintes, `--c-*` dans app.css), `ColorPicker` partagé,
  onglets et pads teintés, **migration 2** (colonnes `color`), tokens inconnus neutralisés.
- [x] **Noms par défaut** : page de la banque par défaut « Principal », pages ajoutées
  « Page N » (générateurs i18n injectés depuis le bootstrap, §4) ; un pad sans nom prend le
  label du sample assigné (extension retirée, rogné à 12 caractères).
- [x] **Modale de choix de sample** (`<dialog>`, `SamplePicker`) : liste + pré-écoute +
  « aucun » + import direct (importé → assigné). Empilement des surcouches formalisé :
  couche 0 app / couche 1 tiroir & panneau (`--z-*`) / modales en top-layer natif (l'ordre
  d'ouverture fait la pile — prêt pour la modale de crop, backlog #4).
- [x] **Bibliothèque** : méta affichées (taille Mo, durée s — `Intl.NumberFormat`). LUFS →
  backlog #7.
- [x] **Grille 1×1** : bornes élargies (`rows [1,12]`, `cols [1,6]`) — **migration 3**
  (reconstruction de `pages`, procédure SQLite, cascade FK vérifiée) ; spec §2/§6/§8/§16 à jour.
- [x] **Board complet dès l'init** (3ᵉ passe, décision §16) : `BankFactory` (classe injectée,
  style OO) — page « Principal » colorée et grille REMPLIE au premier lancement, pages
  ajoutées complètes, agrandissement de grille comblé, chaque pad coloré (cycle de palette
  par position). Style pad : contour plein + fond teinté transparent ; nom au-dessus du mode
  (gras si affecté, italique semi-transparent si vide ; substituts distincts « (vide) » /
  « (sans nom) »). `color` requis (`Color | null`, une seule représentation de l'absence),
  `PadStatus` typé.
- [x] **Grille full adaptatif** : les pads occupent TOUT l'espace disponible (pistes 1fr,
  plus de ratio carré ni de largeur plafonnée).
- [x] **Stop par pad** : bouton en évidence en bas à droite du pad pendant la lecture
  (One-Shot/Loop — Gate se stoppe au relâchement), couvert en e2e.
- [x] **Création enchaînée** : ajouter une page (bouton « + » bottombar, Édition) ouvre le
  tiroir des propriétés de la nouvelle page (comme la création de pad).
- [x] **État de lecture reflété par l'intensité** : pad en lecture = fond plein + halo,
  montée instantanée / retombée douce ; affectés 45 % ; vides en retrait.
- [x] **Visualiseurs** (backlog #9 intégré) : `AnalyserNode` par voix (moteur `waveform()`,
  `progress()`, `peaks()` en cache) — dans le pad en lecture, **progression en forme d'onde
  du fichier** (pics statiques, partie jouée pleine / reste estompé) ; **visualiseur global
  multi-voix dans la topbar** (une onde temps réel par voix, à la couleur du pad) avec
  **Stop général contextuel** à côté des ondes.
- [x] **Tests** : 156 unitaires + 4 e2e adaptés (modale, tiroir, Stop général), verts en Docker.
- [x] **Validation web (1er temps)** : parcours complet couvert en e2e (import → tiroir →
  modale → jeu → stop) + captures 390×844 revues. Android/captures fastlane ensuite (M7).

### M7 — Éditeur audio (« Découper ») · `0.8.0` · Phase D''

> Tri du 2026-07-02 : backlog #4 + #5 rapatriés de v2 en v1 (décision figée en spec §16).
> Vue dédiée plein écran, ouverte à l'import (depuis la modale/bibliothèque) et depuis un
> sample existant de la bibliothèque (retravail → ré-encodage).

- [x] `engine` : rognage du PCM décodé AVANT encodage Opus (`engine/pcm.ts` pur : `trimPcm`,
  `clampSelection` — durée min 10 ms, `computePeaks` partagé avec `engine.peaks`, DRY) ;
  pré-écoute de PCM (`previewPcm`/`stopPcmPreview`).
- [x] Rendu **waveform** (canvas, pics par tranche en cache) du PCM décodé.
- [x] Vue `AudioEditor` plein écran (`<dialog>` top-layer, au-dessus de la modale de sample) :
  waveform + **poignées start/end** (pointeur, poignée la plus proche), sélection pleine vs
  estompée, temps affichés, pré-écoute, valider/annuler (échec → éditeur ouvert + message).
- [x] **Undo/redo** : `SelectionHistory` (classe OO §16), un cran par relâchement de poignée.
- [x] Branchement : **tout import ouvre l'éditeur** (Import rapide, Bibliothèque, modale de
  sample — pad à assigner mémorisé) + entrée « ✂ Découper » sur chaque sample
  (`beginSampleRework` : re-décode l'OGG → éditeur → ré-encode, id/fichier conservés,
  `SampleRepository.replace`, restauration meilleur-effort en cas d'échec). `durationMs`
  désormais dérivée du PCM.
- [x] i18n + **tests** : 197 unitaires (pcm, historique, flux éditeur, replace) + **6 e2e**
  (drag réel de poignée, undo, durée persistée réduite, retravail), verts en Docker.
- [x] **Validation web (1er temps)** : parcours e2e complets (importer → rogner → jouer ;
  rouvrir et re-rogner) + capture revue. Verdict visuel utilisateur avant tag.

### M8 — Bibliothèque avancée · `0.9.0` · Phase D'''

> Tri du 2026-07-02 : backlog #10+#11+#12. Décisions figées : tags = DONNÉES n-à-n
> (table `tags` + jointure `sample_tags`, migration 4), liste par défaut SEMÉE au premier
> lancement (SFX, Répliques, Jingle, Musique, Ambiance, Voix, Réaction, Meme, Alerte —
> libellés i18n injectés, puis entièrement personnalisables) ; **« Non classé » = filtre
> VIRTUEL** (samples sans tag, jamais stocké — une seule représentation de l'absence).

- [x] Domaine `Tag` + migration 4 (`tags`, `sample_tags`, cascades) ; `TagRepository`
  (CRUD tags + affectations, idempotence) SQL/mémoire/factice ; semis des 9 tags par défaut
  au premier lancement UNIQUEMENT.
- [x] Store (`tags`, `sampleTags`, `libraryFilter`) + commandes (CRUD tag — suppression épure
  affectations et filtre —, bascule tag↔sample avec « Non classé » = absence d'entrée,
  filtre) ; `app/tag-filter.ts` pur partagé.
- [x] Bibliothèque : barre de filtres en chips (Tous + tags + Non classé), ligne dépliable par
  sample (chips de tags à bascule), gestion des tags en `<details>` (créer/renommer/supprimer).
- [x] #11 : **assignation À LA VOLÉE** (retour utilisateur : les selects étaient trop
  rigides) — « Assigner à des pads » arme le sample, le panneau se ferme, CHAQUE pad touché
  le reçoit (toutes pages), bannière + Terminer.
- [x] #12 : modale de choix de sample = combobox (recherche texte + filtre par tags, locaux).
- [x] **Pool** (retours utilisateur) : liste de travail de samples en TIROIR GAUCHE
  (session) — « Ajouter au pool » depuis la bibliothèque, toucher un élément l'arme pour
  l'assignation à la volée, le tiroir reste ouvert. Gestion des tags DÉPLACÉE dans une
  modale « Gérer les tags » (en-tête du panneau, exit le <details>).
- [x] Bonus : banque d'init MULTI-PAGES à layouts contrastés (4×4, 2×2, 8×6) ; visualiseur
  global avec animation IDLE (sinusoïdes lentes) ; **livrée Édition violette façon MIDI-map
  Ableton** (mode immanquable) ; conventions figées (CSS sans px hors bordures, éléments UI
  standard).
- [x] #13 : **Import multiple & archives** (demande utilisateur 2026-07-02) — sélection
  multifichier sur les inputs d'import + archives **zip/rar** dépliées via **libarchive
  WASM** (`libarchive.js` MIT / libarchive BSD, lecteurs rar clean-room — unrar officiel
  refusé : licence non libre, bloquante F-Droid, décision §16). UN fichier audio → éditeur
  (flux M7) ; sinon **lot direct** avec **modale de progression** (barre, statut par
  fichier, interruption, agrégation des échecs). Assets worker+wasm servis à chemin stable
  (plugin Vite). 11 tests unitaires (lot, archives, interruption).
- [x] i18n + **tests** : 207 unitaires + **8 e2e** (tags/filtres/Non classé/assignation
  directe/recherche), verts en Docker.
- [x] **Validation web (1er temps)** : parcours e2e complets + captures revues. Verdict
  visuel utilisateur avant tag.

### M9 — Empaquetage · `0.10.0` · Phase E

> Entamé en avance (2026-07-02) puis suspendu au profit de M6/M7 : les captures fastlane
> dépendent de l'UI finale.
- [x] Build Android (APK) : toolchain Docker épinglée (`docker-compose.android.yml`),
  `tauri android init` (projet `gen/android` committé), APK **debug** (154 Mo) et **release
  non signé** (8,7 Mo, aarch64) produits. Vérifié à l'aapt : `versionCode 6000` /
  `versionName 0.6.0`, **zéro permission** (INTERNET relégué à l'overlay debug, §16),
  minSdk 24. Signature = F-Droid (ou clé locale à créer pour distribution directe).
- [x] Audit FOSS de **toutes** les dépendances (npm 5 paquets runtime, 467 crates Rust,
  Gradle AndroidX/Material) : zéro propriétaire, zéro Play Services — voir `doc/audit-foss.md`.
- [ ] Build reproductible (toolchain épinglée ✓ ; déterminisme APK + WASM opus build-from-source à traiter).
- [x] En-têtes SPDX complets + conformité licence (audit : 1 manquant corrigé, 100 % couvert).
- [x] Métadonnées F-Droid (fastlane) : descriptions FR/EN ✓ ; changelogs par versionCode
  (6000/8000/9000, FR+EN) ✓ ; captures ✓ — 5 phoneScreenshots fr-FR REPRODUCTIBLES
  (`e2e/screenshots.fastlane.spec.ts`, `FASTLANE_SHOTS=1`, 393×852 @3x : board semé,
  lecture Loop, bibliothèque, éditeur, Édition+tiroir), regénérées après #22/#23
  (bibliothèque = vue, capture 5 : attente de fin d'animation du tiroir) et **re-validées
  par l'utilisateur le 2026-07-04**. (À regénérer avant soumission si l'UI évolue encore.)
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
| 4 | **Éditeur audio (waveform + crop à l'import)** : à l'upload, afficher la forme d'onde avec une UI de rognage (start/end) avant encodage, dans une **vue dédiée plein écran** (façon LibraryPanel). ⚠️ C'est le « **découper** » + waveform classés v2 en spec §17 — les rapatrier en v1 = décision à figer en spec §16/§17. Gros morceau : jalon dédié proposé après M6. | 2026-07-02 | `0.8.0` | **Planifiée → M7** |
| 5 | **Undo/redo dans l'éditeur de découpe** : historique des actions (start/end) dans l'UI de crop (#4). Dépend de #4. | 2026-07-02 | `0.8.0` | **Planifiée → M7** |
| 6 | **Titre ID3 à l'import** : lire les tags (ID3 & co) du fichier source pour initialiser `label` (sinon nom de fichier). Améliore aussi le nom par défaut des pads. | 2026-07-02 | — | À trier |
| 7 | **Niveau LUFS des samples** : mesurer la sonie intégrée (ITU-R BS.1770) sur le PCM à l'import, la persister (migration : colonne `loudness_lufs`) et l'afficher en bibliothèque. (Nom/taille/durée : déjà affichés depuis M6.) | 2026-07-02 | — | À trier |
| 8 | **Normalisation de sonie** : ramener les samples à un niveau LUFS cible (réglage global ?) — offset de gain dérivé de la mesure #7, appliqué au GainNode (non destructif) ou au PCM avant encodage. Dépend de #7. | 2026-07-02 | avec #7 | À trier |
| 9 | **Visualiseur audio en topbar (Jeu)** : **une onde par voix active, colorée par la couleur du pad** — `AnalyserNode` par voix (moteur) + rendu canvas compact dans la barre du haut. | 2026-07-02 | `0.7.0` | **Intégrée → M6** |
| 10 | **Tags de samples** : affecter des tags libres aux samples (schéma : table `tags` + jointure → migration) et **filtrer la bibliothèque** par tags. | 2026-07-02 | `0.9.0` | **Planifiée → M8** |
| 11 | **Assignation page→pad depuis la bibliothèque** : depuis un sample, choisir directement une page et un pad cibles (sans passer par le tiroir du pad). | 2026-07-02 | `0.9.0` | **Planifiée → M8** |
| 12 | **Combobox de samples dans le tiroir pad** : parcourir/filtrer les samples (recherche + tags #10) depuis les paramètres du pad, en complément/remplacement de la modale actuelle. | 2026-07-02 | `0.9.0` | **Planifiée → M8** |
| 13 | **Import multiple & archives** : sélection multifichier + archives zip/rar (libarchive WASM, décision §16), lot direct sans éditeur, modale de progression (barre, statut par fichier, interruption). | 2026-07-02 | `0.9.0` | **Intégrée → M8** |
| 14 | **Samples d'usine** : bibliothèque pré-remplie au **premier lancement uniquement** (même garde que banque/tags : ne repoussent jamais). **Livrée le 2026-07-03 (hors jalon, à la demande)** : 78 OGG/Opus (18,3 Mo) + `manifest.json` curaté (libellés, tags d'usine) dans `public/factory-samples/` (injecté dans CHAQUE dist), **validation au build** (plugin Vite : manifest ↔ fichiers, OGG only, build en échec si incohérent), semis sans réencodage (`seedFactorySample`), sélection `board` pré-assignée à la page « Principal » (16 pads, 2 Loop). Tests : 13 unitaires + 1 e2e. **RESTE (redéfini le 2026-07-04, décision §16) : remplacer le lot par une banque de référence ~25 sons exclusivement CC0 Freesound** (previews HQ → Opus 96k, outillage `scripts/freesound-rebank.mjs` prêt, clé API à fournir) — règle les 78 TODO de licence d'un coup. Correctif 2026-07-04 : le semis **gelait** sous politique autoplay sans geste (`decodeSource` attendait `engine.resume()`, jamais résolu avant un geste) → plus de resume dans le décodage, test de régression (voir doc samples-usine). | 2026-07-03 | — | Livrée (licences restantes) |
| 17 | **Tests du bootstrap (`create-app.ts`)** : la garde `firstLaunch` (banque/tags/semis d'usine « premier lancement uniquement », jamais de re-semis sur base existante), l'ordre hydratation → autosave → semis et le chargement des buffers au boot n'ont AUCUN test unitaire (couverts seulement par l'e2e `factory-seed`). Bloqué par l'environnement : `create-app.ts` touche `document` → nécessite jsdom/happy-dom (absent des devDeps) ou l'extraction du cœur du bootstrap en fonction pure testable en node. Identifié par la revue du 2026-07-03. | 2026-07-03 | — | À trier |
| 15 | **Recherche dans la bibliothèque + ergonomie** : champ texte (sur le label, casse/espaces ignorés) **combiné (ET)** aux filtres par tag, **barre d'outils sticky** (import + recherche + filtres visibles au défilement), état « aucun résultat » distinct avec bouton **Tout afficher**. Réutilise `filterSamples` (recherche du picker #12) ; style `.search` mutualisé dans `app.css`. **Layout adaptatif** (media queries) : grille de cartes ≥ 48rem, actions sous le nom en étroit, cibles ≥ 44 px en tactile. **Livrée le 2026-07-03 (hors jalon, à la demande)** — 6 unitaires (`tag-filter.test.ts`) + 1 e2e ; au passage, correctif du timeout e2e `factory-seed` (30 s < semis ~48 s). | 2026-07-03 | — | Livrée |
| 16 | **Pré-écoute stoppable + bus master** : ▶ bascule en ■ pendant la lecture, re-tap ou **toute autre action** = stop ; UN comportement unifié (bibliothèque, modale de sample, éditeur — cœur `#playPreview`/`stopPreview`, composant partagé `PreviewButton`) ; **bus master** `gain → analyseur → destination` = point de passage unique de tout le son (voix + pré-écoutes, `masterWaveform` pour un visualiseur global) ; `fakeEngine` de test mutualisé (7 doublons supprimés). Décisions figées en spec §16. **Livrée le 2026-07-03 (hors jalon, à la demande)** — puis **revue de code (10 findings)** : 2 bugs de synchronisation corrigés (échec de lancement → son orphelin ; garde `onEnded` par identité de source), règle « toute action stoppe » désormais **mécanique** (liste `PREVIEW_STOPPING_COMMANDS` + test générique), analyseur master en dérivation paresseuse (zéro coût de rendu), déconnexion synchrone au stop, styles `.icon-action` mutualisés (app.css). 283 unitaires + 13 e2e. | 2026-07-03 | — | Livrée |
| 18 | **Pool revu (Édition, sidebar, DnD)** : le pool devient un outil d'**Édition exclusivement** — **sidebar systématique** en flux sur écran large (≥ 48 rem, ni bouton ni fermeture), **tiroir gauche** à bouton (bottombar, Édition) en étroit, flottant au-dessus de la bibliothèque ouverte (`--z-pool`) pour le dépôt. **Glisser-déposer** : ligne de bibliothèque → pool, élément du pool → pad (assignation immédiate) — module partagé `ui/interaction/sample-dnd.ts` ; le tactile « armer puis toucher » reste le chemin mobile. En-tête : **Ajouter** (ouvre la bibliothèque) + **Vider** (`clearPool`, désarme si l'armé venait du pool). Décision figée en spec §16. **Livrée le 2026-07-04 (à la demande)** — 1 unitaire (`clearPool`) + e2e adaptés + 1 e2e DnD (les deux sens). Détail livré ensuite : curseur **main** (`grab`/`grabbing`) sur les éléments glissables. | 2026-07-04 | — | Livrée |
| 19 | **Cartes bibliothèque : waveform + progression de pré-écoute** : pics statiques du sample sur chaque carte/ligne (`SampleWaveform.svelte`, tracé partagé `drawPeakBars` avec le pad — DRY), remplissage de la partie jouée pendant la pré-écoute (`engine.previewProgress()`, nouvelle API). rAF uniquement pendant la pré-écoute de la carte concernée. **Livrée le 2026-07-04 (à la demande)** — 1 unitaire (previewProgress). | 2026-07-04 | — | Livrée |
| 20 | **Gestion des tags dans le tiroir droit** : la modale « Gérer les tags » devient une vue du tiroir contextuel (`TagSettings`, `drawer='tags'`, `openTagsDrawer` — inscrite à `PREVIEW_STOPPING_COMMANDS`). Le tiroir passe au-dessus du panneau bibliothèque (`--z-drawer: 27`) : la liste et les filtres se mettent à jour derrière, en direct. `TagManager.svelte` (dialog) supprimé. **Livrée le 2026-07-04 (à la demande)** — 1 e2e (créer depuis le tiroir, filtre visible derrière). | 2026-07-04 | — | Livrée |
| 21 | **Aperçu rapide depuis le pool** : `PreviewButton` partagé (▶/■) en tête de chaque élément + **waveform de progression derrière le libellé** (`SampleWaveform` en fond absolu — le composant remplit désormais son conteneur, taille fixée par l'hôte). Même mécanique de pré-écoute unifiée (#16) : toute autre action stoppe. **Livrée le 2026-07-04 (à la demande)** — e2e pool étendu (▶ actif, armer stoppe). | 2026-07-04 | — | Livrée |
| 22 | **Bibliothèque = vue du layout** (plus de popin) : `libraryOpen` bascule le contenu de `<main>` (grille ↔ bibliothèque) — topbar (titre de vue, visualiseur/Stop conservés) et bottombar restent accessibles (Stop général, bascule de mode, pages). Supprime les surcouches spéciales (`--z-panel`, pool flottant au-dessus de la bibliothèque, `--z-drawer` 27) : en Édition large, la sidebar pool est EN FLUX à côté de la bibliothèque (dnd naturel). Supersède la décision M6 « panneau plein écran » (§16). UX Édition inchangée (violet, tiroir pad, à la volée) — vérifiée par e2e + captures. **Livrée le 2026-07-04 (à la demande, design validé en discussion)**. | 2026-07-04 | — | Livrée |
| 23 | **Navigation pilotée par l'URL** : la vue affichée devient une projection de l'URL (invariant : jamais une variable indépendante — `store.view` remplace le booléen `libraryOpen`). Table `vue → composant` (App.svelte), résolution avec défaut board (`app/navigation.ts`), rendu dynamique, sync bidirectionnelle (init/`hashchange`/retour-avance ↔ écriture d'URL uniquement, `app/router.ts` + `applyRoute` seul écrivain de la vue). Paramètres figés en spec §16 : **fragment `#` + historique délibéré** (push marqué `history.state` / `replace` ajustements / pop — le ✕ et le geste retour Android dépilent la même entrée) ; **cardinalité vue + paramètres** (`#/library?tag=…`, le filtre voyage dans l'URL). **Livrée le 2026-07-04 (à la demande)** — 15 unitaires (navigation + routeur, fenêtre factice) + 2 commandes + 1 e2e (hash, filtre, retour navigateur, ✕). Correctif le jour même : **filtre `?tag=` périmé assaini** (`hydrateTags`/`applyRoute` → « Tous », URL corrigée) — recharger un onglet resté sur un vieux `?tag=` (ids re-générés en dev mémoire) vidait la bibliothèque, samples d'usine « perdus » ; +4 unitaires +1 e2e. | 2026-07-04 | — | Livrée |

---

## 5. Processus (léger)

- **Une tâche = une case** rattachée à un jalon ; **un jalon = une version** `minor`.
- **Nouvelle feature en cours de dev** → ligne dans *Backlog › Entrantes* (statut *À trier*), jamais insérée en douce dans un jalon en cours. Au tri : soit un `minor` futur, soit v2, soit rejetée.
- **Correctif** trouvé pendant un jalon → traité dans le jalon (sortie en `patch` si déjà livré).
- **Fin de jalon** : cocher les tâches, mettre à jour `CHANGELOG.md`, tag `vX.Y.Z`.
- Les **décisions structurantes** se figent dans `specifications.md` (§16), pas ici.
