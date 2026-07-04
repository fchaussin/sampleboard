# Sampleboard — Roadmap & project management

> Project steering: phases, milestones, tasks, versioning, backlog.
> The **technical specification** lives in [`specifications.md`](./specifications.md) (vocabulary, architecture, decisions).
> This document is **living**: tasks and backlog evolve; locked decisions, however, live in the spec.

---

## 1. Versioning — SemVer `major.minor.patch`

Starting point: **`0.1.0`**.

| Element | Rule |
|---|---|
| **`major = 0`** | As long as the app is **not stable & complete**. The data model may still change (via migrations). |
| **`minor`** (`0.x.0`) | Incremented at each **shipped milestone** (coherent, validated batch of features). |
| **`patch`** (`0.x.y`) | Fixes / adjustments **without new features**. |
| **`1.0.0`** | **NOT plannable.** Awarded when the app is **stable AND complete**: all v1 milestones done, tested on a real device, packaged and F-Droid publishable. It is a *quality criterion*, not a deadline. |
| Beyond 1.0 | New feature → `minor` (`1.1.0`…); breaking change → `major` (`2.0.0`). |

- A **`CHANGELOG.md`** (*Keep a Changelog* format) is kept up to date at every release.
- One release = one **git tag** `vX.Y.Z` once the milestone is validated.

### Eligibility criteria for `1.0.0`
- [ ] All milestones M0→M9 shipped and validated.
- [ ] Tested on ≥ 2 real Android devices (latency, autoplay, background).
- [ ] Import→Opus-encoding chain reliable on a real device.
- [ ] Robust persistence (faithful reload, tested migrations).
- [ ] i18n: at least FR complete, EN mechanics ready.
- [ ] Reproducible build + FOSS audit OK + F-Droid metadata ready.
- [ ] No open blocking bug.

---

## 2. Phases → milestones → versions

