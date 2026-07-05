<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Interface (milestone M6)

The **how** of the v1 UI layout. The **what/why** (decisions from backlog triage #2) is
in [`specifications.md` §11, §16](../specifications.md).

## Layout

```
┌──────────────────────────────┐
│ Topbar : page · badges       │ ← tap → page drawer
├──────────────────────────────┤
│                              │
│        PadGrid (centered)    │ ← Play: tap plays · Edit: tap → pad drawer
│                              │
├──────────────────────────────┤
│ ✎  ⏹  [1][2][+]   ⤓  ♪  ⚙  │ ← Bottombar
└──────────────────────────────┘
```

- **`Topbar`** — name (or number) of the active page + badges (**Edit** chip when active,
  Polyphony, `rows`×`cols`). Any tap opens the **page drawer**. In **library view**
  (#22), the page context gives way to the « Bibliothèque » (library) title; visualizer and Stop
  remain (global). The **visualizer** draws one waveform per active voice (pad color) and
  the **preview** waveform in accent (#24 — `engine.previewWaveform()`, lazy side-tap):
  everything sounding on the main out is displayed.
- **`Bottombar`** — in order: **Play ↔ Edit** toggle (pencil, accented in Edit),
  **Stop all** (`stopAllVoices` → `engine.stopAll`), **page tabs** (scrollable,
  "+" in Edit), **Quick import** (direct file input, errors as snackbar), **Pads** (board view) +
  **Library** (VIEW toggle in `main`, #22), **Settings** (drawer).
- **`Drawer`** — right panel (min(340px, 88vw)) + scrim; closed via ✕ or a tap on the scrim.
  Four contents: `PadSettings`, `PageSettings`, `Settings`, `TagSettings` (#20) —
  form styles shared via `.drawer-form` in `app.css`. `PadSettings` also offers
  **Add to the assignment pool** (#33) when the pad has a sample (disabled once it is in).
- **`LibraryPanel`** — a VIEW of the layout (#22, supersedes the M6 full-screen): rendered in
  `<main>` in place of the grid, topbar/bottombar remain. Panel header: **Import a sound** (left), **Manage tags** + close (right). `Library` content (rename, preview, deletion with a warning).
- Icons: `Icon.svelte` (inline SVG, Material-style paths, zero dependencies).

## State & commands

`drawer: 'pad' | 'page' | 'settings' | null` lives in the store (UI state, §9), mutated only
by the commands: `openPadDrawer` (Edit only — in Play a tap plays), `openPageDrawer`,
`openSettingsDrawer`, `closeDrawer` (deselects the pad), `stopAllVoices`. The **view of
`<main>`** (`store.view`) follows the URL-driven navigation below; `openLibrary`/`closeLibrary`
are URL writes, `libraryOpen` remains readable (derived from `view`).

## URL-driven navigation (#23)

The view of `<main>` is a **projection of the URL** — never an independent variable:

- **Fragment encoding**: `#/board` (default), `#/library`, `#/library?tag=<id|untagged>`
  (the library filter travels as a parameter). Empty/unknown URL → normalized to
  `#/board` via `location.replace` (no stray history entry).
- **Modules**: `app/navigation.ts` (pure — `parseHash`/`formatHash`, `DEFAULT_ROUTE`);
  `app/router.ts` — `createHashRouter(window)` wired by `create-app.ts`,
  `createLoopbackRouter()` by default outside the browser (tests: synchronous application,
  minimal stack). The `view → component` table and dynamic rendering (`<View {app} />`) are in
  `App.svelte`.
- **One-way flow**: UI → command → `router.push/replace/pop` (URL write) → `hashchange`
  → `applyRoute` (**sole writer** of `store.view`, also sets the filter). `applyRoute` is
  excluded from `PREVIEW_STOPPING_COMMANDS` (sync, not an intention).
- **Deliberate history**: `push` when opening the library (entry tagged with a
  depth in `history.state`); `replace` for adjustments (normalization, filter
  change — no entry); `pop` on close — **the ✕ and the Android back gesture
  pop the same entry**; on a direct-landing URL (reload on `#/library`),
  `pop` falls back to a `replace` toward the board.
- **Stale filter**: a `?tag=` whose id no longer exists (tag deleted outside the session, ids
  regenerated on every load in memory dev) **falls back to « Tous » (all)** — sanitized by
  `hydrateTags` (boot) and `applyRoute` (back/forward), URL corrected via `replace`. Without
  this, reloading a tab left on an old `?tag=` filtered on a ghost tag: an "empty" library
  even though the 78 factory samples are indeed there.

Tests: `tests/app/navigation.test.ts`, `tests/app/router.test.ts` (fake window — no
jsdom), "URL-driven navigation" e2e (`e2e/library-tags.spec.ts`).

Chained flows: `addPad` ("+" cell) opens the drawer of the created pad; `deletePad` of the
selected pad closes the drawer; `toggleEditMode` closes the drawer (the context changes).

## Replacements (M3/M5 → M6)

| Before | After |
|---|---|
| `Editor.svelte` (inline panel) | `PadSettings` + `PageSettings` in the drawer |
| `PageTabs.svelte` | tabs integrated into the `Bottombar` |
| `Settings.svelte` as `<details>` | content of the Settings drawer |
| `Library` above the grid | `LibraryPanel` (view of `main` since #22) |

## Colors (OKLCH palette)

Pages and pads carry a palette **token** (`color`, `COLORS` domain, persisted —
migration 2). Visual values live in `app.css`: entire theme in **oklch()** and
8 hues `--c-<token>` at constant L/C (uniform contrasts, maintenance by hue
rotation). `ui/tint.ts` produces the `--tint` style, consumed in CSS via `var(--tint, var(--accent))`
(pads: idle border / active background; tabs: border, background when active). `ColorPicker`
(swatches + "neutral") is shared by the pad and page drawers. Unknown token read back from
the database → neutralized (`sanitizeColor`).

## Sample picker modal & stacking

`SamplePicker` (native `<dialog>`, `showModal`): library list + preview +
"none" + **direct import** (the imported sample is assigned right away). Overlay
stacking: **layer 0** app → **layer 1** drawer (`--z-drawer`) and panel (`--z-panel`),
snackbar above (`--z-snackbar`) → **modals** in the browser's native *top-layer*,
always on top and stacked in opening order (the future crop modal — backlog
#4 — will naturally sit on top of the import one).

## Complete board from init (`BankFactory`)

Decision §16: **never a blank page nor a colorless pad**. The `BankFactory` class
(app, injected into the commands and the composition root — OO style §16) carries all
creation defaults: first-launch bank (colored « Principal » (main) page, **filled** 4×4
grid), `addPage` (complete page), `setPageGrid` (exposed cells filled in), `addPad`.
Colors: palette cycle by position (pads) and by rank (pages). Pad style: **solid outline
+ transparency-tinted background**; name above the mode — bold if a sample is assigned,
semi-transparent italic if empty.

## Default names

Initial page « Principal », added pages « Page N »: generators **injected** from
`main.ts` (`CreateAppOptions`) because the app layer cannot import `ui/i18n` (§4) — these are
user data localized at creation time, editable afterwards. A pad **without a name**
takes the label of the sample assigned to it (`defaultPadName`: extension stripped, 12
characters max); a chosen name is never overwritten.

## Covered e2e journeys

Quick import (bottombar) → verification in the Library panel → Edit → "+" → drawer
(Loop + assignment) → Play → active pad → **Stop all**. Stable selectors: `.bottombar`,
`.mode-toggle`, `.stop`, `.import input`, `.open-library`, `.close-library`, `.drawer`,
`.topbar`, `.cell-add`.
