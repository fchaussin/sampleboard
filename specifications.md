# Sampleboard — Spécification technique

> Document de référence pour l'implémentation. Destiné à être repris dans Claude Code pour la gestion de projet et le découpage en tâches.
> Statut : spec figée sur l'architecture et le vocabulaire ; toutes les décisions structurantes sont tranchées (voir §16).

---

## Glossaire (source de vérité du vocabulaire)

Le produit est **multilingue** (i18n). **Convention** :
- Le **code et le schéma SQLite sont en anglais neutre** — stable, indépendant de la langue, et **plus facile à arbitrer** (moins ambigu que le français).
- Le code ne contient **aucun texte en dur** : uniquement des **clés (tokens) i18n**.
- Les libellés visibles vivent dans des **fichiers de traduction JSON** (`src/ui/i18n/*.json`), **un par langue** ; le **français (`fr.json`) est la langue par défaut et le fallback**.

Le tableau ci-dessous est la référence : `Concept ↔ identifiant code / clé i18n ↔ libellé FR`.

Les termes de comportement empruntent la **terminologie des contrôleurs MIDI / MPC** (One-Shot, Gate, Loop, Mono, Poly).

> ⚠️ **Mot banni : « couper ».** Réservé à la future fonction **« découper »** (rognage de sample, v2). Partout ailleurs on dit **« stopper »** / **« arrêter »**.

| Concept | Code / clé i18n | Libellé FR | Définition |
|---|---|---|---|
| Le produit | `sampleboard` | Sampleboard | Application de pads déclencheurs de sons (façon soundboard). **Pas un sampler** : volontairement simple. |
| Banque | `Bank` | banque | La configuration complète (toutes les pages + pads). **Une seule en v1** ; multi-banques en v2. |
| Page | `Page` | page | Un écran contenant une grille de pads. |
| Pad | `Pad` | pad | La case cliquable qui déclenche un sample. |
| Grille | `grid` (`rows`×`cols`) | grille | Disposition en lignes × colonnes des pads d'une page. |
| Sample | `Sample` | sample | Un fichier audio importé (ré-encodé en Opus). |
| Bibliothèque | `Library` | bibliothèque | La collection de samples, gérée à part (CRUD). |
| Pool | `pool` | pool | Liste de travail de samples (session), outil d'Édition : sidebar en large, tiroir gauche en étroit. Élément touché = armé (assignation à la volée) ; glissable sur un pad. |
| Mode de lecture | `PlayMode` | Mode de lecture | Le comportement de déclenchement d'un pad. |
| → One-Shot | `'oneShot'` | One-Shot | Tap → joue le sample **en entier** ; re-tap → relance depuis 0. |
| → Gate | `'gate'` | Gate | Joue **tant que le pad est maintenu** ; stop au relâchement. |
| → Loop | `'loop'` | Loop | Tap → **boucle** ; re-tap → arrête. |
| Polyphonie | `voiceMode` | Polyphonie | Réglage **de page** : voix superposées ou non. |
| → Mono | `'mono'` | Mono | Une seule voix à la fois sur la page. |
| → Poly | `'poly'` | Poly | Superposition des voix. |
| Voix | `Voice` | voix | Une instance de son **en train de jouer**. |
| Gain | `gainDb` | gain | Niveau **par pad**, en dB `[-60, +6]`, `0` = niveau d'origine. |
| Réglages | `Settings` | Réglages | Les paramètres globaux de l'app. |
| Arrière-plan | `backgroundBehavior` | Arrière-plan | Réglage : que faire quand l'app passe en arrière-plan. |
| → Tout stopper | `'stopAll'` | Tout stopper | Suspend l'audio + arrête toutes les voix (défaut). |
| → Stopper les sons en cours | `'stopSustained'` | Stopper les sons en cours | Arrête Gate & Loop ; laisse finir les One-Shot. |
| → Laisser jouer | `'keepPlaying'` | Laisser jouer | L'audio continue en arrière-plan. |
| Nombre maximum de voix | `maxVoices` | Nombre maximum de voix | Plafond global de voix simultanées (défaut 8 ; dépassement = FIFO). |
| Édition | `editMode` | Édition | État où l'on **configure** (CRUD, gain, assignation…). |
| Jeu | `editMode` = off | Jeu | État où l'on **joue** (la grille déclenche les sons). |
| introuvable | `missing` | introuvable | Pad dont le sample a disparu (supprimé / fichier manquant). |
| vide | `empty` | vide | Pad sans aucun sample assigné. |
| actif | `active` | actif | Pad **en train de jouer** (indicateur visuel). |
| assigner | `assign` | assigner | Rattacher un sample à un pad. |
| importer | `import` | importer | Faire entrer un fichier audio dans la bibliothèque. |
| pré-écoute | `preview` | pré-écoute | Écouter un sample dans la bibliothèque avant de l'assigner. |
| Barre du haut | `Topbar` | barre du haut | Infos de la page active (nom, Polyphonie, grille) ; tap → tiroir page. |
| Barre d'actions | `Bottombar` | barre d'actions | Actions principales + pages + accès Réglages (bas d'écran). |
| Tiroir | `Drawer` | tiroir | Panneau contextuel à droite : réglages du pad, de la page ou généraux. |
| Stop général | `stopAllVoices` | Stop général | Arrête toutes les voix d'un tap (bouton panique de la barre d'actions). |
| Tag | `Tag` | tag | Étiquette libre affectée aux samples (n-à-n) ; filtre la bibliothèque. |
| → Non classé | `'untagged'` | Non classé | **Filtre virtuel** : les samples sans aucun tag (jamais stocké). |
| Import multiple | `importBatch` / `BatchImport` | import multiple | Import séquentiel d'un **lot** de fichiers et/ou d'archives, suivi dans une modale de progression. |
| Archive | `archive` (`zip`, `rar`) | archive | Conteneur zip/rar déplié à l'import : ses fichiers audio rejoignent le lot. |

---

