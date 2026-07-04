<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Library & import (milestone M4)

The **how** of import and the library. The **what/why** (pipeline, formats, codec)
is in [`specifications.md` §8, §11, §13](../specifications.md).

## Opus encoder (WASM)

`src/engine/encoder.ts` — built on **[opus-recorder](https://github.com/chris-rudmin/opus-recorder)**
(MIT): libopus + ogg container compiled to WASM, **embedded in the worker** (`encoderWorker.min.js`,
no separate asset). Decision §16: WASM libopus, 96 kbps. Build-from-source reproducibility
planned for **M6**.

`createOpusEncoder()` returns an `Encoder` (`PcmData → Uint8Array` OGG/Opus) that drives an
ephemeral worker. Protocol (aligned with opus-recorder):

1. `init` (originalSampleRate, numberOfChannels, encoderSampleRate 48 kHz, encoderBitRate 96 kbps,
   application audio) → the worker replies `{message:'ready'}`.
2. **`getHeaderPages`** → **OpusHead + OpusTags** pages *(essential: without these headers the OGG
   is undecodable — this is the bug that motivated the E2E layer, see [tests](./tests.md))*.
3. `encode` (Float32 buffers per channel) then `done` → audio pages, then `{message:'done'}`.
4. Pages arrive as `{message:'page', page}`; they are concatenated into a `.ogg`.

The `Encoder` is **injected** into the commands (`createCommands({ encode })`): testable in
pure form with a fake encoder, real in E2E.

## Import pipeline (`commands.importSample`)

`fileName + bytes` →

1. **Size**: rejected if > 20 MB (`IMPORT_MAX_BYTES`, §16) — on the source, before decoding.
2. `engine.resume()` then **`engine.decode`** (`decodeAudioData`) → PCM + `durationMs`. Failure →
   `undecodable`.
3. **Opus encoding** (`encode`) → OGG/Opus bytes. Failure → `encodeFailed`.
4. **`engine.load` of the re-encoded output**: re-decodes the produced OGG → safeguard (a broken
   encoding makes the import *fail* instead of corrupting the library) + makes the sample
   playable/previewable.
5. **Immediate write** (M5, outside autosave): file `{appDataDir}/audio/{sampleId}.ogg` +
   `samples` row via `sampleRepository.add`. Failure → `writeFailed` (buffer unloaded, nothing in
   the library).
6. `Sample` entry added to `store.samples` (`mime: audio/ogg`, `durationMs`, encoded size,
   `createdAt`).

> See [persistence & settings (M5)](./persistence-settings.md). In the bare browser, the
> repository is in-memory (session only) — the pipeline remains 100% validatable on the web.

## Library (`Library.svelte`)

Import (button), **preview** (▶ button **toggles to ■** during playback — re-tap or
**any other action** stops; shared `PreviewButton` component, routed through the master bus,
see [audio engine](./audio-engine.md)), **renaming** of the
`label`, **deletion** with a **warning about the number of affected pads**: after confirmation,
the `sampleId` of those pads is set to **`null`** (*empty* state) — in-memory mirror of the
schema's `ON DELETE SET NULL` (§8), applied since M5. Renaming and deletion write
**immediately** via the repository.

## Pad states (§12, Glossary)

`Pad.svelte` derives: **active** (in `activePadIds`) › **empty** (`sampleId` null) › **not found**
(`sampleId` missing from the library — e.g. data altered outside the app) › **idle**. Since M5,
an audio file unreadable at startup leaves the sample in the library but its pad plays a
no-op (§12); a dedicated visual indicator is in the backlog.

## Try it (dev, http://localhost:1420)

1. **Import a sound** → the sample appears (⇒ OGG/Opus encoding + re-decoding OK).
2. **▶** to preview.
3. **Edit** → "+" on a cell → assign the **Sample** → **Play** → play.

## Tags, filters & direct assignment (milestone M8)

- **Tags** (`Tag`, n-to-n, migration 4): customizable via « Gérer les tags » (manage tags —
  create, rename, delete — deletion prunes assignments and the filter). Nine tags **seeded on
  first launch only** (i18n labels injected by the bootstrap). Management lives
  in the **right drawer** (#20, `TagSettings` in `Drawer`, `tags` view,
  `openTagsDrawer`): opened from the library toolbar — the list and
  the filters update behind it, live.
- **« Non classé »** (unclassified): a **virtual** filter = samples with no assignment
  (decision §16 — a single representation of absence; an emptied set disappears from
  `sampleTags`).
- **Filters**: chips (« Tous » (all) / tags / « Non classé ») above the list; shared pure
  logic `app/tag-filter.ts` (`matchesFilter`, `filterSamples` with text search).
- **Search in the panel**: text field (on the label, case/whitespace-insensitive)
  combined (AND) with the chips, in a **sticky toolbar** (import + search + filters
  stay visible while scrolling). No match: message « Aucun son ne
  correspond » (no matching sound) + a **« Tout afficher »** (show all) button (clears search
  and filter). `.search` style shared in `app.css` (shared with the sample picker modal).
- **Adaptive layout** (media queries, `Library.svelte` styles): on **wide screens**
  (`≥ 48rem` — tablet/landscape/desktop) the list becomes a **card grid**
  (`auto-fill minmax(20rem, 1fr)`, expanded row spanning the full width); on **narrow**
  screens, the grouped actions (`.actions`) move **below the name** (content-driven wrap,
  minimum name basis `10rem`); on **touch** (`pointer: coarse`), targets ≥ 44 px (M6 rule).
- **Expandable row** (🏷) per sample: toggleable tag chips + **direct page→pad
  assignment** (#11 — Page/Pad selects + Assign, existing `assignSample`).
- **Per-card waveform** (#19, `SampleWaveform.svelte`): the sample's static peaks
  always visible below the name (`engine.peaks`, shared `drawPeakBars` drawing with the
  pad); during **preview**, the played part fills in (`engine.previewProgress`).
  The rAF loop only runs during the preview of the card in question — at rest, a
  single static drawing.
- **Sample picker modal** (#12): combobox — search field + tag chips,
  filters local to the modal.

## Assignment pool (M8, revised #18)

A **session-scoped** working list of samples (`store.poolSampleIds`, not persisted), an
**Edit-only** tool:

- **Wide screen (≥ 48 rem)**: **always-on sidebar** in flow (`App.svelte`: `.body` =
  sidebar + grid, `matchMedia` detection) — no open button, no closing.
- **Narrow screen**: floating **left drawer** (`overlay`), opened/closed by the pool
  button in the bottombar (`poolOpen`). On wide screens, the sidebar stays in place next to
  the **library view** (#22) — dragging a row → pool happens in flow.
- **Feeding it**: per-row library button, import option (#13), the header's
  **"+"** button (opens the library), or **drag-and-drop** of a library row
  onto the pool. **« 🗑 Vider »** (empty) (`clearPool`) empties it in one go (disarms if
  the armed sample came from the pool).
- **To the pads**: touching an item **ARMS** it (on-the-fly assignment, M8), or **drag it
  directly onto a pad** (immediate assignment, `assignSample`).
- **Quick preview** (#21): `PreviewButton` (▶/■) at the head of each item + progress
  waveform (`SampleWaveform`) behind the label — same unified preview as the
  library (#16, any other action stops).

HTML5 DnD (`ui/interaction/sample-dnd.ts`: shared MIME type
`application/x-sampleboard-sample`) is a **pointer** shortcut; the touch flow
"arm then touch" remains the primary path on mobile.

## Multiple import & archives (milestone M8, #13)

The **bottombar** import button **opens the import MODAL** (`ImportModal.svelte`,
`openImport`/`closeImport`): "file picking" state (button + format reminder +
option **« Ajouter les sons importés au pool »** (add imported sounds to the pool) — each
successful sample joins the pool, for a batch as well as for the single file validated in the
editor), then **progress in the same place** when a batch starts. The library input
remains a direct access to the picker; both are `multiple` and accept
`audio/* + .zip + .rar` (`IMPORT_ACCEPT`, `ui/import-file.ts`). Dispatch in
`importFiles`:

- **ONE audio file** → `beginImport`: the **audio editor opens** (M7 flow unchanged,
  including assignment to a pad from the picker modal) and the import modal
  closes.
- **Multiple files or an archive** → `commands.importBatch`: **direct batch** without the
  editor (trimming still possible afterwards via « Découper »), progress in
  `store.batchImport` ($state.raw, replaced wholesale) — global bar, per-file status,
  **Interrupt** (the in-flight item finishes, the remaining ones become "skipped").
  "Close" at the end of the batch dismisses modal and state in one go (`closeBatchImport`).

### Archives (zip/rar) — `engine/archive.ts`

Extraction via **libarchive compiled to WASM** in an ephemeral worker per archive:
`libarchive.js` (MIT) wraps libarchive (BSD, zip + rar4/rar5 **clean-room** readers) —
the official unrar is **rejected** (non-free license, decision §16). The worker resolves
`libarchive.wasm` **relative to its own URL**: the `libarchive-assets` plugin
(`vite.config.ts`) serves both files side by side in dev and copies them to
`dist/libarchive/` at build time (stable names, no hash).

Within a batch, an archive is **expanded in place**: its entries with an audio extension
(`AUDIO_EXTENSIONS`, decoding remains the final arbiter §12) join the queue and the
modal; `__MACOSX/` and hidden files are discarded. Guards: archive ≤ 200 MB
(`ARCHIVE_MAX_BYTES`) → `tooLarge`; extraction impossible → `archiveFailed`; no audio
entry → `archiveEmpty`. Each entry then goes through the standard import pipeline
(20 MB, decoding, Opus, immediate write).

The extractor is **injected** into the commands (`createCommands({ extractArchive })`):
fake in the tests (`tests/app/commands.batch-import.test.ts` — batch, per-file failure
isolation, expansion, interruption), the real one wired by `create-app.ts`.
