# Sampleboard — Technical specification

> Reference document for the implementation. Meant to be picked up in Claude Code for project management and task breakdown.
> Status: spec frozen on architecture and vocabulary; all structural decisions are settled (see §16).

---

## Glossary (source of truth for vocabulary)

The product is **multilingual** (i18n). **Convention**:
- The **code and the SQLite schema are in neutral English** — stable, language-independent, and **easier to arbitrate** (less ambiguous than French).
- The code contains **no hard-coded text**: only **i18n keys (tokens)**.
- Visible labels live in **JSON translation files** (`src/ui/i18n/*.json`), **one per language**; **English (`en.json`) is the default language and the fallback** (decision 2026-07-05 — public international repo); `fr.json` is complete, switchable in Settings.

The table below is the reference: `Concept ↔ code identifier / i18n key ↔ FR label`.

Behavior terms borrow the **MIDI controller / MPC terminology** (One-Shot, Gate, Loop, Mono, Poly).

> ⚠️ **Banned word: « couper » (to cut).** Reserved for the future **« découper »** feature (sample trimming, v2). Everywhere else say **« stopper »** / **« arrêter »** (stop).

| Concept | Code / i18n key | FR label | Definition |
|---|---|---|---|
| The product | `sampleboard` | Sampleboard | Application of pads that trigger sounds (soundboard style). **Not a sampler**: deliberately simple. |
| Bank | `Bank` | banque | The complete configuration (all pages + pads). **A single one in v1**; multi-bank in v2. |
| Page | `Page` | page | A screen containing a grid of pads. |
| Pad | `Pad` | pad | The tappable cell that triggers a sample. |
| Grid | `grid` (`rows`×`cols`) | grille | Rows × columns layout of a page's pads. |
| Sample | `Sample` | sample | An imported audio file (re-encoded to Opus). |
| Library | `Library` | bibliothèque | The collection of samples, managed separately (CRUD). |
| Pool | `pool` | pool | Working list of samples (session-scoped), an Edit-mode tool: sidebar on wide screens, left drawer on narrow ones. Tapped item = armed (on-the-fly assignment); draggable onto a pad. |
| Play mode | `PlayMode` | Mode de lecture | A pad's trigger behavior. |
| → One-Shot | `'oneShot'` | One-Shot | Tap → plays the sample **in full**; re-tap → restarts from 0. |
| → Gate | `'gate'` | Gate | Plays **as long as the pad is held**; stops on release. |
| → Loop | `'loop'` | Loop | Tap → **loops**; re-tap → stops. |
| Polyphony | `voiceMode` | Polyphonie | **Page-level** setting: voices stack or not. |
| → Mono | `'mono'` | Mono | A single voice at a time on the page. |
| → Poly | `'poly'` | Poly | Voices stack. |
| Voice | `Voice` | voix | A sound instance **currently playing**. |
| Gain | `gainDb` | gain | **Per-pad** level, in dB `[-60, +6]`, `0` = original level. |
| Settings | `Settings` | Réglages | The app's global settings. |
| Background | `backgroundBehavior` | Arrière-plan | Setting: what to do when the app goes to the background. |
| → Stop everything | `'stopAll'` | Tout stopper | Suspends audio + stops all voices (default). |
| → Stop sustained sounds | `'stopSustained'` | Stopper les sons en cours | Stops Gate & Loop; lets One-Shots finish. |
| → Keep playing | `'keepPlaying'` | Laisser jouer | Audio keeps playing in the background. |
| Maximum number of voices | `maxVoices` | Nombre maximum de voix | Global cap on simultaneous voices (default 8; overflow = FIFO). |
| Edit | `editMode` | Édition | State where you **configure** (CRUD, gain, assignment…). |
| Play | `editMode` = off | Jeu | State where you **play** (the grid triggers the sounds). |
| missing | `missing` | introuvable | Pad whose sample has disappeared (deleted / missing file). |
| empty | `empty` | vide | Pad with no sample assigned. |
| active | `active` | actif | Pad **currently playing** (visual indicator). |
| assign | `assign` | assigner | Attach a sample to a pad. |
| import | `import` | importer | Bring an audio file into the library. |
| preview | `preview` | pré-écoute | Listen to a sample in the library before assigning it. |
| Top bar | `Topbar` | barre du haut | Active page info (name, Polyphony, grid); tap → page drawer. |
| Action bar | `Bottombar` | barre d'actions | Main actions + pages + Settings access (bottom of screen). |
| Drawer | `Drawer` | tiroir | Contextual panel on the right: pad, page or global settings. |
| Stop all | `stopAllVoices` | Stop général | Stops all voices in one tap (panic button in the action bar). |
| Tag | `Tag` | tag | Free-form label attached to samples (n-to-n); filters the library. |
| → Untagged | `'untagged'` | Non classé | **Virtual filter**: samples with no tag at all (never stored). |
| Batch import | `importBatch` / `BatchImport` | import multiple | Sequential import of a **batch** of files and/or archives, tracked in a progress modal. |
| Archive | `archive` (`zip`, `rar`) | archive | Zip/rar container unpacked on import: its audio files join the batch. |

