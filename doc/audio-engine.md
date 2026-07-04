<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Audio engine (milestone M1)

The **how** of the `engine`. The **what/why** (contract, behavior matrix) stays in
[`specifications.md` §7](../specifications.md).

## Overview

`src/engine/audio-engine.ts` — pure TS (Web Audio), **no dependency on Svelte**. Single
responsibility: produce low-latency sound and manage voices. It is **authoritative** over
ephemeral play state (which voices are playing): it *notifies* it, it does not duplicate it in
the store.

What is implemented in **M1**:

| Method | Role |
|---|---|
| `resume()` | Creates/resumes the `AudioContext` on a user gesture. **Idempotent**; also resumes from `interrupted` (mobile system interruption). Never if `closed`. |
| `load(sampleId, bytes)` | `decodeAudioData` (on a **copy** of the bytes, since the API detaches the `ArrayBuffer`) → `Map<sampleId, AudioBuffer>` cache. |
| `unload(sampleId)` / `isLoaded(sampleId)` | Cache removal / presence. |
| `oneShot(pad, page)` | **One-Shot** playback: `AudioBufferSourceNode` → `GainNode` → output. Gain = `gainDbToAmplitude(pad.gainDb)`. Re-tap = **restart from 0** (first stops the pad's own voice, ~8 ms anti-click fade). **Silent no-op** if the pad is empty (`sampleId === null`) or the buffer is not loaded. |
| `onPlayingChanged(cb)` | Subscription to the mirror of active voices (`Set<padId>`), emitted at every voice start/end. |
| `state` | `suspended` \| `running` \| `closed` \| `interrupted`. |

**Completed in M2** (see [playable core](./playable-core.md)): `press`/`release` (Gate),
`toggleLoop` (Loop), `stopPad`/`stopPage`, **Mono choke** (starting a pad stops the other
voices of the page), and voice cap in **FIFO** (`getMaxVoices`, read from
`Settings.maxVoices`). A voice carries its `pageId` (choke + `stopPage`).

### Master bus (decision §16, 2026-07-03)

**Single** funnel to the output: `master (GainNode) → destination`. **Everything that makes
sound connects to it** — voice chain `source → gain → analyser (per-pad visualizer) →
master`, previews `source → master` — never `ctx.destination` directly. Created lazily on
the first sound (`#ensureMaster`). `masterWaveform(out)` exposes the bus's real-time
waveform; its analyser is a **side tap** (the sound does not pass through it) created
**lazily on first call** — zero rendering cost as long as nobody consumes it (review
2026-07-03: no pass-through analyser on the hot path).

### Unified preview (decision §16)

**One single behavior** for the library, the sample modal and the audio editor: one preview
at a time in the app, a new one **replaces** the current one, `stopPreview()` stops it
(stop **and disconnect synchronously** — we do not rely on `onended` if the context gets
suspended right after, background). Private core `#playPreview(buffer, onEnded)`;
`previewSample(sampleId, onEnded)` and `previewPcm(pcm, onEnded)` only resolve their buffer
and return `false` if nothing could be started (buffer not loaded, empty selection).
`onEnded` is notified only at the **NATURAL end** of playback, guarded by **source
identity** — the late (asynchronous) `onended` of a replaced or stopped playback never
notifies, otherwise it would erase the mirror of a replay of the same sample.

On the command side, the rule "**any action acts as a stop**" is applied
**mechanically**: the exported list `PREVIEW_STOPPING_COMMANDS` (commands.ts) enumerates
the interaction commands, wrapped with a `stopPreview()` at the end of `createCommands` —
zero sprinkling, and a generic test iterates the list. Interactions **local to the
views** (search, picker-local chips, expanding) call `commands.stopPreview()` directly —
same rule, on the view side. `previewSample` (▶/■ toggle) ALWAYS stops the current
playback before starting: a failed start never leaves an orphan sound.

### Gain: dB → amplitude

`src/engine/voice.ts` — `gainDbToAmplitude(dB)`: `amp = dB <= -60 ? 0 : 10^(dB/20)`.
`0 dB` = original level (×1), `-60 dB` = muted (×0).

### Flow (architecture reminder)

`UI → intention → command → engine`. The UI never touches the engine directly: it goes
through `app.commands` (`resumeAudio`, and in M1 the `loadDemoSound` / `fireDemoPad`
harness). The engine notifies `onPlayingChanged` → `create-app.ts` mirrors into
`store.activePadIds` (decision B).

## M1 demo (**temporary** harness)

`src/ui/dev/M1AudioDemo.svelte`: one **hard-coded pad** that plays a loaded audio file.

- File loading via the browser's **File API** (`<input type="file">`), not yet the real
  import pipeline (Tauri dialog + Opus re-encoding + library → **M4**). This choice makes
  the demo testable **in bare Vite** (http://localhost:1420) **and** in the Tauri WebView
  (Android).
- The « Lecture… » (playing) indicator is driven by `store.activePadIds` → validates the
  `onPlayingChanged` chain.
- This component and the `loadDemoSound` / `fireDemoPad` commands (+ hard-coded pad/page in
  `commands.ts`) will be **removed** when the real `PadGrid` / `Library` arrive (M2/M3/M4).

### Try it

1. Dev environment running (see [Docker environment](./docker-environment.md)) → http://localhost:1420.
2. « Charger un son… » (load a sound) → pick an audio file (wav, mp3, ogg, flac…).
3. Press the **demo pad** → the sound plays (One-Shot); re-tap = restart from 0.

> Autoplay note: the first sound is only emitted after a **gesture** (picking the file or
> pressing the pad calls `resume()`). This is intentional (browser/mobile policy).

## Tests

See [tests](./tests.md). The audio core is covered by `tests/engine/*.test.ts` (Web Audio
simulated by a fake `AudioContext` injected via the `createContext` option).
