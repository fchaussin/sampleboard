<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Tests

**Project rule:** for each feature, the necessary tests must be **written → run →
validated (green)**, and *only then* is the documentation updated.

## Two levels

**1. Unit — [Vitest](https://vitest.dev)** (Vite-native, TS). Pure core (`domain` / `engine` /
`app`), Node environment: fast, deterministic. Web Audio is **faked by injection**
(a fake `AudioContext` via `AudioEngine({ createContext })`). Files in the dedicated directory
`tests/**/*.test.ts` (config `vitest.config.ts`).

**2. E2E — [Playwright](https://playwright.dev) / Chromium** in a **real browser**. Covers
what mocks CANNOT see: real Web Audio, **the Opus encoder's WASM Worker**, real
import. This is the lesson from a concrete debt: a broken encoder (missing OGG headers) **passed**
the mocked unit tests — only a real browser caught it. Files `e2e/*.spec.ts` (config
`playwright.config.ts`); Playwright starts Vite itself.

## Running (in rootless Docker — zero host dependency)

```bash
# Unit tests
docker compose -f docker-compose.dev.yml run --rm dev npm run test        # (test:watch for watch mode)
# Types + build
docker compose -f docker-compose.dev.yml run --rm dev npm run check
docker compose -f docker-compose.dev.yml run --rm dev npm run build
# E2E (image officielle Playwright, navigateurs préinstallés)
docker compose -f docker-compose.e2e.yml run --rm e2e
```

Full validation of a feature = unit + `check` + `build` + **E2E** all green. For any
feature touching the browser (audio, encoder, UI), E2E is **mandatory** (mocks are not
enough).

## Automatic guard: `tests-gate`

`.claude/hooks/tests-gate.sh` (`PreToolUse` hook on `git commit`) enforces the rule:

1. **Presence** *(non-blocking)* — implementation code committed without any test → warns.
2. **Unit** *(blocking)* — Vitest in Docker; failure → commit refused (`exit 2`).
3. **E2E** *(blocking if browser code is touched)* — if `src/` or `e2e/` files are committed
   and the Playwright image is present, runs the E2E suite; failure → commit refused. Image
   missing or Docker unavailable → warns without blocking (to validate manually).

Complements the `doc-sync` hook (reminder to update `doc/`). Both are declared in
`.claude/settings.json`.

## Current coverage (M1 → M8 in progress) — 283 unit + 13 E2E

> List below non-exhaustive for M8 (tags, multiple import, factory samples) — see
> `doc/library-import.md` and `doc/factory-samples.md`.

- `tests/engine/voice.test.ts` — dB gain → amplitude conversion (bounds, -60 dB floor,
  monotonicity).
- `tests/engine/audio-engine.test.ts` — context & autoplay (idempotent `resume`, `state`), cache
  (`load` / `unload` / `isLoaded`), One-Shot, voice reflection (`onPlayingChanged`).
- `tests/engine/audio-engine.m2.test.ts` — §7 matrix: Gate (press/release), Loop (toggle),
  Mono choke, FIFO ceiling, `stopPad` / `stopPage`.
- `tests/domain/invariants.test.ts` — gain/grid bounds, `padsFitGrid`.
- `tests/domain/selectors.test.ts` — derived reads of the bank tree.
- `tests/app/commands.test.ts` — pad/page resolution + delegation to the engine (fake store &
  engine).
- `tests/app/commands.edit.test.ts` — M3 editing: pad/page CRUD, grid-shrink invariant,
  selection.
- `tests/app/commands.library.test.ts` — M4/M5 import: pipeline (size/decode/encode/
  disk write), preview, rename, delete (pads → `sampleId` null, §8), write failures.
- `tests/ui/pad-input.test.ts` — Pointer Events mapping per Play mode (fake element).
- `tests/engine/audio-engine.m5.test.ts` — Background-related stops: `stopAll`,
  `stopSustained` (sustained voices vs One-Shot), `suspend`.
- `tests/app/commands.settings.test.ts` — M5 settings (`maxVoices` bounds, hydration) +
  `applyBackgroundBehavior`.
- `tests/app/persistence.test.ts` — autosave: debounce, burst → one save, flush, stop,
  resilience to failures (fake reactivity, fake timers).
- `tests/app/commands.ui.test.ts` — M6 interface (§11): contextual drawer (pad in Edit
  only, page, settings, closings), library panel (one overlay at a time),
  Stop all.
- `tests/engine/pcm.test.ts`, `tests/app/selection-history.test.ts`,
  `tests/app/commands.audio-editor.test.ts` — M7: pure trimming/peaks/bounds, undo/redo
  history, complete editor flow (import/rework, failures, restoration).
- `tests/storage/db.test.ts`, `bank-repository.test.ts`, `sample-settings-repository.test.ts`,
  `write-lock.test.ts` — storage layer against a **real in-memory SQLite** (`node:sqlite`):
  migrations, bank round-trip (upsert/prune, cascades, `ON DELETE SET NULL`), library,
  settings, write lock. Utilities: `node-sqlite-executor.ts`, `node-sqlite.d.ts`.
- `tests/app/tag-filter.test.ts` — library text search (`filterSamples`):
  case/whitespace, AND combination with the tag filter and « Non classé » (untagged).
- `tests/engine/fake-audio-context.ts` — shared fake `AudioContext` (utility, not a test).
- `tests/app/fake-sample-repository.ts` — shared fake library repository (utility).
- `tests/app/fake-engine.ts` — **SHARED fake engine** for the command tests (overridable
  superset — replaces the seven duplicated local `fakeEngine`s, DRY).
- `tests/engine/audio-engine.preview.test.ts` — unified preview (sample/PCM, replacement,
  `stopPreview` with synchronous disconnection, `false` contract on empty selection) + **`onEnded`
  guard by source identity** (the late onended of a stopped/replaced playback — even
  of the same sample — does not notify) + **master bus topology** (voices and previews →
  master → destination, never `destination` directly; `masterWaveform` analyser as a
  lazy side-tap).
- **Rule "every action stops the preview": GENERIC test** (commands.library.test.ts)
  that iterates the exported list `PREVIEW_STOPPING_COMMANDS` — forgetting a call is impossible
  (mechanical application), forgetting to register in the list is visible in review via this test.
  Background is covered for ALL THREE settings (commands.settings.test.ts).

**E2E (real browser):**

- `e2e/import.spec.ts` — WAV import → **real OGG/Opus** (WASM encoder) → re-decode → library
  entry.
- `e2e/play.spec.ts` — import → assignment to a Loop pad → playback → *active* pad (real Web Audio
  engine + real `activePadIds` reflection).
- `e2e/audio-editor.spec.ts` — M7: handle trimming (real drag), undo, reduced persisted
  duration, rework of an existing sample.
- `e2e/library-tags.spec.ts` — M8: tags/filters, on-the-fly assignment, pool, search
  (sample modal AND library panel — "no results" state + Show all).
- `e2e/helpers.ts` — WAV generation + import/editor helpers (utility, not a test).

> In the bare browser, persistence goes through the **memory** repositories (see M5 doc): E2E covers
> the asynchronous boot and the default bank, not SQLite — the latter is covered by the
> `tests/storage/*` tests (real SQLite) and manual `tauri dev` validation.