## 1. Objectif

**Sampleboard** : une grille de **pads** déclenche des bruitages et répliques audio, organisés en **pages**. L'utilisateur **importe ses propres fichiers audio** (qui alimentent la **bibliothèque**) et configure ses pads. Cible de distribution : **F-Droid** (Android).

C'est un **board de samples** (façon soundboard), **pas un sampler** : pas de DSP, pas d'édition audio poussée, gestion des voix volontairement minimale.

## 2. Portée

### Dans le périmètre v1
- Pages multiples, navigation entre pages.
- **Grille** de pads par page : **4×4 par défaut, redimensionnable par page** (cols 1–6 × lignes 1–12), déclenchement audio faible latence.
- Trois **Modes de lecture** de pad : One-Shot, Gate, Loop.
- **Polyphonie** par page : Mono (une voix à la fois) ou Poly (superposition).
- **Bibliothèque** de samples : fichiers audio importés, gérée séparément (CRUD propre) ; les pads s'y rattachent par référence.
- Mode **Édition** complet : CRUD pads et pages, assignation d'un sample, gain par pad (**en dB**).
- **Import** de fichiers audio depuis le stockage de l'appareil, avec **ré-encodage Opus** (voir §13).
- **Réglages** globaux (Arrière-plan, Nombre maximum de voix, langue), persistés.
- **Interface multilingue (i18n)**, **français par défaut**.
- Persistance locale fiable (config + bibliothèque de fichiers audio), rechargée au démarrage.

### Hors périmètre (v1) — voir §17
Multi-banques, raccourcis clavier, enregistrement, effets/DSP, MIDI, synchro cloud,
**accès réseau / import par URL** (v1 hors-ligne, voir §16), iOS.
_(« Découper » — rognage start/end — et waveform : **rapatriés en v1** le 2026-07-02,
jalon dédié « Éditeur audio », voir §16 et roadmap.)_

### Contenu
L'application est livrée **vide** : aucun extrait audio n'est embarqué. Les répliques et bruitages sont fournis par l'utilisateur via import. Aucun contenu sous droit d'auteur n'est distribué avec l'app (contrainte produit **et** contrainte F-Droid).

## 3. Cible & contraintes

| Élément | Choix |
|---|---|
| Frontend | Svelte 5 (runes) + Vite, en **SPA** (`adapter-static`, SSR désactivé) |
| Langage | TypeScript, mode `strict` |
| Empaquetage | **Tauri v2** (WebView système + noyau Rust) |
| Persistance | **SQLite natif** via `tauri-plugin-sql` |
| Fichiers | `tauri-plugin-fs` + `tauri-plugin-dialog` pour l'import |
| Audio | **Web Audio API** ; encodage Opus via **WASM libopus** embarqué |
| i18n | **Traductions en JSON** par langue (`fr.json` défaut & fallback) ; le code ne porte **que des clés** (tokens), zéro texte en dur |
| Distribution | F-Droid (APK) |

**Contraintes F-Droid** (structurantes, à respecter dès le départ — voir §15) : 100 % FOSS, aucune dépendance Google (Firebase/Play Services), aucun tracker ni pub, build reproductible, licence libre.

**Note dev** : le développement se fait via `tauri dev` (frontend web dans la WebView native), et **non** dans un onglet de navigateur nu — c'est ce qui donne accès à SQLite natif pendant le dev. Le Rust reste cantonné à la coquille et aux plugins ; aucune logique métier en Rust.

## 4. Principes d'architecture

**Règle de dépendance (sens unique)** :

```
domain  ←  engine, storage  ←  app  ←  ui
```

Le domaine ne connaît rien. Le moteur audio et la persistance ne connaissent que le domaine. La couche `app` orchestre. L'`ui` ne fait que rendre l'état et émettre des intentions. **Le cœur (`domain`, `engine`, `storage`) ne dépend jamais de Svelte** et reste testable isolément.

Règles transverses :
- **Une responsabilité = un module** clairement nommé. Pas d'abstraction décorative (pas d'event-bus maison, pas d'interfaces sans seconde implémentation, pas de routeur).
- **Flux unidirectionnel** : `UI → intention → commande → (mutation store + appel engine + persistance)`.
- **Mutation d'état en un seul endroit** : la couche de commandes. Les composants ne mutent jamais le store directement.
- **Concerns transverses centralisés** : la gestion des interactions pad (un module unique) et la persistance (un abonné débouncé unique).
- **Injection de dépendances explicite** via une composition root ; pas de singletons importés à la volée.

## 5. Arborescence

```
sampleboard/
├─ src/
│  ├─ domain/            # TS pur, zéro dépendance
│  │  ├─ types.ts        # Bank, Page, Pad, Sample, Settings
│  │  ├─ enums.ts        # PlayMode, VoiceMode, BackgroundBehavior
│  │  └─ invariants.ts   # validations pures
│  ├─ engine/            # TS pur (Web Audio)
│  │  ├─ audio-engine.ts # AudioContext, cache buffers, gestion des voix (FIFO)
│  │  ├─ voice.ts        # représentation d'une voix active
│  │  ├─ encoder.ts      # ré-encodage Opus (WASM libopus)
│  │  └─ types.ts        # EngineEvents, callbacks
│  ├─ storage/           # TS pur (accès données)
│  │  ├─ db.ts           # wrapper tauri-plugin-sql + migrations
│  │  ├─ bank-repository.ts
│  │  ├─ sample-repository.ts   # bibliothèque : fichiers sur disque + métadonnées
│  │  ├─ settings-repository.ts # réglages globaux (ligne unique)
│  │  └─ types.ts
│  ├─ app/               # orchestration
│  │  ├─ store.svelte.ts # état réactif (runes) — source de vérité config + UI
│  │  ├─ commands.ts     # seul point de mutation ; coordonne store/engine/storage
│  │  ├─ persistence.ts  # coordinateur autosave débouncé (abonné unique)
│  │  └─ create-app.ts   # composition root
│  ├─ ui/
│  │  ├─ i18n/           # traductions JSON : fr.json (défaut), en.json… + index.ts (loader + t())
│  │  ├─ interaction/pad-input.ts   # module unique pointer→intention
│  │  ├─ components/
│  │  │  ├─ PadGrid.svelte
│  │  │  ├─ Pad.svelte
│  │  │  ├─ PageTabs.svelte
│  │  │  ├─ Editor.svelte
│  │  │  ├─ Library.svelte     # gestionnaire de la bibliothèque
│  │  │  ├─ Settings.svelte    # réglages globaux
│  │  │  └─ ...
│  │  └─ styles/
│  ├─ main.ts            # bootstrap : create-app + montage Svelte
│  └─ app.css
├─ src-tauri/            # coquille Tauri v2 (Rust minimal + config plugins)
├─ static/
├─ svelte.config.js      # adapter-static, SSR off
├─ vite.config.ts
├─ tsconfig.json         # strict
├─ LICENSE               # GPL-3.0-or-later (voir §15)
└─ README.md
```

