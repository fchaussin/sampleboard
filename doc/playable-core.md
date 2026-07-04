<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Playable core (milestone M2)

The **how** of the core: domain, store, commands, pointer input and grid. The **what/why**
(model, behavior matrix) is in [`specifications.md` §6–§11](../specifications.md).

## Flow (reminder §9)

`UI → intention → command → (store + engine)`. Components are **dumb**: they render state
and emit intentions via `app.commands`. **Only commands mutate the store.** The engine is
authoritative over voices: it *notifies* `onPlayingChanged` → the store mirrors `activePadIds`.

## Domain (`src/domain`)

- `types.ts`, `enums.ts` — pure model (see §6).
- `invariants.ts` — bounds (gain dB, grid) + `padsFitGrid` (shrink invariant).
- `selectors.ts` — **pure reads** of the bank tree: `pagesSorted`, `padsOfPage`,
  `padAtPosition`, `findPad`, `findPage`.

## Store (`src/app/store.svelte.ts`)

Svelte 5 runes. Fields: `bank`, `samples`, `settings`, `activePageId`, `editMode`, `activePadIds`.
Derived getters: `locale`, `activePage`. Mutated only by commands.

## Commands (`src/app/commands.ts`)

| Command | Effect |
|---|---|
| `hydrateBank(bank)` | Loads a bank tree + selects the 1st page. (M2 seed; SQLite hydration in M5.) |
| `setActivePage(id)` | Changes the displayed page. |
| `firePad(id)` | One-Shot. |
| `pressPad(id)` / `releasePad(id)` | Gate on / off. |
| `toggleLoopPad(id)` | Loop start/stop. |
| `stopPad(id)` / `stopPage(id)` | Stops. |

Each play command resolves `pad` + `page` in the bank and **resumes audio** (`resume`, user
gesture) before delegating to the engine. Silent no-op if the pad/page is not found.

## Pointer input (`src/ui/interaction/pad-input.ts`)

`attachPadInput(el, padId, playMode, handlers)` maps Pointer Events according to the play mode:

- **One-Shot**: `pointerdown` → `fire`.
- **Loop**: `pointerdown` → `toggleLoop`.
- **Gate**: `pointerdown` → `press` + `setPointerCapture` (receives the release even if the
  finger left); `pointerup`/`pointercancel` → `release`. Detaching a still-held Gate →
  safety `release`.

Mouse: primary button only. Pads have `touch-action: none` (no scroll/zoom during a Gate).

## UI (`src/ui/components`)

- Page tabs — navigation between pages (since M6: integrated into the `Bottombar`, see [interface](./interface.md)).
- `PadGrid` — CSS `rows`×`cols` grid of the active page; pads placed by `position`, empty
  cells otherwise.
- `Pad` — renders `name` + mode label (i18n `mode.*`), wires `pad-input`, reflects the
  *active* state (via `activePadIds`) / *empty*.

## Behavior matrix (§7) — where it is verified

Gate, Loop, Mono choke, self re-trigger, FIFO, `stop*` are covered by
`tests/engine/audio-engine.m2.test.ts`; the input mapping by `tests/ui/pad-input.test.ts`; the
delegation by `tests/app/commands.test.ts`. See [tests](./tests.md).

## Try it (dev, temporary seed bank)

1. http://localhost:1420 → load a sound into **Son A** and **Son B** (dev bar).
2. **Poly** / **Mono** tabs; tap the pads: One-Shot (restart), Gate (hold), Loop
   (re-tap = stop). On **Mono**, starting a pad stops the others.