---

## 1. Goal

**Sampleboard**: a grid of **pads** triggers sound effects and audio quotes, organized into **pages**. The user **imports their own audio files** (which feed the **library**) and configures their pads. Distribution target: **F-Droid** (Android).

It is a **sample board** (soundboard style), **not a sampler**: no DSP, no advanced audio editing, deliberately minimal voice management.

## 2. Scope

### In scope for v1
- Multiple pages, navigation between pages.
- Pad **grid** per page: **4×4 by default, resizable per page** (cols 1–6 × rows 1–12), low-latency audio triggering.
- Three pad **Play modes**: One-Shot, Gate, Loop.
- Per-page **Polyphony**: Mono (one voice at a time) or Poly (stacking).
- Sample **library**: imported audio files, managed separately (clean CRUD); pads attach to it by reference.
- Full **Edit** mode: pad and page CRUD, sample assignment, per-pad gain (**in dB**).
- **Import** of audio files from device storage, with **Opus re-encoding** (see §13).
- Global **Settings** (Background, Maximum number of voices, language), persisted.
- **Multilingual interface (i18n)**, **English by default** (French switchable in Settings).
- Reliable local persistence (config + audio file library), reloaded on startup.

### Out of scope (v1) — see §17
Multi-bank, keyboard shortcuts, recording, effects/DSP, MIDI, cloud sync,
**network access / URL import** (v1 is offline, see §16), iOS.
_(« Découper » — start/end trimming — and waveform: **brought back into v1** on 2026-07-02,
dedicated "Audio editor" milestone, see §16 and roadmap.)_

### Content
The application ships with a **CC0 starter bank** (25 soundboard classics from Freesound, source and license traced per entry — §16) seeded on first launch only. Everything else is supplied by the user via import. No copyrighted content is distributed with the app (a product constraint **and** an F-Droid constraint).

## 3. Target & constraints

| Element | Choice |
|---|---|
| Frontend | Svelte 5 (runes) + Vite, as an **SPA** (`adapter-static`, SSR disabled) |
| Language | TypeScript, `strict` mode |
| Packaging | **Tauri v2** (system WebView + Rust core) |
| Persistence | **Native SQLite** via `tauri-plugin-sql` |
| Files | `tauri-plugin-fs` + `tauri-plugin-dialog` for import |
| Audio | **Web Audio API**; Opus encoding via embedded **WASM libopus** |
| i18n | **JSON translations** per language (`en.json` default & fallback); the code carries **only keys** (tokens), zero hard-coded text |
| Distribution | F-Droid (APK) |

**F-Droid constraints** (structural, to be honored from the start — see §15): 100% FOSS, no Google dependency (Firebase/Play Services), no trackers or ads, reproducible build, free license.

**Dev note**: development happens through `tauri dev` (web frontend in the native WebView), **not** in a bare browser tab — that is what provides access to native SQLite during dev. Rust stays confined to the shell and the plugins; no business logic in Rust.

## 4. Architecture principles

**Dependency rule (one-way)**:

```
domain  ←  engine, storage  ←  app  ←  ui
```

The domain knows nothing. The audio engine and persistence know only the domain. The `app` layer orchestrates. The `ui` only renders state and emits intentions. **The core (`domain`, `engine`, `storage`) never depends on Svelte** and remains testable in isolation.

Cross-cutting rules:
- **One responsibility = one clearly named module.** No decorative abstraction (no homegrown event bus, no interfaces without a second implementation, no router).
- **Unidirectional flow**: `UI → intention → command → (store mutation + engine call + persistence)`.
- **State mutation in a single place**: the command layer. Components never mutate the store directly.
- **Centralized cross-cutting concerns**: pad interaction handling (a single module) and persistence (a single debounced subscriber).
- **Explicit dependency injection** via a composition root; no singletons imported on the fly.

## 5. Directory tree