## 6. Modèle de domaine

```ts
// enums.ts
export type PlayMode = 'oneShot' | 'gate' | 'loop';        // Mode de lecture du pad
export type VoiceMode = 'mono' | 'poly';                   // Polyphonie de la page
// Arrière-plan : tout stopper / seulement les sons en cours (Gate+Loop) / laisser jouer
export type BackgroundBehavior = 'stopAll' | 'stopSustained' | 'keepPlaying';

// types.ts
export interface Pad {
  id: string;
  pageId: string;
  name: string;
  sampleId: string | null;  // référence un Sample de la bibliothèque ; null = pad vide
  playMode: PlayMode;       // défaut: 'oneShot'
  gainDb: number;           // dB, défaut 0.0 (niveau d'origine) ; plage [-60, +6], -60 = muet
  position: number;         // index dans la grille : 0 .. rows*cols-1
}

export interface Page {
  id: string;
  name: string;
  voiceMode: VoiceMode;     // Polyphonie ; défaut: 'poly'
  rows: number;             // défaut: 4  (plage 1..12)
  cols: number;             // défaut: 4  (plage 1..6)
  position: number;
}

// Un sample de la bibliothèque : entité gérée indépendamment des pads (CRUD propre).
// Un Sample peut exister sans être rattaché à aucun pad.
export interface Sample {
  id: string;
  label: string;            // nom affiché, éditable ; défaut = nom de fichier d'origine
  fileName: string;         // nom sur disque ({sampleId}.ogg)
  originalName: string;
  mime: string;             // 'audio/ogg' après ré-encodage
  sizeBytes: number;
  durationMs: number | null;
  createdAt: number;
}

// Réglages globaux (app-level, hors banque).
export interface Settings {
  backgroundBehavior: BackgroundBehavior; // défaut: 'stopAll'
  maxVoices: number;                       // Nombre maximum de voix, défaut 8
  locale: string;                          // langue UI, défaut 'fr'
}

export interface Bank {
  id: string;
  name: string;
  pages: Page[];
  pads: Pad[];              // aplati ; regroupé par pageId à la lecture
  // La bibliothèque n'est PAS incluse ici : c'est une collection partagée,
  // chargée à part (voir §8).
}
```

**Invariants** (dans `invariants.ts`, purs, testables) :
- `gainDb ∈ [-60, +6]`.
- `cols ∈ [1, 6]`, `rows ∈ [1, 12]` ; `position ∈ [0, rows*cols-1]` et unique dans la page.
- Réduire la grille sous une `position` occupée est refusé tant que le pad concerné n'est pas déplacé/supprimé (voir §12).
- `position` des pages : unique et contigu dans la banque.
- Un `Pad.sampleId` non nul référence un `Sample` existant ; sinon le pad est *introuvable* (état affiché, non bloquant — voir §12).
- Une banque a au moins une page.

## 7. Moteur audio (`engine`)

Responsabilité unique : produire du son à faible latence et gérer les voix. **Autoritatif** sur l'état de jeu éphémère (quelles voix jouent) ; il ne le duplique pas dans le store, il le *notifie* (voir §9, décision B).

### Contrat public (esquisse)
```ts
class AudioEngine {
  resume(): Promise<void>;                 // à appeler sur 1er geste utilisateur
  load(sampleId: string, bytes: ArrayBuffer): Promise<void>; // décode + cache
  unload(sampleId: string): void;

  oneShot(pad: Pad, page: Page): void;     // Mode One-Shot
  press(pad: Pad, page: Page): void;       // Gate — début (gate on)
  release(pad: Pad): void;                 // Gate — fin (gate off)
  toggleLoop(pad: Pad, page: Page): void;  // Loop — start/stop
  stopPad(padId: string): void;
  stopPage(pageId: string): void;

  onPlayingChanged(cb: (activePadIds: Set<string>) => void): void;
}
```

### Détails d'implémentation
- **AudioContext** : créé/repris sur le premier geste (politique autoplay mobile). `resume()` idempotent, rappelé aussi au retour de veille Android (voir §12).
- **Buffers** : décodés une fois, mis en cache par `sampleId` (`Map<string, AudioBuffer>`).
- **Voix** : chaque lecture crée un `AudioBufferSourceNode` (jetable) → `GainNode` par voix → destination. Le `GainNode` applique l'amplitude linéaire dérivée de `pad.gainDb` (`amp = gainDb <= -60 ? 0 : 10^(gainDb/20)`). Une voix = `{ padId, source, gain, startedAt }`.
- **Anti-clic** : rampe linéaire de gain courte (~8 ms) à l'arrêt de toute voix (Gate, Loop, choke Mono).
- **Re-déclenchement (self)** : re-jouer un pad arrête d'abord sa propre voix — jamais deux copies simultanées du même pad.
- **Choke Mono** : sur une page Mono, démarrer un pad arrête toutes les autres voix de **cette page**.
- **Nombre maximum de voix** : plafond global lu depuis `Settings.maxVoices` ; au dépassement, la voix **la plus ancienne** est retirée (**FIFO**, fade court). Gestion purement interne, non exposée.

