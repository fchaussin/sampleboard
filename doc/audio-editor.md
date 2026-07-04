<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Audio editor — « Découper » (trim) (milestone M7)

The **how** of start/end trimming. The **what/why** (decision to pull it back from v2 to v1)
is in [`specifications.md` §16](../specifications.md).

## Principle

**Every import opens the editor** (Quick import, Library, sample picker modal):
the file is decoded to PCM, presented as a waveform, trimmed to the selection, then
**encoded to Opus already trimmed** (the stored file contains only the selection). An existing
sample can be reworked via **✂ in the library** (`beginSampleRework`: re-reads the OGG →
re-decodes → editor → re-encodes, **id and file kept**, no duplicate).

## Layers

- **`engine/pcm.ts`** (pure): `pcmDuration`, `computePeaks` (shared with `engine.peaks`),
  `clampSelection` (bounds + 10 ms minimum duration), `trimPcm` (sample-accurate trimming,
  multi-channel, source untouched).
- **Engine**: `previewPcm` / `stopPreview` — preview of the trimmed PCM, via the engine's
  UNIFIED preview mechanism (one call replaces the current playback, sample or PCM — see
  [audio engine](./audio-engine.md)).
- **Store**: `audioEditor` (`$state.raw`) — session `{ mode: 'import' | 'rework', fileName,
  pcm, sample, assignPadId }`.
- **Commands**: `beginImport` (20 MB guard → decode → open; remembers the pad to assign
  for the sample-modal flow), `beginSampleRework`, `previewEditorSelection`,
  `applyAudioEditor` (import: shared `finishImport` + assignment; rework:
  `SampleRepository.replace` + engine reload, **best-effort restoration** of the
  original buffer on failure), `cancelAudioEditor`. Apply failure → the editor
  **stays open** with the message.
- **`SelectionHistory`** (class, OO §16): undo/redo stack of selections — one push per
  handle release.
- **`AudioEditor.svelte`**: full-screen `<dialog>` (top-layer → stacks naturally on top of
  the sample picker modal). Bar waveform (peaks cached per width), full selection /
  out-of-selection dimmed, **pointer-dragged handles** (the one closest to the
  touch), `start – end · duration` times, preview, undo/redo, Cancel / Apply.

## Persisted duration

`durationMs` is now **derived from the PCM** (`pcmDuration`), so always consistent with
the actually encoded file (trimmed or not); the library shows the up-to-date duration after
a rework.

## E2E journey

`e2e/audio-editor.spec.ts`: 1 s import → drag the end handle to 50% → undo (full
selection) → re-trim → Apply → **the library shows 0.5 s**; then rework (✂) of an
existing sample → re-trim → same entry, updated duration. Imports in the other specs
go through `applyAudioEditor(page)` (helper).