```
sampleboard/
├─ src/
│  ├─ domain/            # pure TS, zero dependencies
│  │  ├─ types.ts        # Bank, Page, Pad, Sample, Settings
│  │  ├─ enums.ts        # PlayMode, VoiceMode, BackgroundBehavior
│  │  └─ invariants.ts   # pure validations
│  ├─ engine/            # pure TS (Web Audio)
│  │  ├─ audio-engine.ts # AudioContext, buffer cache, voice management (FIFO)
│  │  ├─ voice.ts        # representation of an active voice
│  │  ├─ encoder.ts      # Opus re-encoding (WASM libopus)
│  │  └─ types.ts        # EngineEvents, callbacks
│  ├─ storage/           # pure TS (data access)
│  │  ├─ db.ts           # tauri-plugin-sql wrapper + migrations
│  │  ├─ bank-repository.ts
│  │  ├─ sample-repository.ts   # library: on-disk files + metadata
│  │  ├─ settings-repository.ts # global settings (single row)
│  │  └─ types.ts
│  ├─ app/               # orchestration
│  │  ├─ store.svelte.ts # reactive state (runes) — source of truth for config + UI
│  │  ├─ commands.ts     # sole mutation point; coordinates store/engine/storage
│  │  ├─ persistence.ts  # debounced autosave coordinator (single subscriber)
│  │  └─ create-app.ts   # composition root
│  ├─ ui/
│  │  ├─ i18n/           # JSON translations: en.json (default), fr.json… + index.ts (loader + t())
│  │  ├─ interaction/pad-input.ts   # single pointer→intention module
│  │  ├─ components/
│  │  │  ├─ PadGrid.svelte
│  │  │  ├─ Pad.svelte
│  │  │  ├─ PageTabs.svelte
│  │  │  ├─ Editor.svelte
│  │  │  ├─ Library.svelte     # library manager
│  │  │  ├─ Settings.svelte    # global settings
│  │  │  └─ ...
│  │  └─ styles/
│  ├─ main.ts            # bootstrap: create-app + Svelte mount
│  └─ app.css
├─ src-tauri/            # Tauri v2 shell (minimal Rust + plugin config)
├─ static/
├─ svelte.config.js      # adapter-static, SSR off
├─ vite.config.ts
├─ tsconfig.json         # strict
├─ LICENSE               # GPL-3.0-or-later (see §15)
└─ README.md
```

## 6. Domain model

```ts
// enums.ts
export type PlayMode = 'oneShot' | 'gate' | 'loop';        // Pad play mode
export type VoiceMode = 'mono' | 'poly';                   // Page polyphony
// Background: stop everything / only sustained sounds (Gate+Loop) / keep playing
export type BackgroundBehavior = 'stopAll' | 'stopSustained' | 'keepPlaying';

// types.ts
export interface Pad {
  id: string;
  pageId: string;
  name: string;
  sampleId: string | null;  // references a library Sample; null = empty pad
  playMode: PlayMode;       // default: 'oneShot'
  gainDb: number;           // dB, default 0.0 (original level); range [-60, +6], -60 = muted
  position: number;         // index in the grid: 0 .. rows*cols-1
}

export interface Page {
  id: string;
  name: string;
  voiceMode: VoiceMode;     // Polyphony; default: 'poly'
  rows: number;             // default: 4  (range 1..12)
  cols: number;             // default: 4  (range 1..6)
  position: number;
}

// A library sample: entity managed independently of pads (clean CRUD).
// A Sample can exist without being attached to any pad.
export interface Sample {
  id: string;
  label: string;            // displayed name, editable; default = original file name
  fileName: string;         // name on disk ({sampleId}.ogg)
  originalName: string;
  mime: string;             // 'audio/ogg' after re-encoding
  sizeBytes: number;
  durationMs: number | null;
  createdAt: number;
}

// Global settings (app-level, outside the bank).
export interface Settings {
  backgroundBehavior: BackgroundBehavior; // default: 'stopAll'
  maxVoices: number;                       // Maximum number of voices, default 8
  locale: string;                          // UI language, default 'fr'
}

export interface Bank {
  id: string;
  name: string;
  pages: Page[];
  pads: Pad[];              // flattened; grouped by pageId on read
  // The library is NOT included here: it is a shared collection,
  // loaded separately (see §8).
}
```

**Invariants** (in `invariants.ts`, pure, testable):
- `gainDb ∈ [-60, +6]`.
- `cols ∈ [1, 6]`, `rows ∈ [1, 12]`; `position ∈ [0, rows*cols-1]` and unique within the page.
- Shrinking the grid below an occupied `position` is refused until the affected pad is moved/deleted (see §12).
- Page `position`: unique and contiguous within the bank.
- A non-null `Pad.sampleId` references an existing `Sample`; otherwise the pad is *missing* (displayed state, non-blocking — see §12).
- A bank has at least one page.

## 7. Audio engine (`engine`)

Single responsibility: produce sound at low latency and manage voices. **Authoritative** over ephemeral playback state (which voices are playing); it does not duplicate it into the store, it *notifies* it (see §9, decision B).

### Public contract (sketch)
```ts
class AudioEngine {
  resume(): Promise<void>;                 // to call on the 1st user gesture
  load(sampleId: string, bytes: ArrayBuffer): Promise<void>; // decode + cache
  unload(sampleId: string): void;

  oneShot(pad: Pad, page: Page): void;     // One-Shot mode
  press(pad: Pad, page: Page): void;       // Gate — start (gate on)
  release(pad: Pad): void;                 // Gate — end (gate off)
  toggleLoop(pad: Pad, page: Page): void;  // Loop — start/stop
  stopPad(padId: string): void;
  stopPage(pageId: string): void;

  onPlayingChanged(cb: (activePadIds: Set<string>) => void): void;
}
```