| Phase | Milestones | Target version | Goal |
|---|---|---|---|
| **A — Foundations** | M0 | `0.1.0` | The technical foundation runs. |
| **B — Playable core** | M1, M2 | `0.2.0`, `0.3.0` | We hear sound, we play the grid. |
| **C — Configuration** | M3, M4 | `0.4.0`, `0.5.0` | Pads are editable and the library is managed. |
| **D — Durability** | M5 | `0.6.0` | Everything is persisted and reloaded. |
| **D' — Interface** | M6 | `0.7.0` | Reworked UI/UX: topbar, bottombar, drawer. |
| **D'' — Audio editor** | M7 | `0.8.0` | « Découper » (trim): waveform + trimming + undo/redo. |
| **D''' — Advanced library** | M8 | `0.9.0` | Tags + filters, direct assignment, combobox. |
| **E — Delivery** | M9 | `0.10.0` | Packaged for F-Droid. |
| **E' — Web distribution** | M10 | `0.11.0` | PWA (IndexedDB), delivered via public hosting and/or Docker image. |
| **F — Stabilization** | — | → `1.0.0` | Hardening, real-device tests, completeness. |

Task statuses: `[ ]` to do · `[~]` in progress · `[x]` done.

---

## 3. Tasks per milestone

### M0 — Foundation · `0.1.0` · Phase A
- [x] Repo init + `package.json`, Vite + Svelte 5 (runes).
- [x] Strict `tsconfig.json`.
- [x] `svelte.config.js`: static SPA, SSR disabled (Vite + Svelte, no router — see note).
- [x] Tauri v2 init (`src-tauri/`), minimal Rust.
- [x] Tauri plugins: `sql`, `fs`, `dialog` (config + capabilities).
- [x] `domain / engine / storage / app / ui` tree (folders + stubs).
- [x] Composition root `create-app.ts` (explicit injection, no singletons).
- [x] Minimal i18n: `i18n/index.ts` (loader + `t()`), starter `fr.json`, `locale` rune (in the store).
- [x] `LICENSE` GPL-3.0-or-later + basic SPDX headers + `README.md`.
- [x] **Validation**: Tauri shell compiled in rootless Docker (Rust + plugins + embedded front,
  binary produced); front renders `t()` (`svelte-check` 0 errors, `vite build` OK). `tauri dev`
  window openable via the GUI overlay (WSLg).

> **Note (M0)** — `svelte.config.js`: the spec says "adapter-static / SSR off". Interpreted as
> **static Vite + Svelte 5 SPA without SvelteKit** (manual mount via `main.ts`), consistent with
> "no router" (spec §4). So there is no SSR to disable. To confirm/lock in spec §16.

### M1 — Audio · `0.2.0` · Phase B
- [x] `AudioEngine` + `AudioContext` (injectable factory for tests).
- [x] Idempotent `resume()` on first gesture (autoplay policy; also resumes from `interrupted`).
- [x] Buffer cache `load()` / `unload()` (`Map<sampleId, AudioBuffer>`) + `isLoaded()`.
- [x] `voice.ts` (active-voice structure + `gainDbToAmplitude`).
- [x] `oneShot()`: `AudioBufferSourceNode` → `GainNode` (dB→amplitude conversion) → output; re-tap = restart from 0 (anti-click fade ~8 ms).
- [x] `onPlayingChanged` callback (mirror of active voices; silent no-op if pad empty/buffer missing).
- [x] One **hard-coded** pad playing an imported buffer (One-Shot) — demo harness `M1AudioDemo.svelte` (temporary, removed in M2/M4).
- [x] **Tests**: Vitest suite for the audio core (18 tests, green in Docker) — see `doc/audio-engine.md`.
- [x] **Web validation (1st stage)**: sound emitted + `resume()` OK in dev via `M1AudioDemo` (http://localhost:1420 + desktop `tauri dev`); tests green + `svelte-check` + build.
- [ ] **Android validation (2nd stage)**: sound emitted + `resume()` on a **real device** — web first, Android second (see spec §16).

### M2 — Core · `0.3.0` · Phase B
- [x] `domain/types.ts` + `enums.ts` + `invariants.ts` + `selectors.ts` (+ pure tests).
- [x] `store.svelte.ts`: bank tree, `activePageId`, `editMode`, `activePadIds` (+ `activePage` getter).
- [x] `commands.ts` — play: `firePad`, `pressPad`/`releasePad`, `toggleLoopPad`, `stopPad`, `stopPage` (+ `hydrateBank`, `setActivePage`).
- [x] `pad-input.ts`: Pointer Events → intents per Play mode (+ `setPointerCapture` for Gate, safety release on detach).
- [x] Multi-page + `PageTabs` (navigation); `PadGrid` + `Pad` (`rows`×`cols` grid, active/empty state).
- [x] 3 Play modes (One-Shot / Gate / Loop).
- [x] Mono/Poly polyphony: Mono choke, self re-trigger.
- [x] `maxVoices` as FIFO (internal, cap read from settings).
- [x] **Tests**: 47 tests (domain, M2 engine, commands, pad-input), green in Docker.
- [x] **Web validation (1st stage)**: §7 matrix covered by the tests + playable grid (dev seed bank) at http://localhost:1420. Android = 2nd stage (see §16).

### M3 — Editing · `0.4.0` · Phase C
- [x] `toggleEditMode` + Edit ↔ Play switch (pad selection `selectedPadId`).
- [x] Pad commands: `addPad`, `renamePad`, `setPadPlayMode`, `setPadGainDb`, `assignSample`, `deletePad`, `reorderPads`.
- [x] Page commands: `addPage`, `renamePage`, `deletePage`, `setPageVoiceMode`, `setPageGrid`, `reorderPages`.
- [x] `Editor.svelte`: Play mode, gain (dB slider), rename, assignment, deletion; page settings.
- [x] Resizable `rows`×`cols` grid + shrink invariant (shrink refused if a pad would fall off the grid).
- [x] Assignment from the library (Editor selector); dev loader `DevLibrary` feeds `store.samples` (bridge to M4 import).
- [x] **Tests**: 63 tests (including 16 dedicated to editing), green in Docker.
- [x] **Web validation (1st stage)**: configure a bank from A to Z without touching the code, at http://localhost:1420. Android = 2nd stage (§16).

### M4 — Library & import · `0.5.0` · Phase C
- [x] `engine/encoder.ts`: **WASM libopus** via opus-recorder (embedded worker, OpusHead/Tags + audio, 96 kbps), injectable `Encoder`. _(opportunistic WebCodecs fallback: not required, later; build-from-source → M6)_
- [x] Import pipeline: 20 MB validation → `decodeAudioData` → `durationMs` → Opus 96 kbps encode → re-decode safeguard → library entry. _(source via File API; `dialog`/`fs` + disk write `{sampleId}.ogg` → **M5** with persistence, Tauri-only)_
- [x] `Library.svelte`: import, `label` rename, deletion (warning about impacted pads), **preview**.
- [x] `assignSample` from the library (selector in the Editor).
- [x] Pad states: *active / missing / empty*.
- [x] **E2E tests (Playwright/Chromium)**: real Opus encoder + import + playback — the missing layer (encoder debt resolved).
- [x] **Web validation (1st stage)**: decode→encode→re-decode chain reliable in a real browser (E2E). Chain on a **real Android device** = 2nd stage (§16).

### M5 — Persistence & settings · `0.6.0` · Phase D
- [x] `db.ts`: `SqlExecutor` contract + migrations (`user_version`) + shared write lock
  (plugin's sqlx pool: a single logical write at a time, safe transactions).
- [x] Full SQLite schema (`bank`, `pages`, `samples`, `pads`, `settings`) — migration 1.
- [x] `BankRepository` (transaction, upsert-then-prune), `SampleRepository` (files
  `{appDataDir}/audio/` + metadata), `SettingsRepository` (single row); Tauri adapters
  (`storage/tauri.ts`, sql + fs, extended capabilities) and **memory fallback** for the
  bare browser (`storage/memory.ts`, session only).
- [x] `persistence.ts`: 400 ms debounced autosave (bank) + immediate writes (import,
  settings) + `flush()` when going to background. Injected reactivity (`watch.svelte.ts`).
- [x] `Settings.svelte`: Background behavior, Maximum voice count, language (`setLocale`).
- [x] Applying `backgroundBehavior` on lifecycle (visibilitychange): `stopAll` /
  `stopSustained` (sustained Gate/Loop voices) / `keepPlaying`; engine `stopAll`,
  `stopSustained`, `suspend`.
- [x] Store hydration at startup (settings → library + buffers → bank; default bank
  on first launch). Dev seed removed.
- [x] **Tests**: 128 unit (including storage against a **real SQLite** via `node:sqlite`,
  persistence with simulated timers) + 4 E2E, green in Docker; build + `cargo check` OK.
- [x] **Validation (`tauri dev` window)**: close/reopen → faithfully reloaded. Required
  two environment fixes (`app-home` volume — the `--rm` container took the database away;
  `PULSE_SERVER` WSLg). Persistence verified by probe: default bank written by the plugin's
  real transaction then re-read from another container. **Sound in the WSLg window
  still muted** (non-ideal environment) → tracked in backlog (Incoming #3), to
  re-fix before/during M6; audio on Android device = 2nd stage (§16).

### M6 — Interface · `0.7.0` · Phase D'

> From backlog triage #2 (2026-07-02). Locked decisions: full bottombar (Play ↔ Edit
> switch, global Stop, Library, quick Import, pages, general Settings access);
> library as **full-screen panel**; pad drawer opened **in Edit mode only**
> (in Play, a tap plays); page/Settings drawers accessible in both modes.

- [x] UI state: `drawer` (`'pad' | 'page' | 'settings' | null`) + `libraryOpen` in the store;
  commands `openPadDrawer` / `openPageDrawer` / `openSettingsDrawer` / `closeDrawer`,
  `openLibrary` / `closeLibrary`, `stopAllVoices` (bottombar panic).
- [x] `Topbar.svelte`: active page info (name/number, Edit chip, Polyphony, grid)
  → tap = page drawer.
- [x] `Bottombar.svelte`: Play ↔ Edit switch, global Stop, pages (scrollable + add in
  Edit), quick Import (errors via snackbar), Library, Settings. Inline SVG icons
  (`Icon.svelte`, zero dependencies).
- [x] `Drawer.svelte` (right, with veil): contents `PadSettings` / `PageSettings` /
  `Settings` (general settings); close ✕ / tap outside.
- [x] `LibraryPanel.svelte`: library as full-screen panel (content `Library`).
- [x] `Editor.svelte` split → `PadSettings.svelte` + `PageSettings.svelte` (drawer);
  `PageTabs` absorbed by the bottombar; shared import helper (`ui/import-file.ts`).
- [x] Pad in Edit mode: tap → pad drawer; "+" cell: creation + drawer; deleting the selected
  pad → close; mode change → close.
- [x] Global aesthetic pass: palette (`--panel`/`--border`/`--danger`), touch targets
  ≥ 44 px, full-screen centered grid `100dvh`, Android safe-areas, shared drawer
  form (`.drawer-form`).
- [x] i18n: new keys (bottombar, drawer, library panel).
- [x] **Colors** (2nd pass, requests from 2026-07-02): `color` prop (token) on pages and
  pads — homogeneous **OKLCH** palette (8 hues, `--c-*` in app.css), shared `ColorPicker`,
  tinted tabs and pads, **migration 2** (`color` columns), unknown tokens neutralized.
- [x] **Default names**: default bank page « Principal » (Main), added pages
  « Page N » (i18n generators injected from the bootstrap, §4); an unnamed pad takes the
  label of the assigned sample (extension removed, clipped to 12 characters).
- [x] **Sample picker modal** (`<dialog>`, `SamplePicker`): list + preview +
  "none" + direct import (imported → assigned). Overlay stacking formalized:
  layer 0 app / layer 1 drawer & panel (`--z-*`) / modals in native top-layer (opening
  order makes the stack — ready for the crop modal, backlog #4).
- [x] **Library**: displayed metadata (size MB, duration s — `Intl.NumberFormat`). LUFS →
  backlog #7.
- [x] **1×1 grid**: widened bounds (`rows [1,12]`, `cols [1,6]`) — **migration 3**
  (`pages` rebuild, SQLite procedure, FK cascade verified); spec §2/§6/§8/§16 updated.
- [x] **Complete board from init** (3rd pass, decision §16): `BankFactory` (injected class,
  OO style) — colored « Principal » page and FILLED grid on first launch, added pages
  complete, grid enlargement backfilled, every pad colored (palette cycle
  by position). Pad style: solid outline + transparent tinted background; name above the mode
  (bold if assigned, semi-transparent italic if empty; distinct placeholders « (vide) » (empty) /
  « (sans nom) » (unnamed)). `color` required (`Color | null`, a single representation of absence),
  typed `PadStatus`.
- [x] **Fully adaptive grid**: pads occupy ALL available space (1fr tracks,
  no more square ratio or capped width).
- [x] **Per-pad stop**: prominent button at the bottom right of the pad during playback
  (One-Shot/Loop — Gate stops on release), covered in e2e.
- [x] **Chained creation**: adding a page ("+" bottombar button, Edit mode) opens the
  new page's properties drawer (like pad creation).
- [x] **Playback state reflected by intensity**: playing pad = solid background + halo,
  instant rise / soft decay; assigned 45 %; empty ones receded.
- [x] **Visualizers** (backlog #9 integrated): `AnalyserNode` per voice (engine `waveform()`,
  `progress()`, cached `peaks()`) — in the playing pad, **file-waveform-shaped
  progress** (static peaks, played part solid / rest dimmed); **global multi-voice
  visualizer in the topbar** (one real-time wave per voice, in the pad's color) with
  **contextual global Stop** next to the waves.
- [x] **Tests**: 156 unit + 4 e2e adapted (modal, drawer, global Stop), green in Docker.
- [x] **Web validation (1st stage)**: full journey covered in e2e (import → drawer →
  modal → play → stop) + 390×844 screenshots reviewed. Android/fastlane screenshots next (M7).

### M7 — Audio editor (« Découper », trim) · `0.8.0` · Phase D''

> Triage of 2026-07-02: backlog #4 + #5 pulled back from v2 into v1 (decision locked in spec §16).
> Dedicated full-screen view, opened on import (from the modal/library) and from an
> existing library sample (rework → re-encode).

- [x] `engine`: trimming of the decoded PCM BEFORE Opus encoding (pure `engine/pcm.ts`: `trimPcm`,
  `clampSelection` — min duration 10 ms, `computePeaks` shared with `engine.peaks`, DRY);
  PCM preview (`previewPcm`/`stopPcmPreview`).
- [x] **Waveform** rendering (canvas, cached per-slice peaks) of the decoded PCM.
- [x] Full-screen `AudioEditor` view (`<dialog>` top-layer, above the sample modal):
  waveform + **start/end handles** (pointer, nearest handle), solid vs dimmed selection,
  displayed times, preview, confirm/cancel (failure → editor stays open + message).
- [x] **Undo/redo**: `SelectionHistory` (OO class §16), one step per handle release.
- [x] Wiring: **every import opens the editor** (quick Import, Library, sample
  modal — pad to assign remembered) + « ✂ Découper » (trim) entry on each sample
  (`beginSampleRework`: re-decodes the OGG → editor → re-encode, id/file preserved,
  `SampleRepository.replace`, best-effort restore on failure). `durationMs`
  now derived from the PCM.
- [x] i18n + **tests**: 197 unit (pcm, history, editor flow, replace) + **6 e2e**
  (real handle drag, undo, reduced persisted duration, rework), green in Docker.
- [x] **Web validation (1st stage)**: complete e2e journeys (import → trim → play;
  reopen and re-trim) + screenshot reviewed. User visual verdict before tag.

### M8 — Advanced library · `0.9.0` · Phase D'''