### Matrice de comportement

| | One-Shot | Gate | Loop |
|---|---|---|---|
| **Action** | tap → joue 1 fois | appui maintenu → joue tant que tenu | tap → boucle ; re-tap → stop |
| **Re-tap même pad** | redémarre à 0 | (géré par press/release) | bascule stop |
| **Relâchement** | — | stop (fade court) | — |
| **Page Poly** | superposition avec autres pads | idem | idem |
| **Page Mono** | stoppe les autres voix de la page | stoppe les autres voix de la page | garde la voix unique jusqu'à autre pad ou re-tap |

## 8. Persistance (`storage`)

**Tout accès aux données passe par cette couche.** Aucun composant ne touche `tauri-plugin-sql` ni le système de fichiers directement.

### Trois dépôts
- **`BankRepository`** : config sérialisable (banque, pages, pads) en SQLite.
- **`SampleRepository`** (bibliothèque) : gère la collection de samples. Les **octets audio sont stockés comme fichiers** dans le répertoire de données de l'app (`{appDataDir}/audio/{sampleId}.ogg` — tout est ré-encodé en OGG/Opus à l'import, voir §13), **jamais en colonnes `BLOB`**. La table `samples` ne stocke que les métadonnées + le nom de fichier. CRUD indépendant des pads.
- **`SettingsRepository`** : réglages globaux (ligne unique dans `settings`).

### Schéma SQLite
```sql
PRAGMA user_version = 1;   -- versionnage pour migrations

CREATE TABLE bank (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL
);

CREATE TABLE pages (
  id          TEXT PRIMARY KEY,
  bank_id     TEXT NOT NULL REFERENCES bank(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  voice_mode  TEXT NOT NULL CHECK (voice_mode IN ('mono','poly')),
  rows        INTEGER NOT NULL DEFAULT 4 CHECK (rows BETWEEN 1 AND 12),
  cols        INTEGER NOT NULL DEFAULT 4 CHECK (cols BETWEEN 1 AND 6),
  position    INTEGER NOT NULL
);

-- La bibliothèque : collection partagée, indépendante des pads.
CREATE TABLE samples (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,        -- nom affiché, éditable
  file_name     TEXT NOT NULL,        -- nom sur disque
  original_name TEXT NOT NULL,
  mime          TEXT NOT NULL,        -- 'audio/ogg'
  size_bytes    INTEGER NOT NULL,
  duration_ms   INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE TABLE pads (
  id          TEXT PRIMARY KEY,
  page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sample_id   TEXT REFERENCES samples(id) ON DELETE SET NULL,
  play_mode   TEXT NOT NULL CHECK (play_mode IN ('oneShot','gate','loop')),
  gain_db     REAL NOT NULL DEFAULT 0.0 CHECK (gain_db BETWEEN -60 AND 6),
  position    INTEGER NOT NULL
);

-- Réglages globaux : ligne unique (id = 0).
CREATE TABLE settings (
  id                  INTEGER PRIMARY KEY CHECK (id = 0),
  background_behavior TEXT NOT NULL DEFAULT 'stopAll'
                        CHECK (background_behavior IN ('stopAll','stopSustained','keepPlaying')),
  max_voices          INTEGER NOT NULL DEFAULT 8 CHECK (max_voices >= 1),
  locale              TEXT NOT NULL DEFAULT 'fr'
);
```

### Migrations
Wrapper `db.ts` applique les migrations en séquence selon `user_version`. Chaque évolution de schéma = une migration numérotée, jamais de modification destructive silencieuse.

### Gestion de la bibliothèque (décision verrouillée)
La bibliothèque est **gérée séparément** : on importe, renomme (`label`) et supprime des samples indépendamment des pads. Les pads ne font que **référencer** un sample.

Suppression d'un sample encore référencé : opération autorisée depuis le gestionnaire de bibliothèque. L'UI **avertit** du nombre de pads impactés, puis à confirmation `sample_id` de ces pads passe à `NULL` (`ON DELETE SET NULL` → pad *introuvable*, non bloquant) **et** le fichier disque est supprimé. Pas de blocage dur : la bibliothèque reste pilotable en toute circonstance.

## 9. Couche application (`app`)

### Store (`store.svelte.ts`)
Source de vérité **de la config et de l'état UI**, en runes Svelte 5 (`$state` / `$derived`) :
- arbre banque (pages, pads) ;
- `samples: Sample[]` — la bibliothèque chargée ;
- `settings: Settings` ;
- `activePageId`, `editMode` ;
- `activePadIds: Set<string>` — **reflet** minimal de l'engine, jamais calculé côté store.

### Couche de commandes (`commands.ts`) — seul point de mutation
Chaque commande coordonne, de façon atomique, store + engine + persistance. Liste :

- **Pages** : `addPage`, `renamePage`, `deletePage`, `setPageVoiceMode`, `setPageGrid(rows, cols)`, `reorderPages`, `selectPage`.
- **Pads** : `addPad`, `renamePad`, `setPadPlayMode`, `setPadGainDb`, `assignSample(padId, sampleId | null)`, `deletePad`, `reorderPads`.
- **Bibliothèque** : `importSample(file) → sampleId`, `renameSample(sampleId, label)`, `deleteSample(sampleId)`.
- **Jeu** : `firePad` (One-Shot), `pressPad` / `releasePad` (Gate), `toggleLoopPad` (Loop), `stopPad`, `stopPage`.
- **Réglages** : `setBackgroundBehavior`, `setMaxVoices`, `setLocale`.
- **App** : `toggleEditMode`.