### Implementation details
- **AudioContext**: created/resumed on the first gesture (mobile autoplay policy). `resume()` is idempotent, also called again when Android wakes from sleep (see §12).
- **Buffers**: decoded once, cached by `sampleId` (`Map<string, AudioBuffer>`).
- **Voices**: each playback creates an `AudioBufferSourceNode` (disposable) → per-voice `GainNode` → destination. The `GainNode` applies the linear amplitude derived from `pad.gainDb` (`amp = gainDb <= -60 ? 0 : 10^(gainDb/20)`). A voice = `{ padId, source, gain, startedAt }`.
- **Anti-click**: short linear gain ramp (~8 ms) when stopping any voice (Gate, Loop, Mono choke).
- **Re-trigger (self)**: replaying a pad first stops its own voice — never two simultaneous copies of the same pad.
- **Mono choke**: on a Mono page, starting a pad stops all other voices of **that page**.
- **Maximum number of voices**: global cap read from `Settings.maxVoices`; on overflow, the **oldest** voice is evicted (**FIFO**, short fade). Handled purely internally, not exposed.

### Behavior matrix

| | One-Shot | Gate | Loop |
|---|---|---|---|
| **Action** | tap → plays once | press and hold → plays while held | tap → loops; re-tap → stop |
| **Re-tap same pad** | restarts from 0 | (handled by press/release) | toggles stop |
| **Release** | — | stop (short fade) | — |
| **Poly page** | stacks with other pads | same | same |
| **Mono page** | stops the page's other voices | stops the page's other voices | keeps the single voice until another pad or re-tap |

## 8. Persistence (`storage`)

**All data access goes through this layer.** No component touches `tauri-plugin-sql` or the file system directly.

### Three repositories
- **`BankRepository`**: serializable config (bank, pages, pads) in SQLite.
- **`SampleRepository`** (library): manages the sample collection. **Audio bytes are stored as files** in the app's data directory (`{appDataDir}/audio/{sampleId}.ogg` — everything is re-encoded to OGG/Opus on import, see §13), **never as `BLOB` columns**. The `samples` table stores only metadata + the file name. CRUD independent of pads.
- **`SettingsRepository`**: global settings (single row in `settings`).

### SQLite schema
```sql
PRAGMA user_version = 1;   -- versioning for migrations

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

-- The library: shared collection, independent of pads.
CREATE TABLE samples (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,        -- displayed name, editable
  file_name     TEXT NOT NULL,        -- name on disk
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

-- Global settings: single row (id = 0).
CREATE TABLE settings (
  id                  INTEGER PRIMARY KEY CHECK (id = 0),
  background_behavior TEXT NOT NULL DEFAULT 'stopAll'
                        CHECK (background_behavior IN ('stopAll','stopSustained','keepPlaying')),
  max_voices          INTEGER NOT NULL DEFAULT 8 CHECK (max_voices >= 1),
  locale              TEXT NOT NULL DEFAULT 'fr'
);
```

### Migrations
The `db.ts` wrapper applies migrations in sequence according to `user_version`. Every schema evolution = one numbered migration, never a silent destructive change.

### Library management (locked decision)
The library is **managed separately**: samples are imported, renamed (`label`) and deleted independently of pads. Pads only **reference** a sample.

Deleting a sample that is still referenced: allowed from the library manager. The UI **warns** about the number of impacted pads, then on confirmation those pads' `sample_id` becomes `NULL` (`ON DELETE SET NULL` → *missing* pad, non-blocking) **and** the file on disk is deleted. No hard block: the library remains manageable under all circumstances.

## 9. Application layer (`app`)

### Store (`store.svelte.ts`)
Source of truth **for config and UI state**, in Svelte 5 runes (`$state` / `$derived`):
- bank tree (pages, pads);
- `samples: Sample[]` — the loaded library;
- `settings: Settings`;
- `activePageId`, `editMode`;
- `activePadIds: Set<string>` — minimal **reflection** of the engine, never computed store-side.

### Command layer (`commands.ts`) — sole mutation point
Each command atomically coordinates store + engine + persistence. List:

- **Pages**: `addPage`, `renamePage`, `deletePage`, `setPageVoiceMode`, `setPageGrid(rows, cols)`, `reorderPages`, `selectPage`.
- **Pads**: `addPad`, `renamePad`, `setPadPlayMode`, `setPadGainDb`, `assignSample(padId, sampleId | null)`, `deletePad`, `reorderPads`.
- **Library**: `importSample(file) → sampleId`, `renameSample(sampleId, label)`, `deleteSample(sampleId)`.
- **Play**: `firePad` (One-Shot), `pressPad` / `releasePad` (Gate), `toggleLoopPad` (Loop), `stopPad`, `stopPage`.
- **Settings**: `setBackgroundBehavior`, `setMaxVoices`, `setLocale`.
- **App**: `toggleEditMode`.

### Persistence coordinator (`persistence.ts`)
- **Decision A (locked): debounced autosave.** A **single** reactive subscriber persists the config (~300–500 ms debounce) when the tree changes. No `save()` scattered through the UI.
- Import writes immediately (re-encoded file + `samples` row), outside the debounce.
- **Settings** (infrequent) are persisted immediately on every change, outside the debounce.