> Triage of 2026-07-02: backlog #10+#11+#12. Locked decisions: tags = n-to-n DATA
> (`tags` table + `sample_tags` join, migration 4), default list SEEDED on first
> launch (SFX, Répliques, Jingle, Musique, Ambiance, Voix, Réaction, Meme, Alerte —
> injected i18n labels, then fully customizable); **« Non classé » (Unclassified) = VIRTUAL
> filter** (samples without tags, never stored — a single representation of absence).

- [x] `Tag` domain + migration 4 (`tags`, `sample_tags`, cascades); `TagRepository`
  (tag CRUD + assignments, idempotence) SQL/memory/fake; seeding of the 9 default tags
  on first launch ONLY.
- [x] Store (`tags`, `sampleTags`, `libraryFilter`) + commands (tag CRUD — deletion prunes
  assignments and filter —, tag↔sample toggle with « Non classé » = absence of entry,
  filter); shared pure `app/tag-filter.ts`.
- [x] Library: chip filter bar (« Tous » (All) + tags + « Non classé »), expandable row per
  sample (toggleable tag chips), tag management in `<details>` (create/rename/delete).
- [x] #11: **ON-THE-FLY assignment** (user feedback: selects were too
  rigid) — "Assign to pads" arms the sample, the panel closes, EACH touched pad
  receives it (all pages), banner + Done.