### Coordinateur de persistance (`persistence.ts`)
- **Décision A (verrouillée) : autosave débouncé.** Un abonné réactif **unique** persiste la config (~300–500 ms de debounce) quand l'arbre change. Aucun `save()` dispersé dans l'UI.
- L'import écrit immédiatement (fichier ré-encodé + ligne `samples`), hors debounce.
- Les **Réglages** (peu fréquents) sont persistés immédiatement à chaque changement, hors debounce.

### Décision B (verrouillée) : état de jeu non dupliqué
L'engine est autoritatif sur les voix actives ; le store n'en reflète que `activePadIds` via `onPlayingChanged`. Aucune logique de jeu dans le store.

## 10. Gestion des interactions (`ui/interaction/pad-input.ts`)

**Module unique** mappant les Pointer Events vers les intentions, selon le **Mode de lecture** du pad. Centralisé pour ne pas dupliquer/oublier la gestion du gate.

- **Pointer Events** uniquement (souris + tactile unifiés) ; `preventDefault` pour éviter les événements souris synthétiques et le double-déclenchement.
- **One-Shot** : `pointerdown` → `firePad`.
- **Gate** : `pointerdown` → `pressPad` (+ `setPointerCapture`) ; `pointerup` / `pointercancel` → `releasePad`. La capture garantit le `release` même si le doigt sort du pad.
- **Loop** : `pointerdown` → `toggleLoopPad` (stop si en cours, sinon start).
- Garde contre les événements fantômes (un seul chemin d'entrée par geste).

## 11. UI / composants

Composants **« bêtes »** : ils rendent l'état et émettent des intentions. Aucune logique audio ni DB. Tout texte visible passe par `t(clé)` (i18n, §3).

**Agencement (décision 2026-07-02, v1)** — mobile-first, la grille au centre de l'écran :
- **`Topbar`** (barre du haut) — infos de la page active : nom/numéro, Polyphonie, dimensions
  de grille. **Tap → tiroir page** (dans les deux modes).
- **`Bottombar`** (barre d'actions, bas d'écran) — bascule **Jeu ↔ Édition**, **Stop général**
  (`stopAllVoices`, panique), **pages** (onglets défilables + ajout en Édition), **Import
  rapide** (sélecteur de fichier direct), **Bibliothèque** (ouvre le panneau), **Réglages**
  (tiroir réglages généraux).
- **`Drawer`** (tiroir contextuel, à droite, avec voile) — trois contenus : `PadSettings`
  (renommage, Mode de lecture, gain **dB**, assignation depuis la bibliothèque, suppression),
  `PageSettings` (renommage, Polyphonie, grille `rows`×`cols`, ordre, suppression), `Settings`
  (réglages globaux : Arrière-plan, Nombre maximum de voix, langue). Fermeture : ✕ ou tap hors.
  **Tiroir pad : Édition seulement** (en Jeu, un tap sur un pad joue — zéro faux geste) ;
  la création d'un pad (case « + », Édition) ouvre son tiroir.
- **`LibraryPanel`** — bibliothèque en **panneau plein écran** : import, renommage (`label`),
  suppression (avec avertissement des pads impactés), **pré-écoute** (contenu `Library`).
- `PadGrid` / `Pad` — grille `rows`×`cols`, état *actif / introuvable / vide*, branchement sur
  `pad-input` (Jeu) ; en Édition, tap → tiroir pad.
- Indicateur visuel **actif** piloté par `activePadIds`.

L'état d'ouverture du tiroir (`drawer`) vit dans le store (état UI, §9) et n'est muté que par
les commandes. La **vue de `<main>`** (`view` : board ↔ bibliothèque) est une **projection de
l'URL** (#23, §16) : seul `applyRoute` l'écrit, la navigation passe par des écritures d'URL.

## 12. Cas limites & décisions de robustesse

- **AudioContext suspendu** (retour de veille Android, politique autoplay) → `resume()` sur le prochain geste ; l'engine expose son état.
- **Sample introuvable** (fichier supprimé hors app) → pad marqué *introuvable*, affiché comme tel, ne crashe pas ; le déclenchement est un no-op silencieux.
- **Suppression d'une page** avec voix actives → `stopPage` d'abord, puis suppression.
- **Import corrompu / format non décodable** → rejet avec message, aucune ligne créée.
- **Gain** : échelle en **dB** (`[-60, +6]`, `0` = niveau d'origine, `-60` = muet), convertie en amplitude par l'engine.
- **Redimensionnement de grille** : réduire `rows`/`cols` sous une position occupée est refusé (message) tant que le pad concerné n'est pas vidé/déplacé.
- **Arrière-plan Android** (pause) : piloté par `Settings.backgroundBehavior`. Défaut `stopAll` = suspension de l'AudioContext + arrêt de toutes les voix ; `stopSustained` = arrête seulement Gate/Loop ; `keepPlaying` = laisse filer (usage ambiance continue).

## 13. Import & compression audio

**Principe : on ne stocke jamais l'original tel quel.** Tout sample importé est décodé puis **ré-encodé en OGG/Opus** avant écriture dans la bibliothèque. On évite ainsi de traîner des WAV/AIFF volumineux ; l'app ne conserve qu'un format compact et libre.

### Pipeline d'import
1. `tauri-plugin-dialog` → sélection fichier(s). Formats **acceptés en entrée** : tout ce que la WebView sait décoder (wav, aif/aiff, mp3, ogg, m4a/aac, flac…).
2. Lecture des octets via `tauri-plugin-fs` ; validation **taille max 20 Mo** (avant décodage, sur le fichier source) ; `decodeAudioData` → PCM (sert aussi à valider et extraire `durationMs`). Fichier trop lourd ou non décodable → rejet, aucune ligne créée.
3. **Ré-encodage en OGG/Opus** — codec **Opus** (excellent pour voix/bruitages à faible débit et 100 % FOSS), débit fixe **96 kbps**. Mono conservé si la source est mono.
4. Écriture du seul fichier compressé `{appDataDir}/audio/{sampleId}.ogg` + insertion `samples` (`mime = audio/ogg`). L'original n'est pas conservé.

### Encodeur (décision : WASM embarqué)
Le ré-encodage se fait **côté frontend** (règle « pas de logique métier en Rust »). Choix retenu pour la **portabilité maximale** : un **encodeur WASM FOSS embarqué** (libopus + conteneur ogg), indépendant de la version de l'Android System WebView. Comportement identique sur tous les appareils, aucune dépendance à une API navigateur optionnelle. WebCodecs `AudioEncoder` pourra servir de chemin accéléré **opportuniste** s'il est disponible, mais le WASM reste le socle de référence.

## 14. Flux de données (résumé)

```
[UI Pad]  --pointer-->  [pad-input]  --intention-->  [command]
                                                        │
                    ┌───────────────────────────────────┼───────────────────────────┐
                    ▼                                   ▼                             ▼
              [store mutation]                    [engine call]              [persistence (débouncé)]
                    │                                   │
                    └──────── activePadIds ◄────────────┘  (engine notifie, store reflète)
```

## 15. Contraintes F-Droid & build

- **Licence : `GPL-3.0-or-later`** — copyleft fort, la plus répandue et la mieux adaptée à l'écosystème F-Droid (compatible avec la dépendance libopus/ogg). Fichier `LICENSE` + en-têtes SPDX (`SPDX-License-Identifier: GPL-3.0-or-later`).
- **Aucune dépendance Google** (Firebase, Play Services), aucun tracker, aucune pub, aucun compte requis.
- **Build reproductible** : versions de toolchain épinglées, build déterministe ; Tauri v2 (WebView système, pas de dépendances Google par défaut) est adapté, contrairement à Capacitor qui traîne des dépendances propriétaires.
- **Aucun contenu sous droits** embarqué (l'app est livrée sans audio).
- Métadonnées F-Droid (structure fastlane : descriptions, captures, changelog) — à préparer au jalon d'empaquetage.
- Audit des dépendances (plugins Tauri `sql`/`fs`/`dialog`, encodeur WASM libopus) : tous FOSS ; vérifier qu'aucune transitive propriétaire n'entre côté Android.

## 16. Décisions verrouillées

- **Vocabulaire** : voir le **Glossaire** en tête (source de vérité). Termes de comportement en terminologie contrôleur MIDI.
- **i18n** : app multilingue, **FR par défaut** ; libellés en fichiers de langue, code/schéma en anglais.
- **Gain** : échelle **dB** `[-60, +6]`, `0` = niveau d'origine, conversion → amplitude par l'engine.
- **Bibliothèque** : gérée à part (CRUD) ; supprimer un sample référencé rend les pads *introuvables* (avertissement + confirmation), jamais de blocage dur.
- **Arrière-plan** : réglable via `Settings.backgroundBehavior`, défaut **Tout stopper** (`stopAll`).
- **Grille** : `4×4` par défaut, **redimensionnable par page**, bornée `cols ∈ [1,6]` × `rows ∈ [1,12]` (élargie 2026-07-02, migration 3).
- **Compression à l'import** : ré-encodage systématique en **OGG/Opus à 96 kbps** ; WAV/AIFF non conservés (Vorbis abandonné).
- **Encodeur** : **WASM libopus embarqué** (portabilité max) ; WebCodecs en accélération opportuniste seulement.
- **Licence** : **`GPL-3.0-or-later`**.
- **Multi-banques** : **v1 mono-banque** (une ligne `bank`) ; schéma déjà prêt pour du multi, renvoyé en v2.
- **Nombre maximum de voix** : défaut **8** ; dépassement géré en **FIFO**, interne, non exposé.
- **Taille max d'import** : **20 Mo** (sur le fichier source, avant décodage).
- **Réseau** : **v1 100 % hors-ligne** — aucun accès réseau, aucune permission réseau Android (renforce la contrainte F-Droid §15, cohérent avec le côté offline-first « l'utilisateur importe ses fichiers »). L'import par URL (accès réseau, autorisation à la volée) est renvoyé en **v2**.
- **Agencement UI v1** (2026-07-02) : **Topbar** (infos page → tiroir page) + **Bottombar**
  (Jeu/Édition, Stop général, pages, Import rapide, Bibliothèque, Réglages) + **Drawer** droit
  (pad — Édition seulement —, page, réglages) + **Bibliothèque en panneau plein écran**. Voir §11.
- **Board complet à la création** (2026-07-02) : une page naît avec sa **grille remplie de
  pads** (une case = un pad) et **chaque pad et chaque page a une couleur dès l'init**
  (palette **OKLCH**, cycle par position/rang — `BankFactory`). Jamais de page vierge ni de
  pad sans couleur. Style pad : **contour plein + fond teinté en transparence**.
- **Style de code** (2026-07-02) : **orienté objet** pour services et fabriques à état
  (classes + injection par constructeur) ; **DRY / SOLID / SoC impératifs** ; une seule
  représentation de l'absence (`T | null`, jamais optionnel + nullable) ; typage strict via
  les unions nommées du domaine.
- **Unités CSS** (2026-07-02) : **jamais de `px`** hors épaisseurs de trait (bordures,
  filets ≤ 3px) — dimensions, espacements, rayons, ombres en **rem** (ou unités
  viewport/%) ; pilules en `999rem`.
- **Pool** (2026-07-02) : le conteneur intermédiaire réservé est débloqué en v1 — **liste
  de travail de session** (non persistée) alimentée depuis la bibliothèque ;
  toucher un élément l'ARME (assignation à la volée), le pool reste affiché pendant qu'on
  touche les pads. La gestion des tags vit dans une modale standard « Gérer les tags »
  (en-tête du panneau Bibliothèque).
- **Pool revu** (2026-07-04, #18) : outil d'**Édition exclusivement**. **Sidebar
  systématique** en flux sur écran large (≥ 48 rem — ni bouton, ni fermeture) ; **tiroir
  gauche** à bouton (bottombar) sur écran étroit, flottant aussi au-dessus de la
  bibliothèque ouverte (`--z-pool`) pour le dépôt. **Glisser-déposer** : ligne de
  bibliothèque → pool, élément du pool → pad (assignation immédiate) — type MIME partagé
  `application/x-sampleboard-sample` (`ui/interaction/sample-dnd.ts`) ; raccourci
  pointeur, le flux tactile « armer puis toucher » reste le chemin mobile. En-tête :
  **Ajouter** (ouvre la bibliothèque) + **Vider** (`clearPool`). Curseur **main**
  (`grab`/`grabbing`) sur les éléments glissables.
- **Cartes de bibliothèque : waveform + progression** (2026-07-04, #19) : pics statiques
  du sample sur chaque carte (`SampleWaveform`, tracé partagé `drawPeakBars` avec le pad) ;
  pendant la pré-écoute, la partie jouée se remplit (`engine.previewProgress()`). rAF
  seulement pendant la pré-écoute de la carte concernée.
- **Gestion des tags → tiroir droit** (2026-07-04, #20) : la modale « Gérer les tags »
  devient une vue du **tiroir contextuel** (`TagSettings`, `drawer = 'tags'`,
  `openTagsDrawer`) — la liste se met à jour derrière, en direct.
- **Bibliothèque = VUE du layout** (2026-07-04, #22 — supersède « panneau plein écran »
  §11/M6) : `libraryOpen` bascule le contenu de `<main>` (grille ↔ bibliothèque), topbar
  (titre « Bibliothèque » à la place du contexte de page ; visualiseur et Stop restent)
  et bottombar demeurent. Ceci supprime les surcouches spéciales : plus de `--z-panel`,
  le pool n'a plus à flotter au-dessus de la bibliothèque (sidebar en flux à côté,
  `--z-pool: 19` réservé au tiroir étroit), le tiroir contextuel revient à
  `--z-drawer: 20`.
- **Navigation pilotée par l'URL** (2026-07-04, backlog #23 — livrée le jour même) :
  l'affichage de la vue courante est une **projection de l'URL**, jamais une variable d'état
  indépendante (`store.view` remplace le booléen `libraryOpen`, conservé en lecture dérivée).
  Quatre éléments :
  table `identifiant de vue → composant` (structure de données, pas de branchements), fonction
  de résolution URL → composant avec **cas par défaut** (board), rendu dynamique du composant
  résolu, synchronisation bidirectionnelle (URL → affichage à l'init/`hashchange`/retour-avance ;
  affichage → URL par écriture d'URL uniquement, jamais de mutation directe). Paramètres fixés :
  **encodage fragment (`#`)** — le protocole d'assets Tauri ne fait pas de fallback `index.html`,
  le fragment fonctionne à l'identique en `tauri dev` et en APK — **avec gestion d'historique
  délibérée** : pile cohérente pour le geste retour Android/tactile (push pour une navigation
  réelle, `replace` pour les redirections par défaut et corrections d'URL) ; **cardinalité
  vue + paramètres** (ex. `#/library?tag=…`), la fonction de résolution porte le décodage des
  paramètres variables. Implémentation : `app/navigation.ts` (résolution pure) +
  `app/router.ts` (`createHashRouter`, profondeur marquée dans `history.state` — le ✕ et le
  geste retour dépilent la même entrée ; `createLoopbackRouter` par défaut hors navigateur),
  table vue → composant et rendu dynamique dans `App.svelte`. Un paramètre de filtre
  **périmé** (tag disparu) retombe sur « Tous », URL corrigée par `replace` — jamais de
  filtre fantôme qui vide la bibliothèque. : étiquettes **n-à-n** (`tags` +
  `sample_tags`, migration 4), personnalisables (CRUD) ; liste par défaut semée au premier
  lancement (SFX, Répliques, Jingle, Musique, Ambiance, Voix, Réaction, Meme, Alerte —
  libellés i18n injectés à la création). **« Non classé » = filtre virtuel** (samples sans
  tag), jamais stocké. Filtre en bibliothèque + recherche/filtre dans la modale de choix de
  sample ; assignation page→pad directe depuis la bibliothèque.
- **« Découper » rapatrié en v1** (2026-07-02, tri backlog #4/#5) : **éditeur audio** en vue
  dédiée plein écran — waveform + rognage **start/end** avant encodage (à l'import et depuis
  la bibliothèque), **undo/redo**, pré-écoute de la sélection. Le rognage s'applique au PCM
  décodé AVANT l'encodage Opus (le fichier stocké est déjà rogné). Empilement : modale/vue de
  niveau 2 (au-dessus de la modale d'import, top-layer natif). Le mot « couper » reste banni
  du reste de l'UI (« stopper »).
- **Import multiple & archives** (2026-07-02) : les inputs d'import acceptent la **sélection
  multifichier** et les **archives zip/rar**. UN fichier audio → éditeur audio (flux M7
  inchangé) ; plusieurs fichiers ou une archive → **lot direct** sans éditeur (le rognage
  reste possible après coup via « Découper »), suivi dans la **modale d'import**
  (barre globale, statut par fichier, interruption). Le bouton d'import de la bottombar
  **ouvre cette modale** (choix des fichiers puis progression au même endroit) ; l'input
  de la bibliothèque reste un accès direct au sélecteur. Archives dépliées via **libarchive
  compilé en WASM** (`libarchive.js`, MIT ; libarchive, BSD — lecteurs zip + rar4/rar5
  clean-room) : le code **unrar officiel est refusé** (licence non libre, incompatible
  GPL-3.0 et bloquante F-Droid). Le worker et son `.wasm` sont servis côte à côte à chemin
  stable (plugin Vite dédié). Bornes : archive ≤ **200 Mo** (`ARCHIVE_MAX_BYTES`), chaque
  entrée reste soumise aux 20 Mo d'import ; seules les extensions audio candidates entrent
  dans le lot (le décodage reste l'arbitre final, §12). Build from-source du WASM : même
  traitement que l'encodeur opus (jalon Empaquetage).
- **Banque d'usine de référence — Freesound CC0** (2026-07-04, supersède le lot #14 de
  78 sons à provenance non tracée) : la bibliothèque d'usine devient une **banque de
  référence d'environ 25 classiques de soundboard** (buzzer, ding, ba-dum tss, roulement,
  applaudissements, rires sitcom, tada, trombone triste, cloche d'hôtel, sifflet, cowbell,
  air horn, whoosh, grillons et suspense en Loop, etc.) — « des sons de référence, pas du
  remplissage ». Provenance **exclusivement Freesound en CC0** (previews HQ OGG →
  ré-encodage Opus 96k via ffmpeg dockerisé) ; sélection automatique par réputation
  (`scripts/freesound-worklist.json` + `scripts/freesound-rebank.mjs`, clé API requise)
  puis **validation à l'écoute** ; `source` + `license` renseignés pour chaque entrée du
  manifest — le TODO licences (bloquant F-Droid) disparaît avec le lot d'origine.
- **Bus master & pré-écoute unifiée** (2026-07-03) : le graphe Web Audio a un **point de
  passage unique vers la sortie** — `master (GainNode) → destination` ; **tout ce qui sonne
  s'y raccorde** (chaînes de voix des pads, pré-écoutes), jamais à `destination` en direct.
  C'est là que se branchent gain master, limiteur ou visualiseur global (`masterWaveform`,
  analyseur en **dérivation paresseuse** : créé au premier appel, le son ne le traverse
  pas). La **pré-écoute est UN comportement** partagé (bibliothèque, modale de sample,
  éditeur audio) : **une seule à la fois** dans l'app, remplacée par la suivante, **bascule
  ▶/■** sur le bouton, et **toute autre action fait office de stop** — règle appliquée
  **mécaniquement** via la liste `PREVIEW_STOPPING_COMMANDS` (commands.ts, test générique
  dédié), l'arrière-plan stoppant la pré-écoute **quel que soit** le réglage (son de
  parcours, pas de jeu). Reflet : `store.previewingSampleId` ; mutation via `commands`
  uniquement ; le moteur ne notifie la fin que par **identité de source** (fin naturelle).
  **La pré-écoute s'affiche dans le visualiseur topbar** (#24, 2026-07-04) : onde en couleur
  accent aux côtés des ondes de voix (tap `previewWaveform` en dérivation paresseuse, même
  règle que l'analyseur master) — tout ce qui sonne sur le main out se voit.
- **Deux distributions** (2026-07-04, précisé) : **Android/F-Droid** (M9, canal primaire) et
  **web/PWA** (nouveau jalon **M10 — Distribution web**, `0.11.0`, APRÈS M9). L'**image
  Docker auto-hébergeable n'est PAS une distribution à part entière** : c'est un **mode de
  livraison** de la web/PWA sur un serveur (le même build statique, servi soi-même).
  Persistance du canal web : **IndexedDB natif** —
  implémentation web des dépôts `storage/types.ts` (banque, samples, réglages, tags + octets
  audio), la couture déjà prouvée par le mode mémoire ; le schéma SQL/SQLite reste propre à
  Tauri (pas de SQLite WASM — anti-overengineering). PWA : manifest + icônes + service
  worker offline (l'app et les samples d'usine). Livraison de la web/PWA : hébergement
  public ET/OU image Docker de serveur statique. Ceci rapatrie le « mode navigateur pur »
  de v2 (§17) en M10.
- **Ordre de validation : web d'abord, Android ensuite.** Chaque jalon est d'abord développé et validé sur **web** (dev Vite http://localhost:1420 + fenêtre `tauri dev` bureau) ; la validation sur **appareil Android réel** est un **second temps**, jamais un prérequis pour avancer. La cible finale reste F-Droid/Android (§15) — c'est l'ordre de travail qui est fixé, pas la cible.

## 17. Évolutions futures (hors v1)

**Découpe/rognage des samples** (« découper » : trim des silences, sélection d'un extrait à l'import), **multi-banques** (plusieurs banques indépendantes, bascule ; schéma déjà prêt), _(éventuel conteneur intermédiaire « pool » entre bibliothèque et banque)_, raccourcis clavier, enregistrement de samples, effets (volume master, fondu, pitch), affichage waveform, réorganisation drag-and-drop avancée, MIDI, export/import de banque (fichier portable), iOS. _(Le « mode navigateur pur » a été rapatrié en **M10 — Distribution web**, décision §16 du 2026-07-04.)_

## 18. Jalons de développement (incrémental)

Découpage vérifiable étape par étape — chaque jalon se valide avant d'empiler le suivant.

- **M0 — Socle** : scaffold Vite + Svelte 5 + TS strict + Tauri v2 (SPA static, SSR off), composition root squelette, i18n minimal (FR), lancement `tauri dev`.
- **M1 — Audio** : `AudioEngine` + un pad codé en dur qui joue un buffer importé (One-Shot). Valide Web Audio + `resume()` sur Android réel.
- **M2 — Cœur** : domaine + store + commandes + multi-pages + les 3 Modes de lecture + Polyphonie Mono/Poly. Valide la matrice §7.
- **M3 — Édition** : mode Édition complet (CRUD pads/pages, gain **dB**, Mode de lecture, grille `rows`×`cols`, assignation depuis la bibliothèque).
- **M4 — Bibliothèque & import** : `Library` (CRUD samples), import via dialog/fs + **ré-encodage OGG/Opus** à l'import, pré-écoute. Valide la chaîne décodage→encodage sur appareil réel.
- **M5 — Persistance & réglages** : schéma SQLite + repositories (banque, bibliothèque, réglages) + stockage fichiers audio + `Settings` (Arrière-plan, Nombre maximum de voix, langue) + coordinateur autosave + chargement au démarrage.
- **M6 — Empaquetage** : build Android, audit dépendances FOSS, build reproductible, licence, métadonnées F-Droid.

---