### Decision B (locked): playback state not duplicated
The engine is authoritative over active voices; the store only reflects `activePadIds` via `onPlayingChanged`. No playback logic in the store.

## 10. Interaction handling (`ui/interaction/pad-input.ts`)

**Single module** mapping Pointer Events to intentions, according to the pad's **Play mode**. Centralized so gate handling is never duplicated/forgotten.

- **Pointer Events** only (unified mouse + touch); `preventDefault` to avoid synthetic mouse events and double triggering.
- **One-Shot**: `pointerdown` → `firePad`.
- **Gate**: `pointerdown` → `pressPad` (+ `setPointerCapture`); `pointerup` / `pointercancel` → `releasePad`. Capture guarantees the `release` even if the finger leaves the pad.
- **Loop**: `pointerdown` → `toggleLoopPad` (stop if playing, otherwise start).
- Guard against ghost events (a single entry path per gesture).

## 11. UI / components

**"Dumb" components**: they render state and emit intentions. No audio or DB logic. All visible text goes through `t(key)` (i18n, §3).

**Layout (decision 2026-07-02, v1)** — mobile-first, the grid at the center of the screen:
- **`Topbar`** (top bar) — active page info: name/number, Polyphony, grid
  dimensions. **Tap → page drawer** (in both modes).
- **`Bottombar`** (action bar, bottom of screen) — **Play ↔ Edit** toggle, **Stop all**
  (`stopAllVoices`, panic), **pages** (scrollable tabs + add in Edit), **Quick import**
  (direct file picker), **Library** (opens the panel), **Settings**
  (global settings drawer).
- **`Drawer`** (contextual drawer, on the right, with scrim) — three contents: `PadSettings`
  (rename, Play mode, gain **dB**, assignment from the library, deletion),
  `PageSettings` (rename, Polyphony, `rows`×`cols` grid, ordering, deletion), `Settings`
  (global settings: Background, Maximum number of voices, language). Closing: ✕ or tap outside.
  **Pad drawer: Edit only** (in Play, tapping a pad plays — zero accidental gestures);
  creating a pad (the « + » cell, Edit) opens its drawer.
- **`LibraryPanel`** — library as a **full-screen panel**: import, rename (`label`),
  deletion (with a warning about impacted pads), **preview** (`Library` content).
- `PadGrid` / `Pad` — `rows`×`cols` grid, *active / missing / empty* state, wired to
  `pad-input` (Play); in Edit, tap → pad drawer.
- **Active** visual indicator driven by `activePadIds`.