- [x] #12: sample picker modal = combobox (text search + tag filter, local).
- [x] **Pool** (user feedback): working list of samples in a LEFT DRAWER
  (session) — "Add to pool" from the library, touching an item arms it for
  on-the-fly assignment, the drawer stays open. Tag management MOVED into a
  « Gérer les tags » (Manage tags) modal (panel header, exit the <details>).
- [x] Bonus: MULTI-PAGE init bank with contrasting layouts (4×4, 2×2, 8×6); global
  visualizer with IDLE animation (slow sine waves); **shipped purple Edit mode, Ableton
  MIDI-map style** (unmissable mode); locked conventions (CSS without px except borders,
  standard UI elements).
- [x] #13: **Multiple import & archives** (user request 2026-07-02) — multi-file
  selection on import inputs + **zip/rar** archives unpacked via **libarchive
  WASM** (`libarchive.js` MIT / libarchive BSD, clean-room rar readers — official unrar
  rejected: non-free license, blocking for F-Droid, decision §16). ONE audio file → editor
  (M7 flow); otherwise **direct batch** with **progress modal** (bar, per-file status,
  interruption, failure aggregation). Worker+wasm assets served at a stable path
  (Vite plugin). 11 unit tests (batch, archives, interruption).
- [x] i18n + **tests**: 207 unit + **8 e2e** (tags/filters/« Non classé »/direct
  assignment/search), green in Docker.
