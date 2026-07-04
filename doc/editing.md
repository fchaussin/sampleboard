<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Editing (milestone M3)

> **Layout replaced in M6**: the controls described here now live in the
> **contextual drawer** (pad/page) and the **bottombar** — see [interface](./interface.md).
> Commands and invariants remain identical.

The **how** of Edit mode: pad/page CRUD, settings, grid resizing. The
**what/why** (model, invariants) is in [`specifications.md` §6, §11–§12](../specifications.md).

## Play ↔ Edit toggle

Header button → `toggleEditMode`. In Edit mode: tapping a pad **selects** it
(`selectedPadId`) instead of playing it; empty cells display a **"+"** (adds a pad at
that position); the tabs gain a **"+"** (adds a page). Leaving Edit clears the
selection.

## Commands (see `src/app/commands.ts`)

**Pads**: `addPad(pageId, position?)` (1st free cell if `position` is omitted; no-op if full or
occupied), `renamePad`, `setPadPlayMode`, `setPadGainDb` (**bounded** [-60, +6]), `assignSample(id |
null)` (a sample from the library, or clear), `deletePad` (stops the voice first), `reorderPads`
(swaps with the occupant of the target cell).

**Pages**: `addPage`, `renamePage`, `deletePage` (**refuses the last one** — a bank has ≥ 1 page;
stops the page then renumbers), `setPageVoiceMode`, `setPageGrid(rows, cols)`, `reorderPages`.

### Shrink invariant (§6, §12)

`setPageGrid` **refuses** a shrink that would push a pad outside the new grid
(`padsFitGrid`). The UI disables the "−" buttons when the shrink is not safe — no data
silently lost.

## Library in M3 (dev bridge)

Real import (Tauri dialog + Opus re-encoding + persistence) arrives in **M4**. In the meantime,
the `DevLibrary` bar:

- **Add a sound** → `devAddSample` creates a `Sample` entry in `store.samples` and loads its
  buffer (File API).
- **Load** onto an existing entry → `attachSampleBuffer` (fills the buffer of a seed sample).

The pad drawer lists `store.samples` in its selector; `assignSample` links pad → sample. In M4,
only the **source** of the samples changes (real import): assignment commands and UI remain.

## Try it (dev)

1. http://localhost:1420 → **Add a sound** (once or twice).
2. **Edit** button → "+" on a cell to create a pad; select it; set mode / gain /
   name / **Sample**; resize the grid; add/rename/reorder/delete pages.
3. **Play** button → play the configured bank.

## Tests

`tests/app/commands.edit.test.ts` (CRUD, shrink invariant, library, selection). See
[tests](./tests.md).
