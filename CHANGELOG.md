# Changelog

All notable changes to **Sampleboard** are recorded here.

Format inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
**SemVer** versioning (see [`roadmap.md`](./roadmap.md) §1).
`1.0.0` is not planned: it marks the first **stable and complete** release.

## [Unreleased]

### Changed
- **README rewritten as an illustrated user manual**: centered logo/title, prominent
  live-demo link (GitHub Pages), and a screen-by-screen guide (board, play modes, pool,
  pad, page, library, trim/cue, settings) with eight freshly generated screenshots.
- **Starter board demonstrates all three play modes**: the *Air horn* pad on the Main page
  is now a **Gate** (hold-to-blast), alongside the existing One-Shot and Loop pads.
- **Auto pad name crop raised from 12 to 32 characters** (`PAD_NAME_MAX`): assigned pad
  names keep far more of the sample label (e.g. *Ding (correct answer)* instead of
  *Ding (correc*).
- **Fastlane/manual screenshots**: the capture spec now produces eight views and waits for
  the non-blocking seed to finish; sample count read from the manifest (25 + drum kit).

## [0.12.0] - 2026-07-05 — M11 (Pad cue points)

> Backlog #34. Non-destructive per-pad trimming. 334 unit + 22 E2E green.

### Added
- **Pad cue points**: a pad can play only a `[start, end]` window of its sample **without
  altering the audio** — cue points are stored on the pad. Edit them from the pad drawer
  via the waveform editor: **Apply to pad** (instant, no re-encode) or **Save as new
  sample** (bakes the window into a new library entry, original untouched). Loop respects
  the window; clear anytime. Several pads can cue the same sample differently.

## [0.11.0] - 2026-07-05 — M10 (Web distribution) + UI pass

> Backlog #25-33. Second distribution channel (web/PWA) plus a round of UI
> refinements. 322 unit + 21 E2E green; live on GitHub Pages.

### Added
- **Browser persistence (IndexedDB)**: the web flavor persists everything
  (bank, samples + audio bytes, settings, tags) across reloads — first launch,
  factory seeding and deletion guards behave exactly like the Android build.
- **PWA**: installable, **fully offline** — even a first launch seeds the complete
  25-sound starter bank from the service-worker precache. Build-time-generated
  service worker (no third-party library), network-first navigations so updates
  propagate.
- **Docker self-hosting** (`docker-compose.web.yml`, unprivileged nginx) and
  **public hosting on GitHub Pages** (relative base, auto-deploy on push).
- **Second factory board** (#28): a 3×3 **drum kit** on page 2 (9 CC0 one-shots),
  per-page `boards` in the manifest.
- **Buffer preloader/pacer** (#27): the app mounts without waiting for decoding;
  pads show a **loading** state while their buffer decodes (priority: active page
  first).
- **Settings › Application** (#31): version display, **update** (non-destructive) and
  **factory reset** behind a `<dialog>` confirmation.
- **Add to the assignment pool** button in the pad drawer (#33).

### Changed
- **English by default** (#26), French switchable in Settings; English screenshots.
- **New app icon**: 3×3 pad matrix in the app palette (replaces the placeholder).
- **Edit mode = one icon** + the Edit violet on every Edit surface (pads, pool,
  library ring) (#29); **global Stop moved next to the master visualizer** (#30);
  **Import a sound** relocated to the left of the library panel header (#32); library
  search toolbar sticks flush to the top.

## [0.10.0] - 2026-07-05 — M9 (Packaging)

> Backlog #18-25. F-Droid prerequisites complete (submission deferred): public GitHub
> repository, CC0 starter bank with traced licenses, WASM built from source,
> **deterministic APK** (two clean release builds → byte-identical output), fastlane
> metadata with validated screenshots. 308 unit + 17 E2E green.

### Added
- **URL-driven navigation** (#23): the displayed view is a **projection of the URL**
  (`#/board`, `#/library?tag=…` — the library filter travels as a parameter), with
  deliberate history management: the ✕ button and the Android back gesture pop the
  same history entry; unknown URLs are normalized without polluting history.
- **Preview in the topbar visualizer** (#24): the preview wave (library, pool, editor)
  draws in the accent color alongside the pad-colored voice waves — everything audible
  on the main out is visible. Lazy side-tap analyser (zero cost when nothing renders it).
- **Waveform on library cards** (#19): static sample peaks always visible
  below the name; during preview, the played part fills in (progress).
- **Quick preview from the pool** (#21): ▶/■ button at the head of each item +
  progress waveform behind the label.

### Fixed
- **Library looking "empty" after a reload**: a stale `?tag=` URL parameter (tag id
  regenerated or tag deleted) filtered on a ghost tag with no active chip; an unknown
  tag filter now falls back to « Tous » (all) and the URL is corrected.
- **Factory seeding frozen without a user gesture**: the decode path awaited
  `AudioContext.resume()`, which never resolves while the autoplay policy blocks —
  first launch could show an empty library until a pad was touched. Decoding no longer
  touches `resume()`; the full bank seeds unattended.
- **fastlane screenshot 5** captured the pad drawer mid-open-animation
  (semi-transparent); captures now wait for animations to finish.

### Changed
- **The library becomes a VIEW of the layout** (#22, exit the full-screen popin): it
  is displayed in the main area in place of the grid — topbar (view title,
  visualizer, Stop) and bottombar (global Stop, Play/Edit switch, pages) remain
  accessible. In Edit mode on wide screens, the pool sidebar sits next to the library:
  dragging a row to the pool happens naturally.
- **Tag management in the right drawer** (#20): « Gérer les tags » (Manage tags) now opens
  the contextual drawer (exit the modal) — the list and the filters update behind,
  live.
- **Hand cursor** (`grab`/`grabbing`) on draggable items (library rows,
  pool items).
- **Pool reworked** (#18): an **Edit-only** tool — **always-on sidebar** on
  wide screens (≥ 48 rem, no button, no closing), button-driven **left drawer** (bottombar)
  in narrow, floating above the open library for dropping.
  **Drag and drop**: library row → pool, pool item → pad (immediate
  assignment); the "arm then touch" touch path remains the mobile route. Header:
  **Add** (opens the library) + **Clear**.
- **Starter bank replaced** (decision §16): **25 soundboard classics, all CC0** from
  Freesound (buzzer, laugh track, tada, sad trombone, applause, crickets/suspense
  loops…), source + license traced per entry in the manifest — 1.5 MB instead of the
  former 18.3 MB / 78 untraced sounds (also purged from the public git history).
  Rebanking tooling: `scripts/freesound-worklist.json` + `freesound-rebank.mjs`
  (CC0-only search by reputation, `--only=<slug>` unit replacement).
- **WASM built from source** (F-Droid requirement): the opus encoder
  (opus-recorder v8.0.5, libopus 1.3.1 + speexdsp pinned by submodule SHA,
  emsdk 3.1.26) and the archive extractor (libarchive.js v2.0.2 chain, five source
  tarballs SHA-256-verified, emsdk 3.1.45) are rebuilt in Docker and vendored under
  `src/vendor/` with PROVENANCE files — the npm prebuilt binaries are no longer used
  at runtime.
- **Documentation in English**, user-oriented README; repository published on
  **GitHub** (`fchaussin/sampleboard`, public).

## [0.9.0] - 2026-07-03 — M8 (Advanced library)

> Backlog #10-16. Validated on web: 283 unit + 13 E2E, user visual review.

### Added
- **Multiple import & archives** (#13): multi-file selection + **zip/rar** archives
  unpacked via **libarchive WASM** (`libarchive.js` MIT, clean-room rar readers — decision
  §16). ONE audio file → editor (M7 flow); otherwise **direct batch** with **progress
  modal** (bar, per-file status, interruption, failure aggregation, "add to pool"
  option). Worker+wasm assets served at a stable path (Vite plugin).
- **Factory samples** (#14): 78 curated OGG/Opus (18.3 MB) embedded in every dist
  (`public/factory-samples/` + `manifest.json`: labels, tags, provenance/license).
  **Seeded on first launch only** (same guard as bank/tags: once deleted, they
  never grow back), **without re-encoding** (`seedFactorySample`), non-blocking. The
  **`board`** selection pre-assigned to the « Principal » page (16 pads, 2 ambiences in Loop).
  **Validation at every build** (`factory-samples-manifest` plugin): manifest ↔ files
  1:1, OGG only, admitted tags, coherent board — build fails otherwise; missing provenance
  or license = warning (to be filled in BEFORE F-Droid submission).

- **Sample tags** (migration 4: `tags` + `sample_tags`, cascades): n-to-n,
  customizable (create/rename/delete in the library), **seeded on first
  launch** (SFX, Répliques, Jingle, Musique, Ambiance, Voix, Réaction, Meme, Alerte —
  injected i18n). **« Non classé » (Unclassified) = virtual filter** (absence of assignment, never stored).
- **Library**: **chip filter bar** (« Tous » (All) / tags / « Non classé »), expandable
  row per sample — toggleable tag chips + **ON-THE-FLY assignment**: "Assign
  to pads" arms the sample, each touched pad receives it (all pages, multi-pad),
  banner + Done.
- **Sample picker modal = combobox**: text search + tag filter (local to the
  modal) — shared pure `app/tag-filter.ts`.
- **Multi-page init bank**: 3 pages with contrasting layouts (4×4, 2×2, 8×6), all
  complete and colored — the page concept obvious without explanation.
- **Global visualizer: idle status** — low-frequency sine waves scrolling gently
  when nothing is playing.
- **Edit mode: bold MIDI-map-style coloring (Ableton)** — uniform saturated purple
  fills on all pads, the mode is unmissable.
- **Pool** (LEFT drawer, session): working list of samples — "Add to pool"
  from the library, touching an item ARMS it (on-the-fly assignment), the drawer
  stays open while touching pads. The reserved "pool" glossary term is unlocked.
- **Tag management relocated**: standard « Gérer les tags » (Manage tags) modal opened from
  the Library panel header (the `<details>` disappears).
- Locked conventions (§16): **CSS without `px`** except stroke widths (everything in rem);
  **standard UI elements only**; segmented Play/Edit toggle (sliding cursor,
  inactive segment grayed out).
- **Library search** (#15): text field on the label (case/spaces
  ignored) **combined (AND)** with tag filters (`filterSamples` shared with the picker),
  **sticky** toolbar, "no results" state with a **Show all** button.
  **Adaptive layout**: card grid ≥ 48 rem, actions under the name in narrow,
  targets ≥ 44 px on touch.
- **Stoppable preview + master bus** (#16): ▶ toggles to ■ during playback, re-tap
  or **any other action** stops (mechanical `PREVIEW_STOPPING_COMMANDS` list); ONE
  unified behavior (library, sample modal, editor — shared
  `PreviewButton` component). **Master bus** `gain → analyser → destination`: single passage of
  all sound (voices + previews), `masterWaveform` for the global visualizer,
  analyser as a lazy branch.

### Fixed
- **Encoder: the last 80 ms of samples are no longer lost** — the Opus codec holds an
  internal delay (pre-skip, 3,840 samples) that the worker does not flush: the end of the audio
  stayed in the buffer. Remedy: a cushion of silence pushed at the input tail, the granule
  remaining bounded to the real duration (`trimOggTail`). Restored duration faithful to ±0.03 ms;
  the **trailing silence** of encoded samples is eliminated along the way.

## [0.8.0] - 2026-07-02 — M7 (Audio editor « Découper », trim)

> Backlog #4/#5 pulled back from v2 (decision §16). Validated on web: 197 unit + 6 E2E
> (real drag, undo, reduced persisted duration, rework), user visual review.

### Added
- **Full-screen audio editor** (`AudioEditor`, `<dialog>` top-layer): waveform of the decoded
  PCM (cached peaks), **start/end handles** by pointer, solid vs dimmed selection,
  times `start – end · duration`, **selection preview** (`previewPcm`), **undo/redo**
  (`SelectionHistory`), Cancel/Confirm (failure → editor stays open + message).
- **Every import opens the editor** (quick Import, Library, sample picker modal —
  the pad to assign is remembered and assigned on confirmation). The stored file is **already
  trimmed** (PCM trim before Opus encoding).
- **Rework**: « ✂ Découper » (trim) on every library sample — re-decodes the OGG,
  re-encodes the selection, **id and file preserved** (`SampleRepository.replace`),
  best-effort buffer restore on failure.
- Pure `engine/pcm.ts`: `trimPcm`, `clampSelection` (min duration 10 ms), `computePeaks`
  (shared with `engine.peaks`, DRY), `pcmDuration` — the persisted `durationMs` now
  derived from the real PCM.

## [0.7.0] - 2026-07-02 — M6 (Interface)

> Complete layout overhaul (backlog triage #2, decisions §11/§16) + three UX feedback
> passes the same day. **Validated**: 172 unit + 4 E2E, 390×844 screenshots, user
> visual review OK.

### Added
- **Topbar**: active page info (name/number, Edit chip, Polyphony, grid) —
  tap → page drawer.
- **Bottombar**: Play ↔ Edit switch, **global Stop** (`stopAllVoices`, panic),
  scrollable page tabs (+ add in Edit mode), **quick Import** (errors via snackbar),
  Library, Settings. Inline SVG icons (`Icon.svelte`, zero dependencies).
- **Drawer** (right drawer + veil): `PadSettings` / `PageSettings` / `Settings`;
  close via ✕ or tap outside; **pad drawer in Edit mode only** (in Play, a tap plays);
  creating a pad ("+") opens its drawer.
- **LibraryPanel**: library as a full-screen panel.
- UI state in the store (`drawer`, `libraryOpen`), mutated by commands only
  (`openPadDrawer`, `openPageDrawer`, `openSettingsDrawer`, `closeDrawer`, `openLibrary`,
  `closeLibrary`, `stopAllVoices`).
- Reworked theme: palette (`--panel`, `--border`, `--danger`), touch targets ≥ 44 px,
  centered `100dvh` grid, Android safe-areas, shared drawer forms.

### Removed / replaced
- `Editor.svelte` → split into `PadSettings` + `PageSettings` (drawer); `PageTabs.svelte` →
  tabs integrated into the bottombar; `Settings` leaves its `<details>` for the drawer.

### Added (2nd pass)
- **Page and pad colors**: `color` prop (palette token), **OKLCH palette**
  (8 hues homogeneous in L/C, entire theme converted to oklch()), shared `ColorPicker`,
  tinted tabs/pads (`--tint`), **migration 2**; unknown token neutralized at load.
- **Default names**: initial page « Principal » (Main), added pages « Page N » (i18n
  generators injected via `CreateAppOptions` — the app layer never imports ui/i18n, §4); an
  unnamed pad named after the assigned sample (`defaultPadName`, extension removed, 12 chars max).
- **Sample picker modal** (`SamplePicker`, native `<dialog>`): list + preview +
  "none" + **direct import assigned right away**. Overlay stacking formalized
  (layer 0 app / layer 1 drawer & panel `--z-*` / modals in native top-layer).
- **Library**: per-sample metadata (size MB, duration s, localized).
- **Grid shrinkable to 1×1**: bounds `rows [1,12]` / `cols [1,6]` — **migration 3**
  (`pages` rebuilt per the SQLite procedure, FK/cascades verified).
- DRY: shared helpers `ui/import-file.ts` (single import path) and `ui/tint.ts`.

### Added (3rd pass — complete board from init)
- **`BankFactory`** (injected class — §16 "OO style" decision): single responsibility for
  creation defaults. **A board is born COMPLETE**: colored « Principal » page + grid
  **filled with all-colored pads** (palette cycle by position) on first launch;
  added pages complete; grid enlargement backfilled automatically.
- **Pad style**: **solid** outline + tinted background in **transparency** (color-mix oklab);
  name above the mode, more opaque — **bold** if a sample is assigned, *semi-transparent
  italic* if empty.
- Type rigor (§16 decision): `color` **required** (`Color | null` — a single
  representation of absence), pad status typed `PadStatus`.
- **Fully adaptive grid**: pads occupy all available space (`1fr` tracks).
- **Per-pad stop**: prominent button at the bottom right during One-Shot/Loop playback.
- Distinct name placeholders: « (vide) » (empty, no sample) ≠ « (sans nom) » (unnamed sample).
- **Creating a page** ("+" bottombar button) opens the new page's drawer.
- **Playback state = intensity**: playing pad with solid background + halo (instant rise,
  soft decay); assigned pads clearly more opaque (45 %) than empty ones.
- **Real-time visualizers**: `AnalyserNode` per voice (engine: `waveform()`, `progress()`,
  `peaks()` — static sample peaks, lazy cached computation) — in the playing pad,
  **file-waveform-shaped progress** (played part solid, rest dimmed);
  **global multi-voice visualizer in the topbar** (one real-time wave per voice, in its
  pad's color) with **contextual global Stop** next to the waves (shared `ui/waveform.ts`:
  cached CSS color resolution + drawing utilities).

### Naming (arbitrated)
- Temporary rename to "audio-sample-board" the same day, then **arbitration: the project
  stays `Sampleboard`** (one word, distinctive, descriptive; Android identifier
  **`org.sampleboard.app`**, locked before any F-Droid publication). The local directory
  remains `ambianceur` (Claude history).

### Tests
- `commands.ui.test.ts` (drawer/library/stop + colors + names + factory),
  `bank-factory.test.ts`, `colors-naming.test.ts`, migrations 2-3; e2e adapted (sample
  modal, complete board). Total: **172 unit + 4 E2E**.

## [0.6.0] - 2026-07-02 — M5 (Persistence & settings)

> **Validated**: 128 unit tests (storage exercised against a **real SQLite** via `node:sqlite`)
> + 4 E2E + build + `cargo check` in rootless Docker; persistence verified in the
> `tauri dev` window (bank written by the plugin's real transaction, re-read after relaunch).
> Sound in the WSLg window still muted (dev environment, tracked in backlog #3); Android =
> 2nd stage (spec §16).

### Added
- **SQLite persistence** (`storage/`): `db.ts` (`SqlExecutor` contract, **migrations** via
  `user_version`, full §8 schema in migration 1), `bank-repository` (**transaction** +
  **upsert-then-prune**: an interrupted save destroys nothing; dangling sample
  reference written `NULL`), `sample-repository` (files `{appDataDir}/audio/{sampleId}.ogg` +
  metadata, never BLOBs), `settings-repository` (single row `id = 0`).
- **Tauri adapters** (`storage/tauri.ts`, the only module touching the plugins, dynamically
  loaded) + **memory fallback** (`storage/memory.ts`) for the bare browser :1420
  (session only; persistent pure browser mode = v2 §17).
- **Shared write lock** (`createWriteLock`): tauri-plugin-sql's sqlx pool opens one
  connection per concurrent query — the three repositories' writes are serialized so that
  `BEGIN`/`COMMIT` stay on one connection and no writes interleave.
- **Autosave** (`persistence.ts`, decision A §9): single reactive subscriber, **400 ms
  debounce** (bank, last state wins), settings **immediate**, write queue (never concurrent,
  failure absorbed), `flush()` when going to background. Reactivity **injected** (`Watch` contract);
  runes implementation in `watch.svelte.ts` (`$effect.root`, first pass ignored).
- **Hydration at startup** (async `create-app.ts`): settings → library (+ engine buffers;
  unreadable file = no-op §12) → bank; **default bank** on first launch
  (`default-bank.ts`: 1 empty 4×4 Poly page). `main.ts` awaits the boot (`app.bootError` otherwise).
- **`Settings.svelte`**: Background behavior, Maximum voice count (≥ 1), language — persisted
  immediately. Commands `setBackgroundBehavior`, `setMaxVoices`, `hydrateSettings`.
- **Background (§12)**: `visibilitychange → hidden` applies the setting — `stopAll` (everything +
  context suspension), `stopSustained` (**sustained** Gate/Loop voices, One-Shots
  finish), `keepPlaying`. Engine: voices flagged `sustained`, `stopAll()`,
  `stopSustained()`, `suspend()`; resume on the next gesture (never automatic).
- **Import**: **immediate** disk write (outside the debounce) — file + `samples` row; new
  typed failure `writeFailed` (buffer unloaded, nothing in the library); real `createdAt`.
- Capabilities: `sql:allow-execute`, `fs:allow-appdata-write-recursive`.

### Changed
- **`deleteSample`** aligned with decision §8: after confirmation, the `sampleId` of impacted
  pads becomes **`null`** (*empty* state), mirroring `ON DELETE SET NULL` — the
  *missing* state remains for data altered outside the app. Rename/delete write
  immediately via the repository.
- **Dev seed removed** (`dev-seed.ts`): the app starts on the default, empty bank (§2).

### Tooling
- **`app-home` volume** (`docker-compose.dev.yml`): the Tauri app's data
  (`~/.config`/`~/.local/share` of the container) survives `run --rm` — without it, closing
  the `tauri dev` window took the database and library away.
- **`PULSE_SERVER`** enabled in the GUI overlay (WSLg PulseAudio socket) — prerequisite for
  sound in the dev window (full resolution tracked in backlog #3).

### Tests
- **Storage against a real in-memory SQLite** (`node:sqlite` from the container's Node 22,
  dedicated test executor, minimal ambient types — no dependency added): migrations
  (order, idempotence, CHECK, foreign keys), bank round-trip, pruning/cascades,
  `ON DELETE SET NULL`, library (file + row, failures), settings, write lock.
- Persistence with **simulated timers** (debounce, burst → one save, flush, stop, resilience);
  settings/background commands; M5 engine. Total: **128 unit + 4 E2E**.

### Fixed
- **Silent import** (nothing added, no message): `crypto.randomUUID` only exists in a
  **secure context** (https / localhost); elsewhere (http via LAN IP) the ID generation threw
  and the import was abandoned without a trace. `newId` now falls back on `crypto.getRandomValues`
  (UUID v4) — works everywhere. It was the only silent failure path; any remaining import error
  is now **displayed**.
- **Encoder**: anti-hang safety net (60 s timeout) — a worker that never yields fails
  cleanly instead of freezing the import.

### Tests
- Unit regression (`newId` without `randomUUID`) + **E2E** (import in a simulated insecure context
  via `addInitScript`). Import E2E extended to **stereo & longer WAV**. Total: 70 unit,
  4 E2E.

## [0.5.0] - 2026-07-01 — M4 (Library & import)

> **Validated on web** (real browser, E2E): import → OGG/Opus → re-decode → library, and
> playback of an assigned sample. Chain on an Android device = 2nd stage (spec §16).

### Added
- **Opus/WASM encoder** (`engine/encoder.ts`): **opus-recorder** foundation (MIT, libopus + ogg in
  WASM, embedded worker), 96 kbps; injectable `Encoder`. Emits OpusHead + OpusTags + audio.
- **Import pipeline** (`commands.importSample`): 20 MB guard → `decodeAudioData` → Opus encode →
  **re-decode safeguard** → `Sample` entry. Typed errors (`tooLarge` / `undecodable` /
  `encodeFailed`).
- **Library** (`Library.svelte`): import (File API), preview (`previewSample`), rename,
  deletion with **warning about impacted pads** (which become *missing*, §12).
- Engine: `decode` (PCM + duration) and `previewSample` (transient voice).
- **Pad state *missing*** (sample assigned then deleted) in addition to active / empty.

### Tests — E2E layer (new, lasting)
- **Playwright / Chromium** in Docker (official version-aligned image, `docker-compose.e2e.yml`,
  `npm run test:e2e`). Exercises the **real** browser: Web Audio + WASM Worker (encoder), real
  import and playback — what the Vitest mocks cannot see.
- `e2e/import.spec.ts` (real OGG/Opus encoding), `e2e/play.spec.ts` (assignment + Loop playback →
  active pad).
- `tests-gate` hook extended: runs the E2E and **blocks the commit** if a `src/`/`e2e/` file is
  touched and the E2E fails (guarantees the "broken encoder that passes the mocks" debt never
  comes back).

### Fixed
- Opus encoder: the **OpusHead/OpusTags** headers were missing (undecodable OGG) — added the
  `getHeaderPages` request. Bug invisible to the mocked tests, caught by the E2E.
- Dev: Vite HMR (`ws://0.0.0.0:1421` unreachable) → HMR on the app's port; server with
  `host: true`.

### Removed
- M3 dev loader (`DevLibrary`, `devAddSample`/`attachSampleBuffer` commands) replaced by the
  real Library + the import pipeline.

## [0.4.0] - 2026-07-01 — M3 (Editing)

> **Validated on web**: a bank can be configured from A to Z without touching the code (63 tests).
> Android validation = 2nd stage (spec §16).

### Added
- **Edit mode**: Play ↔ Edit switch, pad selection (`selectedPadId`).
- **Pad commands**: `addPad` (first free cell / given position), `renamePad`, `setPadPlayMode`,
  `setPadGainDb` (bounded [-60, +6]), `assignSample` (from the library, or clear), `deletePad`
  (stops the voice), `reorderPads` (position swap).
- **Page commands**: `addPage`, `renamePage`, `deletePage` (refuses the last one; stops +
  renumbers), `setPageVoiceMode`, `setPageGrid` (**shrink invariant**: refused if a pad
  would fall off the grid), `reorderPages`.
- **Library**: `hydrateLibrary`, and the dev bridge `devAddSample` / `attachSampleBuffer`
  (the dev loader feeds `store.samples`; replaced by the real import in M4).
- **UI**: `Editor.svelte` (page + pad settings: mode, dB gain slider, rename, assignment,
  deletion, grid resizing with guards), pad selection and "+" cells in
  `PadGrid`, page addition in `PageTabs`, Play/Edit toggle button. `DevLibrary.svelte`
  replaces the M2 loader.
- **Domain**: `id.ts` (`newId`, Web Crypto, injectable), `firstFreePosition`.

### Tests
- 63 tests (Vitest), including 16 dedicated to editing: pad/page CRUD, grid shrink
  invariant, library (dev bridge), selection.

## [0.3.0] - 2026-07-01 — M2 (Core)

> **Validated on web**: §7 behavior matrix covered by 47 tests + playable grid in dev
> (seed bank). Android validation = 2nd stage (spec §16).

### Added
- **Audio engine (M2)**: Gate (`press`/`release`), Loop (`toggleLoop` start/stop), **Mono choke**
  (starting a pad stops the page's other voices), self re-trigger, voice cap as
  **FIFO** (read from `Settings.maxVoices`), `stopPad` / `stopPage`. A voice now carries its
  `pageId`.
- **Domain**: `selectors.ts` (pure reads of the bank tree: `pagesSorted`, `padsOfPage`,
  `padAtPosition`, `findPad`, `findPage`).
- **Store**: bank tree + `activePageId` + derived `activePage` getter.
- **Play commands**: `firePad`, `pressPad`/`releasePad`, `toggleLoopPad`, `stopPad`,
  `stopPage`, `setActivePage`, `hydrateBank` (loading a bank — reused by the
  M5 persistence).
- **Input**: `pad-input.ts` (Pointer Events → intents per Play mode, `setPointerCapture`
  for Gate, safety release on detach).
- **UI**: `PageTabs` (navigation), `PadGrid` + `Pad` (`rows`×`cols` grid, active/empty state,
  playback indicator driven by `activePadIds`). Mode labels via i18n (`mode.*`).
- **Dev seed (temporary)**: `dev-seed.ts` (2 Poly/Mono pages covering the 3 modes) +
  `M2SampleLoader.svelte` (loads sounds into the slots via the File API). Replaced by
  editing (M3) / import (M4) / persistence (M5).

### Tests
- 47 tests (Vitest): bounds/invariants, selectors, One-Shot engine + §7 matrix (Gate, Loop,
  Mono choke, FIFO, stop), commands layer, `pad-input` mapping. Shared fake `AudioContext`
  (`tests/engine/fake-audio-context.ts`).

### Removed
- M1 demo harness (`M1AudioDemo.svelte` + `loadDemoSound`/`fireDemoPad` commands) replaced by
  the real grid.

## [0.2.0] - 2026-07-01 — M1 (Audio)

> **Validated on web** (1st stage): sound emitted + `resume()` in dev, tests green, `svelte-check` +
> build OK. The **validation on real Android** is the **2nd stage** (web first, Android second —
> spec §16), tracked outside this tag.

### Added
- **Audio engine** (`engine/audio-engine.ts`, Web Audio): `AudioContext` creation/resume
  (idempotent `resume()`, autoplay policy; also resumes from `interrupted`), buffer cache
  (`load` / `unload` / `isLoaded`), **One-Shot** playback (`AudioBufferSourceNode` →
  `GainNode` → output, **dB → amplitude** gain), re-tap = restart from 0 with anti-click fade
  (~8 ms), and active-voice mirror via `onPlayingChanged` (silent no-op if pad empty /
  buffer missing).
- `resumeAudio` command (resume on gesture) + **temporary** M1 demo harness
  (`loadDemoSound`, `fireDemoPad`, component `ui/dev/M1AudioDemo.svelte`): one hard-coded pad
  playing an audio file loaded via the File API (testable in bare Vite AND Tauri WebView).
- **Tests**: Vitest added; audio core suite (`voice.test.ts`, `audio-engine.test.ts`,
  18 tests) — Web Audio simulated by injection, no browser dependency.

### Tooling
- **Permanent dev** Docker container (`docker-compose.dev.yml up dev`) — Vite at
  http://localhost:1420, HMR, to watch progress continuously.
- Hook `.claude/hooks/tests-gate.sh` (PreToolUse `git commit`): warns if code is committed
  without tests, **runs the suite in Docker and blocks the commit if it fails** (project rule:
  tests written → run → validated, then doc).

### Validated (dev)
- `npm run test`: 18/18 green · `svelte-check`: 0 errors / 0 warnings · `vite build`: OK
  (all run in rootless Docker).

## [0.1.0] - 2026-07-01 — M0 (Foundation)

### Added
- Vite + Svelte 5 (runes) + **strict** TypeScript scaffold, static SPA (SSR off, no router).
- **Tauri v2** shell (`src-tauri/`, minimal Rust) + `sql`, `fs`, `dialog` plugins (config + capabilities).
- `domain / engine / storage / app / ui` tree with per-milestone stubs.
- Explicit composition root `create-app.ts` (dependency injection, no singletons).
- Reactive store (runes) + command layer (sole mutation point).
- Minimal i18n: loader + `t()`, `fr.json` (default & fallback), reactive language in the store.
- `LICENSE` GPL-3.0-or-later + SPDX headers + `README.md`; Tauri placeholder icons.

### Development environment
- **Rootless** Docker, dev/prod separated (`docker-compose.dev.yml` / `docker-compose.prod.yml`),
  hardened (`cap_drop: ALL`, `no-new-privileges`), toolchain isolated in image/volumes.
- Living doc `doc/` (separate from the specs) + **doc-sync** mechanism (`.claude/`).

### Validated
- `svelte-check` 0 errors, `vite build` OK, `t()` text present in the bundle.
- Full compilation of the Tauri shell (Rust + plugins + embedded front) in rootless Docker:
  `target/debug/sampleboard` binary produced.

### Documentation
- Technical specification locked — `specifications.md` (vocabulary, architecture, decisions).
- Roadmap & project management — `roadmap.md` (phases, milestones, versioning, backlog).
- Project onboarding — `CLAUDE.md`.
