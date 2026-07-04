<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Persistence & settings (milestone M5)

The **how** of SQLite persistence, autosave and settings. The **what/why**
(schema, A/B decisions, background behavior) is in [`specifications.md` §8, §9, §12](../specifications.md).

## Where the data lives

| Data | Location |
|---|---|
| SQLite database | `{appConfigDir}/sampleboard.db` (resolved by tauri-plugin-sql, created as needed) |
| Audio bytes | `{appDataDir}/audio/{sampleId}.ogg` (never a BLOB, §8) |

On Linux: `~/.config/org.sampleboard.app/` and `~/.local/share/org.sampleboard.app/audio/`
(per the `identifier` in `tauri.conf.json`).

## `storage` layer

- **`db.ts`** — `SqlExecutor` contract (`execute`/`select`) + **migrations** via `user_version`
  (`openDatabase` applies the missing ones in sequence, never any silent destruction).
  Migration 1 = §8 schema; migration 2 (M6) = `color` columns; migration 3 (M6) =
  1×1 grid bounds (rebuild of `pages`, SQLite procedure). Also:
  `createWriteLock()` (see below).
- **`tauri.ts`** — the ONLY module that touches the plugins: executor on `Database.load` (sql plugin)
  and `AudioFileStore` on the fs plugin (`BaseDirectory.AppData`, lazy `mkdir` of `audio/`).
  Loaded via **dynamic import** only under Tauri.
- **`bank-repository.ts`** — `load()` rebuilds the tree (bank → pages → pads, sorted by
  `position`; 0 pages = invalid state → `null` → default bank). `save()` in a **transaction**,
  **upsert-then-prune** strategy (`ON CONFLICT(id) DO UPDATE`, then `DELETE … NOT IN`): an
  interrupted save leaves valid rows, never an "everything deleted, nothing reinserted" state.
  A pad's `sample_id` goes through `(SELECT id FROM samples WHERE id = ?)`: a dangling
  reference is written as `NULL` instead of violating the foreign key.
- **`sample-repository.ts`** — SQLite metadata + bytes via `AudioFileStore`. `add` writes the
  file **then** the row (insertion failure → file removed); `remove` deletes the row
  (**`ON DELETE SET NULL`** on pads, §8) then the file (orphan tolerated + `console.warn`).
- **`settings-repository.ts`** — single row `id = 0`, `load` → defaults if missing, `save` upserts.
- **`memory.ts`** — **bare browser** fallback (:1420): same contracts, in memory, session
  only. Persistent "pure browser mode" remains a v2 evolution (§17).

### Shared write lock (`createWriteLock`)

`tauri-plugin-sql` relies on an **sqlx pool** (lazy connections, up to 10): two concurrent
operations may run on **different connections** — fatal for the `bank-repository` transaction
(separate `BEGIN`/`COMMIT`) and a source of interleavings (an `INSERT samples` landing
inside the bank transaction). The composition root creates **one** lock (promise queue)
shared by the three repositories: each logical write operation runs alone, the pool never
exceeds one connection, transactions are safe by construction. Repositories accept the lock
as a parameter (`NO_LOCK` by default for sequential tests).

## Autosave (`persistence.ts`, decision A §9)

- **Bank**: single reactive subscriber → **400 ms debounce**, last state wins (one save per
  burst). `snapshotBank` makes an **explicit** deep copy: it subscribes the watcher to every
  leaf of the tree AND decouples the snapshot from subsequent mutations.
- **Settings**: second subscriber, **immediate** write (outside the debounce).
- **Library**: is NOT part of autosave — import/rename/delete write
  **immediately** via `sampleRepository` in the commands.
- Writes are **chained** (internal queue); a failure is logged without breaking the queue.
- `flush()`: writes without waiting for the debounce — called on `visibilitychange → hidden`
  (the Android app can be frozen/killed right after).
- **`start()` is only called AFTER hydration**: the default state never overwrites the database.

Reactivity is **injected**: `persistence.ts` stays pure TS (testable with fake timers) via
the `Watch` contract; the runes implementation (`$effect.root` + `$effect`, first pass ignored,
`untrack` on processing) lives in **`watch.svelte.ts`** — the app layer's only Svelte bridge.

## Startup (`create-app.ts`, asynchronous since M5)

1. **Tauri** runtime? → sql executor + `openDatabase` (migrations) + files; otherwise
   **memory** repositories.
2. Hydration: **settings** → **library** (+ buffer loading into the engine;
   unreadable file = `console.warn`, the pad plays a no-op, §12) → **bank** (missing → default
   bank created and saved: 1 empty 4×4 Poly page, `default-bank.ts`).
3. `persistence.start()` then `visibilitychange` wiring (see below).

`main.ts` awaits `createApp()` before mounting the UI (`app.bootError` shown on failure).
The dev seed bank (`dev-seed.ts`) is **removed** — the app starts on the default bank.

## Background (`Settings.backgroundBehavior`, §12)

`visibilitychange → hidden` (Android WebView: covers backgrounding/sleep) triggers
`commands.applyBackgroundBehavior(true)`:

| Setting | Effect |
|---|---|
| `stopAll` (default) | `engine.stopAll()` + `engine.suspend()` |
| `stopSustained` | `engine.stopSustained()` — stops **sustained** voices (Gate/Loop), lets One-Shots finish |
| `keepPlaying` | nothing — audio keeps playing |

Return to foreground: **no** automatic `resume()` — it restarts on the next gesture (§12).
The engine marks each voice `sustained` (Gate/Loop) at creation. `persistence.flush()` is
also called when going to the background.

## `Settings.svelte` UI

Content of the **Settings drawer** (M6 layout, see [interface](./interface.md)):
Background (3 options), Maximum number of voices (integer ≥ 1, bounded by `setMaxVoices`),
Language (`availableLocales()`). Persisted immediately.

## Capabilities (src-tauri)

Added for M5: **`sql:allow-execute`** (writes/DDL — the plugin default only grants
load/select/close) and **`fs:allow-appdata-write-recursive`** (write/delete/mkdir under
`$APPDATA` — the default is read-only).

## Tests

- `tests/storage/*` — repositories and migrations exercised against a **real in-memory SQLite**
  (`node:sqlite`, Node ≥ 22.5 in the dev container; test executor
  `node-sqlite-executor.ts`, minimal ambient types `node-sqlite.d.ts` — no
  `@types/node` dependency). Bank round-trip, upsert/prune, cascades, `ON DELETE SET NULL`, CHECK,
  foreign keys, write lock.
- `tests/app/persistence.test.ts` — debounce, burst → one save, flush, stop, resilience to
  failures (fake reactivity + fake timers).
- `tests/app/commands.settings.test.ts` + `tests/engine/audio-engine.m5.test.ts` — settings,
  `applyBackgroundBehavior`, `stopAll`/`stopSustained`/`suspend`.

## Manual validation (Tauri window)

```bash
docker compose -f docker-compose.dev.yml -f docker-compose.gui.yml run --rm dev npm run tauri dev
```

1. Import a sound, create/rename pads and pages, set gain/mode, change the Settings.
2. Close the window, relaunch: **everything is reloaded faithfully** (bank, playable library,
   settings).

> In the bare browser (http://localhost:1420), persistence is **deliberately absent**
> (memory repositories): reloading the page starts over from the default bank.