- [x] **Web validation (1st stage)**: complete e2e journeys + screenshots reviewed. User
  visual verdict before tag.

### M9 — Packaging · `0.10.0` · Phase E

> Started early (2026-07-02) then suspended in favor of M6/M7: the fastlane screenshots
> depend on the final UI.
- [x] Android build (APK): pinned Docker toolchain (`docker-compose.android.yml`),
  `tauri android init` (`gen/android` project committed), **debug** APK (154 MB) and **unsigned
  release** (8.7 MB, aarch64) produced. Verified with aapt: `versionCode 6000` /
  `versionName 0.6.0`, **zero permissions** (INTERNET relegated to the debug overlay, §16),
  minSdk 24. Signing = F-Droid (or a local key to create for direct distribution).
- [x] FOSS audit of **all** dependencies (npm 5 runtime packages, 467 Rust crates,
  Gradle AndroidX/Material): zero proprietary, zero Play Services — see `doc/foss-audit.md`.
- [~] Reproducible build: pinned toolchain ✓; **WASM from-source ✓ (2026-07-04)** —
  opus encoder (opus-recorder v8.0.5, libopus/speexdsp by SHA, emsdk 3.1.26) and libarchive
  extractor (v2.0.2, 5 source tarballs verified SHA-256, emsdk 3.1.45) rebuilt in
  Docker (`scripts/build-*-wasm.sh`) and vendored under `src/vendor/` with PROVENANCE.md —
  the pre-compiled WASM from the npm packages is no longer used at runtime. Remaining: APK determinism.
- [x] Complete SPDX headers + license compliance (audit: 1 missing fixed, 100 % covered).
- [x] F-Droid metadata (fastlane): FR/EN descriptions ✓; changelogs per versionCode
  (6000/8000/9000, FR+EN) ✓; screenshots ✓ — 5 REPRODUCIBLE fr-FR phoneScreenshots
  (`e2e/screenshots.fastlane.spec.ts`, `FASTLANE_SHOTS=1`, 393×852 @3x: seeded board,
  Loop playback, library, editor, Edit+drawer), regenerated after #22/#23
  (library = view, screenshot 5: wait for the drawer animation to finish) and **re-validated
  by the user on 2026-07-04**. (To regenerate before submission if the UI still evolves.)
- [ ] F-Droid submission (RFP / metadata merge request).
- [ ] **Validation**: installable APK, app functional without Play Services.

### M10 — Web distribution · `0.11.0` · Phase E' _(after M9 — §16 decision of 2026-07-04)_
- [ ] **IndexedDB repositories**: web implementation of `storage/types.ts` (bank, samples,
  settings, tags + audio bytes) — selected when the Tauri runtime is absent, in place
  of the memory mode (which remains the test stand-in). Minimal IDB migrations/versioning.
- [ ] **PWA**: `manifest.webmanifest` + icons (reuse those from `src-tauri/icons`),
  offline service worker (app shell + factory samples), installability verified.
