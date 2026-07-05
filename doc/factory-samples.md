<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Factory samples (#14)

Pre-filled library and pre-assigned « Principal » (main) board at **first launch**.

## Provenance (since 2026-07-04, decision §16)

**Reference bank of 25 soundboard classics, exclusively CC0 Freesound**
(supersedes the initial batch of 78 sounds with untraced provenance). Each manifest entry
carries `source` (Freesound URL, title, author, id) and `license: CC0-1.0`. Renewal /
per-unit replacement: edit `scripts/freesound-worklist.json` (FR label, tags, EN query,
duration bounds, board slot) then `FREESOUND_TOKEN=<key> node scripts/freesound-rebank.mjs`
(`--dry` to preview the choices) — automatic reputation-based selection among the CC0
results, HQ OGG previews to convert to Opus 96k (dockerized ffmpeg, see the directory
README).

## Full chain

1. **Repository** — `public/factory-samples/`: **OGG/Opus files only** + `manifest.json`
   (source of truth: `file`, curated `label`, `tags` as factory tokens, `source`/`license`).
   Optional `board` section: selection pre-assigned to the pads of the first page, in
   position order (optional `playMode`). See the directory README (dockerized ffmpeg
   conversion, license rules).
2. **Build** — Vite plugin `factory-samples-manifest` (`vite-plugin-factory-samples.ts`),
   run at every build AND at dev startup: manifest ↔ files consistency (1:1), OGG
   format, allowed tags, coherent board → **build fails** otherwise; `source`/`license` at `TODO`
   → warning (blocker to clear before F-Droid submission). Since Vite's `public/` is
   copied as-is, the fixture ships in **every dist** (web, Android, container).
3. **First launch** — `create-app.ts` detects the pristine database (same guard as the default
   bank and tags: a deleted factory sample **never** grows back) and runs
   `seedFactoryContent` (`src/app/factory-seed.ts`), **non-blocking** (each board slot is assigned AS SOON AS its sample is seeded — progressive board, #27; the app is playable
   while seeding): manifest fetch → `commands.seedFactorySample` per file
   (decode for duration/playability then **byte copy without re-encoding** — hence
   the OGG requirement) → tags by token (bootstrap `defaultTags`: `{ token, label }`) →
   `board` assignment + `playMode`.

## Errors

Best effort at every level: missing/undecodable file → logged, skipped,
the rest continues; missing manifest (the e2e case, which blocks it via `gotoApp`) → no-op.

## Fixed pitfall (2026-07-04): seeding freeze under autoplay policy

Seeding seemed to "lose" samples unpredictably between reloads:
`decodeSource` (commands) did `await engine.resume()` before each decode, but
`AudioContext.resume()` **never resolves** while the browser's autoplay policy is
waiting for a user gesture — at boot (no gesture), seeding silently froze on its
first sample, and resumed as soon as a pad was touched (hence the seemingly random
behavior, depending on the profile's Media Engagement). Fix: **no `resume()` in the decode
path** (`decodeAudioData` works with a suspended context) — resuming remains the business of
gestures (`resumeAudio`, `void engine.resume()` in the play/preview commands). Regression
covered: `commands.factory-seed.test.ts` ("seeds even if resume() never resolves").

## Tests

- `tests/build/factory-samples.test.ts` — build validation + integration on the real
  fixture (fails if a file is added without a manifest entry).
- `tests/app/commands.factory-seed.test.ts` — the command never re-encodes (the encoder
  is not called), PCM duration, write failure → engine unload.
- `tests/app/factory-seed.test.ts` — full seeding on fakes (tags, board, best effort).
- `e2e/factory-seed.spec.ts` — real first launch: filled library + « Buzzer »
  on the first pad.