The drawer's open state (`drawer`) lives in the store (UI state, §9) and is only mutated by
commands. The **`<main>` view** (`view`: board ↔ library) is a **projection of the
URL** (#23, §16): only `applyRoute` writes it; navigation goes through URL writes.

## 12. Edge cases & robustness decisions

- **Suspended AudioContext** (Android wake from sleep, autoplay policy) → `resume()` on the next gesture; the engine exposes its state.
- **Missing sample** (file deleted outside the app) → pad marked *missing*, displayed as such, no crash; triggering is a silent no-op.
- **Deleting a page** with active voices → `stopPage` first, then deletion.
- **Corrupt import / undecodable format** → rejected with a message, no row created.
- **Gain**: **dB** scale (`[-60, +6]`, `0` = original level, `-60` = muted), converted to amplitude by the engine.
- **Grid resizing**: shrinking `rows`/`cols` below an occupied position is refused (message) until the affected pad is emptied/moved.
- **Android background** (pause): driven by `Settings.backgroundBehavior`. Default `stopAll` = suspend the AudioContext + stop all voices; `stopSustained` = stops only Gate/Loop; `keepPlaying` = lets it run (continuous ambience use case).

## 13. Audio import & compression

**Principle: the original is never stored as-is.** Every imported sample is decoded then **re-encoded to OGG/Opus** before being written to the library. This avoids dragging around bulky WAV/AIFF files; the app keeps only a compact, free format.

### Import pipeline
1. `tauri-plugin-dialog` → file selection. **Accepted input** formats: anything the WebView can decode (wav, aif/aiff, mp3, ogg, m4a/aac, flac…).
2. Read bytes via `tauri-plugin-fs`; validate **max size 20 MB** (before decoding, on the source file); `decodeAudioData` → PCM (also used to validate and extract `durationMs`). Too-large or undecodable file → rejected, no row created.
3. **Re-encode to OGG/Opus** — **Opus** codec (excellent for voice/sound effects at low bitrates and 100% FOSS), fixed bitrate **96 kbps**. Mono preserved if the source is mono.
4. Write only the compressed file `{appDataDir}/audio/{sampleId}.ogg` + insert into `samples` (`mime = audio/ogg`). The original is not kept.

### Encoder (decision: embedded WASM)
Re-encoding happens **frontend-side** ("no business logic in Rust" rule). Choice made for **maximum portability**: an **embedded FOSS WASM encoder** (libopus + ogg container), independent of the Android System WebView version. Identical behavior on all devices, no dependency on an optional browser API. WebCodecs `AudioEncoder` may serve as an **opportunistic** accelerated path when available, but WASM remains the reference baseline.

## 14. Data flow (summary)

```
[UI Pad]  --pointer-->  [pad-input]  --intention-->  [command]
                                                        │
                    ┌───────────────────────────────────┼───────────────────────────┐
                    ▼                                   ▼                             ▼
              [store mutation]                    [engine call]              [persistence (debounced)]
                    │                                   │
                    └──────── activePadIds ◄────────────┘  (engine notifies, store reflects)
```

## 15. F-Droid constraints & build

- **License: `GPL-3.0-or-later`** — strong copyleft, the most widespread and the best suited to the F-Droid ecosystem (compatible with the libopus/ogg dependency). `LICENSE` file + SPDX headers (`SPDX-License-Identifier: GPL-3.0-or-later`).
- **No Google dependency** (Firebase, Play Services), no trackers, no ads, no account required.
- **Reproducible build**: pinned toolchain versions, deterministic build; Tauri v2 (system WebView, no Google dependencies by default) is a good fit, unlike Capacitor which drags in proprietary dependencies.
- **No copyrighted content** bundled (the app ships without audio).
- F-Droid metadata (fastlane structure: descriptions, screenshots, changelog) — to prepare at the packaging milestone.
- Dependency audit (Tauri plugins `sql`/`fs`/`dialog`, WASM libopus encoder): all FOSS; verify that no proprietary transitive dependency enters on the Android side.

## 16. Locked decisions

- **Vocabulary**: see the **Glossary** at the top (source of truth). Behavior terms in MIDI controller terminology.
- **i18n**: multilingual app; labels in language files, code/schema in English.
- **Default language: English** (2026-07-05, repo public/international): `en.json` complete
  = default & fallback, `fr.json` complete, selector in Settings (registry-driven —
  `availableLocales()`). The factory-manifest labels are in English (they are visible pad
  data); fastlane screenshots live under `en-US` (F-Droid clients fall back to en-US).
- **Gain**: **dB** scale `[-60, +6]`, `0` = original level, conversion → amplitude by the engine.
- **Library**: managed separately (CRUD); deleting a referenced sample makes the pads *missing* (warning + confirmation), never a hard block.
- **Background**: configurable via `Settings.backgroundBehavior`, default **« Tout stopper »** (`stopAll`).
- **Grid**: `4×4` by default, **resizable per page**, bounded `cols ∈ [1,6]` × `rows ∈ [1,12]` (widened 2026-07-02, migration 3).
- **Import compression**: systematic re-encoding to **OGG/Opus at 96 kbps**; WAV/AIFF not kept (Vorbis abandoned).
- **Encoder**: **embedded WASM libopus** (max portability); WebCodecs as opportunistic acceleration only.
- **License**: **`GPL-3.0-or-later`**.
- **Multi-bank**: **v1 is single-bank** (one `bank` row); schema already multi-ready, deferred to v2.
- **Maximum number of voices**: default **8**; overflow handled as **FIFO**, internal, not exposed.
- **Max import size**: **20 MB** (on the source file, before decoding).
- **Network**: **v1 is 100% offline** — no network access, no Android network permission (reinforces the F-Droid constraint §15, consistent with the offline-first stance "the user imports their files"). URL import (network access, on-the-fly permission) is deferred to **v2**.
- **UI layout v1** (2026-07-02): **Topbar** (page info → page drawer) + **Bottombar**
  (Play/Edit, Stop all, pages, Quick import, Library, Settings) + right **Drawer**
  (pad — Edit only —, page, settings) + **Library as a full-screen panel**. See §11.
- **Full board at creation** (2026-07-02): a page is born with its **grid filled with
  pads** (one cell = one pad) and **every pad and every page has a color from init**
  (**OKLCH** palette, cycled by position/rank — `BankFactory`). Never a blank page nor a
  colorless pad. Pad style: **solid outline + transparency-tinted fill**.
- **Code style** (2026-07-02): **object-oriented** for stateful services and factories
  (classes + constructor injection); **DRY / SOLID / SoC mandatory**; a single
  representation of absence (`T | null`, never optional + nullable); strict typing via
  the domain's named unions.
- **CSS units** (2026-07-02): **never `px`** except stroke widths (borders,
  hairlines ≤ 3px) — dimensions, spacing, radii, shadows in **rem** (or
  viewport/% units); pills as `999rem`.
- **Pool** (2026-07-02): the reserved intermediate container is unlocked in v1 — **session
  working list** (not persisted) fed from the library;
  tapping an item ARMS it (on-the-fly assignment), the pool stays visible while
  tapping pads. Tag management lives in a standard « Gérer les tags » (manage tags) modal
  (header of the Library panel).
- **Pool reworked** (2026-07-04, #18): an **Edit-only** tool. **Always-on sidebar**
  in flow on wide screens (≥ 48 rem — no button, no close); button-driven **left
  drawer** (bottombar) on narrow screens, also floating above the open
  library (`--z-pool`) for dropping. **Drag and drop**: library row
  → pool, pool item → pad (immediate assignment) — shared MIME type
  `application/x-sampleboard-sample` (`ui/interaction/sample-dnd.ts`); a pointer
  shortcut, the touch flow "arm then tap" remains the mobile path. Header:
  **Ajouter** (add — opens the library) + **Vider** (clear — `clearPool`). **Hand** cursor
  (`grab`/`grabbing`) on draggable items.
- **Library cards: waveform + progress** (2026-07-04, #19): static peaks
  of the sample on each card (`SampleWaveform`, `drawPeakBars` drawing shared with the pad);
  during preview, the played portion fills in (`engine.previewProgress()`). rAF
  only during the preview of the card concerned.
- **Tag management → right drawer** (2026-07-04, #20): the « Gérer les tags » modal
  becomes a view of the **contextual drawer** (`TagSettings`, `drawer = 'tags'`,
  `openTagsDrawer`) — the list updates behind it, live.
- **Library = a layout VIEW** (2026-07-04, #22 — supersedes "full-screen panel"
  §11/M6): `libraryOpen` switches the content of `<main>` (grid ↔ library), topbar
  (title « Bibliothèque » instead of the page context; visualizer and Stop remain)
  and bottombar stay. This removes the special overlays: no more `--z-panel`,
  the pool no longer needs to float above the library (sidebar in flow next to it,
  `--z-pool: 19` reserved for the narrow drawer), the contextual drawer goes back to
  `--z-drawer: 20`.
- **URL-driven navigation** (2026-07-04, backlog #23 — shipped same day):
  the display of the current view is a **projection of the URL**, never an independent
  state variable (`store.view` replaces the `libraryOpen` boolean, kept as a derived read).
  Four elements:
  a `view identifier → component` table (data structure, no branching), a URL → component
  resolution function with a **default case** (board), dynamic rendering of the resolved
  component, bidirectional synchronization (URL → display at init/`hashchange`/back-forward;
  display → URL through URL writes only, never direct mutation). Fixed parameters:
  **fragment encoding (`#`)** — the Tauri asset protocol has no `index.html` fallback,
  the fragment works identically in `tauri dev` and in the APK — **with deliberate history
  management**: a coherent stack for the Android/touch back gesture (push for a real
  navigation, `replace` for default redirections and URL corrections); **view + parameters
  cardinality** (e.g. `#/library?tag=…`), the resolution function owns the decoding of
  variable parameters. Implementation: `app/navigation.ts` (pure resolution) +
  `app/router.ts` (`createHashRouter`, depth marked in `history.state` — the ✕ and the
  back gesture pop the same entry; `createLoopbackRouter` as the default outside a browser),
  view → component table and dynamic rendering in `App.svelte`. A **stale** filter
  parameter (vanished tag) falls back to « Tous » (all), URL corrected via `replace` — never a
  ghost filter that empties the library.
- **Sample tags** (2026-07-02, backlog triage #10-12): **n-to-n** labels (`tags` +
  `sample_tags`, migration 4), customizable (CRUD); default list seeded on first
  launch (SFX, Répliques, Jingle, Musique, Ambiance, Voix, Réaction, Meme, Alerte —
  i18n labels injected at creation). **« Non classé » (untagged) = virtual filter** (samples
  without tags), never stored. Filter in the library + search/filter in the sample-picker
  modal; direct page→pad assignment from the library.
- **« Découper » brought back into v1** (2026-07-02, backlog triage #4/#5): **audio editor** as a
  dedicated full-screen view — waveform + **start/end** trimming before encoding (on import and from
  the library), **undo/redo**, preview of the selection. Trimming applies to the decoded
  PCM BEFORE Opus encoding (the stored file is already trimmed). Stacking: level-2
  modal/view (above the import modal, native top layer). The word « couper » remains banned
  from the rest of the UI (« stopper »).
- **Batch import & archives** (2026-07-02): the import inputs accept **multi-file
  selection** and **zip/rar archives**. ONE audio file → audio editor (M7 flow
  unchanged); several files or an archive → **direct batch** without the editor (trimming
  remains possible afterwards via « Découper »), tracked in the **import modal**
  (global bar, per-file status, interruption). The bottombar import button
  **opens this modal** (file choice then progress in the same place); the library
  input remains a direct path to the picker. Archives unpacked via **libarchive
  compiled to WASM** (`libarchive.js`, MIT; libarchive, BSD — zip + rar4/rar5
  clean-room readers): the **official unrar code is refused** (non-free license, incompatible
  with GPL-3.0 and an F-Droid blocker). The worker and its `.wasm` are served side by side at a
  stable path (dedicated Vite plugin). Bounds: archive ≤ **200 MB** (`ARCHIVE_MAX_BYTES`), each
  entry remains subject to the 20 MB import limit; only candidate audio extensions enter
  the batch (decoding remains the final arbiter, §12). From-source build of the WASM: same
  treatment as the opus encoder (Packaging milestone).
- **Reference factory bank — Freesound CC0** (2026-07-04, supersedes batch #14 of
  78 sounds of untraced provenance): the factory library becomes a **reference bank
  of about 25 soundboard classics** (buzzer, ding, ba-dum tss, drum roll,
  applause, sitcom laughter, tada, sad trombone, hotel bell, whistle, cowbell,
  air horn, whoosh, crickets and suspense as Loops, etc.) — "reference sounds, not
  filler". Provenance **exclusively Freesound under CC0** (HQ OGG previews →
  Opus 96k re-encoding via dockerized ffmpeg); automatic selection by reputation
  (`scripts/freesound-worklist.json` + `scripts/freesound-rebank.mjs`, API key required)
  then **validation by listening**; `source` + `license` filled in for every entry of the
  manifest — the licenses TODO (F-Droid blocker) disappears along with the original batch.
- **Master bus & unified preview** (2026-07-03): the Web Audio graph has a **single
  chokepoint to the output** — `master (GainNode) → destination`; **everything that sounds
  connects to it** (pad voice chains, previews), never to `destination` directly.
  That is where master gain, a limiter or a global visualizer plug in (`masterWaveform`,
  analyser as a **lazy side-tap**: created on first call, audio does not flow through
  it). The **preview is ONE shared behavior** (library, sample modal,
  audio editor): **only one at a time** in the app, replaced by the next one, **▶/■
  toggle** on the button, and **any other action acts as a stop** — a rule enforced
  **mechanically** via the `PREVIEW_STOPPING_COMMANDS` list (commands.ts, dedicated
  generic test), with the background stopping the preview **regardless** of the setting
  (a browsing sound, not gameplay). Reflection: `store.previewingSampleId`; mutation via
  `commands` only; the engine notifies the end only by **source identity** (natural end).
  **The preview shows in the topbar visualizer** (#24, 2026-07-04): an accent-colored
  wave alongside the voice waves (`previewWaveform` tap as a lazy side-tap, same
  rule as the master analyser) — everything that sounds on the main out is visible.
- **Two distributions** (2026-07-04, clarified): **Android/F-Droid** (M9, primary channel) and
  **web/PWA** (new milestone **M10 — Web distribution**, `0.11.0`, AFTER M9). The **self-hostable
  Docker image is NOT a distribution in its own right**: it is a **delivery mode**
  of the web/PWA on a server (the same static build, self-served).
  Web channel persistence: **native IndexedDB** —
  web implementation of the `storage/types.ts` repositories (bank, samples, settings, tags +
  audio bytes), a seam already proven by the memory mode; the SQL/SQLite schema remains
  Tauri-specific (no SQLite WASM — anti-overengineering). PWA: manifest + icons + offline
  service worker (the app and the factory samples). Web/PWA delivery: public hosting
  AND/OR a static-server Docker image. This brings the v2 "pure browser mode"
  (§17) forward into M10.
- **Validation order: web first, Android second.** Every milestone is first developed and validated on the **web** (Vite dev http://localhost:1420 + desktop `tauri dev` window); validation on a **real Android device** is a **second step**, never a prerequisite to move forward. The final target remains F-Droid/Android (§15) — it is the working order that is fixed, not the target.

## 17. Future evolutions (beyond v1)

**Sample trimming/cutting** (« découper »: silence trimming, selecting an excerpt on import), **multi-bank** (several independent banks, switching; schema already ready), _(possible intermediate "pool" container between library and bank)_, keyboard shortcuts, sample recording, effects (master volume, fade, pitch), waveform display, advanced drag-and-drop reordering, MIDI, bank export/import (portable file), iOS. _(The "pure browser mode" was brought forward into **M10 — Web distribution**, decision §16 of 2026-07-04.)_

## 18. Development milestones (incremental)

Verifiable step-by-step breakdown — each milestone is validated before stacking the next.

- **M0 — Foundation**: scaffold Vite + Svelte 5 + strict TS + Tauri v2 (static SPA, SSR off), skeleton composition root, minimal i18n (FR), `tauri dev` launch.
- **M1 — Audio**: `AudioEngine` + one hard-coded pad playing an imported buffer (One-Shot). Validates Web Audio + `resume()` on a real Android device.
- **M2 — Core**: domain + store + commands + multi-page + the 3 Play modes + Mono/Poly Polyphony. Validates the §7 matrix.
- **M3 — Edit**: full Edit mode (pad/page CRUD, **dB** gain, Play mode, `rows`×`cols` grid, assignment from the library).
- **M4 — Library & import**: `Library` (sample CRUD), import via dialog/fs + **OGG/Opus re-encoding** on import, preview. Validates the decode→encode chain on a real device.
- **M5 — Persistence & settings**: SQLite schema + repositories (bank, library, settings) + audio file storage + `Settings` (Background, Maximum number of voices, language) + autosave coordinator + load on startup.
- **M6 — Packaging**: Android build, FOSS dependency audit, reproducible build, license, F-Droid metadata.

---