- [ ] **Docker delivery** (a delivery mode for the PWA, not a separate distribution —
  §16 decision): static-server image (nginx or equivalent) serving the web build;
  dedicated service `docker-compose`, distinct from the "prod" compose (which builds).
- [ ] **Public web hosting** of the PWA (address to choose — may follow the repo
  hosting choice).
- [ ] **Validation**: full cycle in browser (import → config → faithful reload),
  PWA offline, Docker image served locally.

### Phase F — Stabilization · → `1.0.0`
- [ ] Tests on multiple real devices (latency, autoplay, sleep).
- [ ] Perf: polyphony, trigger latency.
- [ ] i18n: FR complete, EN as reference.
- [ ] Backlog bug burn-down.
- [ ] Review of §1 criteria → tag `v1.0.0`.

---

## 4. Backlog — features to triage

> Every new idea lands here first (status **To triage**), then receives a **target** (a v0.x `minor`, v2, or *rejected*) at a triage session. Nothing goes into dev without passing through the backlog.

### v2 (post-1.0, known — from spec §17)
- [ ] Sample **cutting/trimming** (« découper »: trim, excerpt selection at import).
- [ ] **Multi-bank** (several banks, switching; schema already ready).
- [ ] Intermediate **"pool"** container (library ↔ bank) — to evaluate.
- [ ] Keyboard shortcuts.
- [ ] Sample recording (microphone).
- [ ] Effects: master volume, fade, pitch.
- [ ] Waveform display.
- [ ] Advanced drag-and-drop reordering.
- [ ] MIDI.
- [ ] Pure browser mode (web implementation of the repositories).
- [ ] Bank export/import (portable file).
- [ ] **Import by URL** — import a sample from a URL (reuses the import pipeline; `Content-Length` limit configurable via `.env`, shared between local and URL import). Network access **requested on the fly** (just-in-time authorization at trigger, no permanent permission) → F-Droid impact. _(triaged 2026-07-01)_
- [ ] iOS.

### Incoming — to triage

| # | Feature | Described on | Proposed target | Status |
|---|---|---|---|---|
| 1 | Visual flagging of a sample whose **disk file has disappeared** (today: sample listed, pad muted no-op — see M5 doc) | 2026-07-02 | — | To triage |
| 2 | **UI layout overhaul**: *bottombar* (main actions + pages + general Settings access); *topbar* (important page info); contextual *drawer* on the right (page & pad settings). Spec refined on 2026-07-02 (see milestone M6). | 2026-07-02 | `0.7.0` | **Planned → M6** |
| 3 | **Dev env fix**: muted sound in the `tauri dev` window under WSLg despite `PULSE_SERVER` (diagnose WebKitGTK/GStreamer/Pulse — cookie? sink?). Does not affect the Android target. | 2026-07-02 | — | To triage |
| 4 | **Audio editor (waveform + crop at import)**: on upload, display the waveform with a trimming UI (start/end) before encoding, in a **dedicated full-screen view** (LibraryPanel-style). ⚠️ This is the « **découper** » (trim) + waveform classified v2 in spec §17 — pulling them back into v1 = decision to lock in spec §16/§17. Big chunk: dedicated milestone proposed after M6. | 2026-07-02 | `0.8.0` | **Planned → M7** |
| 5 | **Undo/redo in the trim editor**: action history (start/end) in the crop UI (#4). Depends on #4. | 2026-07-02 | `0.8.0` | **Planned → M7** |
| 6 | **ID3 title at import**: read the source file's tags (ID3 & co) to initialize `label` (otherwise filename). Also improves the default pad name. | 2026-07-02 | — | To triage |
| 7 | **Sample LUFS level**: measure the integrated loudness (ITU-R BS.1770) on the PCM at import, persist it (migration: `loudness_lufs` column) and display it in the library. (Name/size/duration: already displayed since M6.) | 2026-07-02 | — | To triage |
| 8 | **Loudness normalization**: bring samples to a target LUFS level (global setting?) — gain offset derived from measurement #7, applied to the GainNode (non-destructive) or to the PCM before encoding. Depends on #7. | 2026-07-02 | with #7 | To triage |
| 9 | **Audio visualizer in the topbar (Play)**: **one wave per active voice, colored by the pad's color** — `AnalyserNode` per voice (engine) + compact canvas rendering in the top bar. | 2026-07-02 | `0.7.0` | **Integrated → M6** |
| 10 | **Sample tags**: assign free tags to samples (schema: `tags` table + join → migration) and **filter the library** by tags. | 2026-07-02 | `0.9.0` | **Planned → M8** |
| 11 | **Page→pad assignment from the library**: from a sample, directly choose a target page and pad (without going through the pad drawer). | 2026-07-02 | `0.9.0` | **Planned → M8** |
| 12 | **Sample combobox in the pad drawer**: browse/filter samples (search + tags #10) from the pad settings, complementing/replacing the current modal. | 2026-07-02 | `0.9.0` | **Planned → M8** |
| 13 | **Multiple import & archives**: multi-file selection + zip/rar archives (libarchive WASM, §16 decision), direct batch without editor, progress modal (bar, per-file status, interruption). | 2026-07-02 | `0.9.0` | **Integrated → M8** |
| 14 | **Factory samples**: library pre-filled on **first launch only** (same guard as bank/tags: they never grow back). **Shipped on 2026-07-03 (off-milestone, on request)**: 78 OGG/Opus (18.3 MB) + curated `manifest.json` (labels, factory tags) in `public/factory-samples/` (injected into EVERY dist), **build-time validation** (Vite plugin: manifest ↔ files, OGG only, build fails if inconsistent), seeding without re-encoding (`seedFactorySample`), `board` selection pre-assigned to the « Principal » page (16 pads, 2 Loop). Tests: 13 unit + 1 e2e. **Bank REPLACED on 2026-07-04 (§16 decision): 25 reference sounds exclusively CC0 Freesound** (1.5 MB vs 18.3 MB), `source` + `license` traced for each entry — **the F-Droid license blocker is lifted**; remaining: listening validation by the user (per-unit replacements via `scripts/freesound-rebank.mjs`). Fix 2026-07-04: the seeding **froze** under autoplay policy without a gesture (`decodeSource` awaited `engine.resume()`, never resolved before a gesture) → no more resume in decoding, regression test (see factory-samples doc). | 2026-07-03 | — | Shipped (licenses remaining) |
| 17 | **Bootstrap tests (`create-app.ts`)**: the `firstLaunch` guard (bank/tags/factory seeding "first launch only", never re-seeded on an existing database), the hydration → autosave → seeding order and the buffer loading at boot have NO unit tests (covered only by the `factory-seed` e2e). Blocked by the environment: `create-app.ts` touches `document` → requires jsdom/happy-dom (absent from devDeps) or extracting the bootstrap core into a pure node-testable function. Identified by the 2026-07-03 review. | 2026-07-03 | — | To triage |
| 15 | **Library search + ergonomics**: text field (on the label, case/spaces ignored) **combined (AND)** with tag filters, **sticky toolbar** (import + search + filters visible while scrolling), distinct "no results" state with a **Show all** button. Reuses `filterSamples` (picker search #12); `.search` style shared in `app.css`. **Adaptive layout** (media queries): card grid ≥ 48rem, actions under the name in narrow, targets ≥ 44 px on touch. **Shipped on 2026-07-03 (off-milestone, on request)** — 6 unit (`tag-filter.test.ts`) + 1 e2e; along the way, fix of the `factory-seed` e2e timeout (30 s < seeding ~48 s). | 2026-07-03 | — | Shipped |
| 16 | **Stoppable preview + master bus**: ▶ toggles to ■ during playback, re-tap or **any other action** = stop; ONE unified behavior (library, sample modal, editor — `#playPreview`/`stopPreview` core, shared `PreviewButton` component); **master bus** `gain → analyser → destination` = single passage point for all sound (voices + previews, `masterWaveform` for a global visualizer); shared test `fakeEngine` (7 duplicates removed). Decisions locked in spec §16. **Shipped on 2026-07-03 (off-milestone, on request)** — then **code review (10 findings)**: 2 synchronization bugs fixed (launch failure → orphan sound; `onEnded` guard by source identity), the "any action stops" rule now **mechanical** (`PREVIEW_STOPPING_COMMANDS` list + generic test), master analyser as lazy tap (zero rendering cost), synchronous disconnect on stop, shared `.icon-action` styles (app.css). 283 unit + 13 e2e. | 2026-07-03 | — | Shipped |
| 18 | **Pool reworked (Edit, sidebar, DnD)**: the pool becomes an **Edit-only** tool — **always-on sidebar** in flow on wide screens (≥ 48 rem, no button, no closing), button-driven **left drawer** (bottombar, Edit) in narrow, floating above the open library (`--z-pool`) for dropping. **Drag and drop**: library row → pool, pool item → pad (immediate assignment) — shared module `ui/interaction/sample-dnd.ts`; the "arm then touch" touch path remains the mobile route. Header: **Add** (opens the library) + **Clear** (`clearPool`, disarms if the armed sample came from the pool). Decision locked in spec §16. **Shipped on 2026-07-04 (on request)** — 1 unit (`clearPool`) + adapted e2e + 1 DnD e2e (both directions). Detail shipped afterwards: **hand** cursor (`grab`/`grabbing`) on draggable items. | 2026-07-04 | — | Shipped |
| 19 | **Library cards: waveform + preview progress**: static sample peaks on each card/row (`SampleWaveform.svelte`, shared `drawPeakBars` drawing with the pad — DRY), fill of the played part during preview (`engine.previewProgress()`, new API). rAF only during the preview of the affected card. **Shipped on 2026-07-04 (on request)** — 1 unit (previewProgress). | 2026-07-04 | — | Shipped |
| 20 | **Tag management in the right drawer**: the « Gérer les tags » (Manage tags) modal becomes a view of the contextual drawer (`TagSettings`, `drawer='tags'`, `openTagsDrawer` — registered in `PREVIEW_STOPPING_COMMANDS`). The drawer moves above the library panel (`--z-drawer: 27`): the list and filters update behind, live. `TagManager.svelte` (dialog) removed. **Shipped on 2026-07-04 (on request)** — 1 e2e (create from the drawer, filter visible behind). | 2026-07-04 | — | Shipped |
| 21 | **Quick preview from the pool**: shared `PreviewButton` (▶/■) at the head of each item + **progress waveform behind the label** (`SampleWaveform` as absolute background — the component now fills its container, size set by the host). Same unified preview mechanics (#16): any other action stops. **Shipped on 2026-07-04 (on request)** — pool e2e extended (▶ active, arming stops). | 2026-07-04 | — | Shipped |
| 22 | **Library = layout view** (no more popin): `libraryOpen` switches the content of `<main>` (grid ↔ library) — topbar (view title, visualizer/Stop kept) and bottombar remain accessible (global Stop, mode switch, pages). Removes the special overlays (`--z-panel`, pool floating above the library, `--z-drawer` 27): in wide Edit mode, the pool sidebar is IN FLOW next to the library (natural dnd). Supersedes the M6 "full-screen panel" decision (§16). Edit UX unchanged (purple, pad drawer, on-the-fly) — verified by e2e + screenshots. **Shipped on 2026-07-04 (on request, design validated in discussion)**. | 2026-07-04 | — | Shipped |
| 23 | **URL-driven navigation**: the displayed view becomes a projection of the URL (invariant: never an independent variable — `store.view` replaces the `libraryOpen` boolean). `view → component` table (App.svelte), resolution with board default (`app/navigation.ts`), dynamic rendering, bidirectional sync (init/`hashchange`/back-forward ↔ URL writing only, `app/router.ts` + `applyRoute` sole writer of the view). Parameters locked in spec §16: **`#` fragment + deliberate history** (push flagged `history.state` / `replace` for adjustments / pop — the ✕ and the Android back gesture pop the same entry); **view + parameters cardinality** (`#/library?tag=…`, the filter travels in the URL). **Shipped on 2026-07-04 (on request)** — 15 unit (navigation + router, fake window) + 2 commands + 1 e2e (hash, filter, browser back, ✕). Same-day fix: **stale `?tag=` filter sanitized** (`hydrateTags`/`applyRoute` → « Tous » (All), URL corrected) — reloading a tab left on an old `?tag=` (ids regenerated in memory dev) emptied the library, factory samples "lost"; +4 unit +1 e2e. | 2026-07-04 | — | Shipped |
| 24 | **Preview in the topbar visualizer**: the preview's wave (library, pool, editor — everything sounding on the main out) is displayed in the **accent** color alongside the voice waves. `engine.previewWaveform()`: analyser tap as a **lazy branch** (created at the first render that consumes it, a new playback reattaches to the same tap — same rule as the master analyser). **Shipped on 2026-07-04 (on request)** — 1 engine unit + visual check. | 2026-07-04 | — | Shipped |
| 25 | **Two distributions**: Android/F-Droid (M9) + **web/PWA** (persistence **native IndexedDB** — web implementation of the repositories, NO SQLite WASM). The **Docker image** is not a separate distribution: it is a **delivery mode** of the web/PWA on a server (same static build). Decision locked in spec §16; "pure browser mode" pulled back from v2 → **M10 — Web distribution** (`0.11.0`), carried out AFTER M9. | 2026-07-04 | `0.11.0` | **Planned → M10** |

---

## 5. Process (lightweight)

- **One task = one checkbox** attached to a milestone; **one milestone = one `minor`** version.
- **New feature while dev is in progress** → row in *Backlog › Incoming* (status *To triage*), never quietly slipped into an ongoing milestone. At triage: either a future `minor`, or v2, or rejected.
- **Fix** found during a milestone → handled within the milestone (released as `patch` if already shipped).
- **End of milestone**: check the tasks, update `CHANGELOG.md`, tag `vX.Y.Z`.
- **Structuring decisions** are locked in `specifications.md` (§16), not here.
