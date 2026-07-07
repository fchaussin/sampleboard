<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Sampleboard

**Pads, sounds, zero friction.** Sampleboard is a **soundboard** app: a grid of pads that
trigger your sounds — reactions, jingles, ambiences — organized in pages. Import your audio
files, assign them, play. Built for live moments (streams, tabletop games, radio,
workshops), **fully offline**, and respectful of your data.

It is a *sampleboard*, **not a sampler**: deliberately simple — no effects, no complex
editing, just what you need to fire the right sound at the right time.

## ▶ Try it now — live demo

**[fchaussin.github.io/sampleboard](https://fchaussin.github.io/sampleboard/)**

Runs entirely in your browser — no install, no account, no upload. It ships with a
25-sound starter bank so you can start tapping pads immediately, and it is an installable
**PWA** that keeps working **fully offline** once loaded. Nothing you do leaves your device.

> Tip: on desktop Chrome/Edge, click the *install* icon in the address bar; on
> Android/iOS, use *Add to Home screen*.

## Features

- **Pads in pages**: adjustable grid (up to 6×12), colors, multiple pages.
- **MIDI-controller-style play modes**: **One-Shot** (plays through), **Gate** (while
  pressed), **Loop** (until stopped); **Mono/Poly** polyphony per page.
- **Library**: import your audio files (multi-select, **zip/rar** archives), automatic
  OGG/Opus re-encoding, custom **tags**, search, preview.
- **Trim & cue points**: cut the start/end of a sound, or set a non-destructive playback
  window per pad (waveform, undo/redo) — the original stays untouched.
- **Starter bank**: 25 soundboard classics (buzzer, laugh track, tada, sad trombone,
  applause…), all **CC0** from [Freesound](https://freesound.org) (full provenance in the
  bundled manifest).
- **Panic stop**, real-time visualizer, separate Edit and Play modes (no accidental
  triggers on stage).
- **Fully offline**: no network permission, no account, no telemetry — your sounds stay
  yours.

---

## User guide

A short walkthrough of the whole app, screen by screen.

### 1. The board

<img src="fastlane/metadata/android/en-US/images/phoneScreenshots/1.png" width="320" align="right" alt="The board in Play mode" />

This is where you play. Each **pad** is a coloured tile bound to one sound; its **play
mode** (One-Shot / Gate / Loop) is shown under the name. Tap a pad to fire it.

- **Header** — the current page name (*Main*), a live audio **visualizer**, the page
  **polyphony** (*Poly*/*Mono*) and the **grid size** (*4×4*).
- **Page tabs** (bottom) — switch between pages; each page has its own grid and
  polyphony. In Edit mode you can add, rename and reorder them.
- **Bottom bar** — the blue **Play** button and the **pencil** toggle switch between
  *Play* and *Edit* modes. On the right: **Stop all** (panic), **Quick import**, the
  **Library**, and **Settings**.

<br clear="all" />

### 2. Playing — the three play modes

<img src="fastlane/metadata/android/en-US/images/phoneScreenshots/2.png" width="320" align="right" alt="A loop pad playing with its visualizer" />

Tap a pad to trigger it. Active pads animate a **real-time waveform** and the header
visualizer reacts to the master output.

- **One-Shot** — plays the sound through to the end on a single tap. Ideal for stingers,
  buzzers, jingles.
- **Gate** — plays **only while you hold** the pad, and stops the instant you release.
  Great for held stabs or talk-over beds.
- **Loop** — starts on tap and **loops until you stop it** (tap again, or the **Stop
  all** button). The pad shows a small stop control while looping (see *Suspense* above).

**Polyphony** is set per page: **Poly** lets several pads ring at once; **Mono** stops the
previous sound when a new pad starts. Hit **Stop all** in the bottom bar to silence
everything at once.

<br clear="all" />

### 3. Configuring a pad (Edit mode)

<img src="fastlane/metadata/android/en-US/images/phoneScreenshots/5.png" width="320" align="right" alt="The pad settings drawer" />

Switch to **Edit** (the pencil) and tap a pad to open its settings drawer:

- **Name** — the label shown on the pad.
- **Play mode** — choose **One-Shot**, **Gate** or **Loop** (see above).
- **Gain** — per-pad volume trim, in dB.
- **Color** — pick a tile colour (or *none*) to organize your board visually.
- **Sample** — the library sound bound to this pad; tap to swap it for another.
- **Delete the pad** — removes it from the page (the sound stays in your library).

In Edit mode you can also tap an empty cell to create a pad, and manage pages from the
tabs (add, rename, reorder, resize the grid).

<br clear="all" />

### 4. The library

<img src="fastlane/metadata/android/en-US/images/phoneScreenshots/3.png" width="320" align="right" alt="The sound library" />

Open the **Library** (music-note icon) to manage every sound.

- **Import a sound** — add your own audio; multi-select and **zip/rar** archives are
  supported. Files are re-encoded to compact **OGG/Opus** automatically.
- **Search** and **tag filters** (*Alert, Ambience, Jingle, Meme, Music, Quotes,
  Reaction, SFX, Voice…*) narrow a big library fast; **Manage tags** edits the list.
- Each sound shows its **size, duration and waveform**, plus row actions:
  - ▶ **Preview** the sound.
  - ✂ **Trim** it (see next section).
  - 👆 **Assign to a pad** — arm the sound, then tap the pads that should receive it.
  - ▧ **Add to the assignment pool**.
  - 🏷 **Tag** it.
  - 🗑 **Delete** it.

<br clear="all" />

### 5. Trimming a sound

<img src="fastlane/metadata/android/en-US/images/phoneScreenshots/4.png" width="320" align="right" alt="The trim / waveform editor" />

The waveform editor lets you keep just the part you want. Drag the edges to set the
**start** and **end**; the read-out shows the selected window (e.g. *0 s – 1.19 s*).
Use **undo/redo** and the **play** button to check your selection, then **Apply** (or
**Cancel**).

There are two flavours:

- **Trim** (from the library) — bakes the crop into the stored file: smaller, permanent.
- **Cue points** (from a pad) — a **non-destructive** `[start, end]` window stored on the
  pad. The original sample is untouched, and several pads can cue the same sample
  differently. Loop respects the window; clear it any time.

<br clear="all" />

---

## Install

### Web / PWA (recommended)

Just open the **[live demo](https://fchaussin.github.io/sampleboard/)** and install it
from your browser. It persists everything in the browser (IndexedDB) and works fully
offline, including the very first launch.

### Self-hosting with Docker

Build and run the web flavor from the repository:

```bash
git clone https://github.com/fchaussin/sampleboard.git && cd sampleboard
docker compose -f docker-compose.web.yml up -d --build
# then open http://localhost:8080 and install the PWA from your browser
```

Serving behind a reverse proxy? Use HTTPS — service workers require a secure context.
A prebuilt **Docker Hub** image (`fchaussin/sampleboard`) is planned:

```bash
# COMING SOON — once the image is published:
docker run -d --name sampleboard -p 8080:8080 fchaussin/sampleboard
```

### Android (F-Droid) — *in preparation*

The **F-Droid** submission is being finalized (reproducible build, WASM compiled from
source, audited licenses). Until then, test APKs can be built from source (see
[`doc/`](./doc/)).

## Your data

Everything is local: sounds and settings live on your device (browser storage on the
web/PWA, SQLite on Android). No network, no account, nothing leaves your machine.

## License

Code under **[GPL-3.0-or-later](./LICENSE)**. Starter-bank sounds: **CC0 1.0** (source and
author of each sound in `public/factory-samples/manifest.json`).

## Contributing & documentation

Developer documentation (Docker-based toolchain, architecture, tests, specs, roadmap)
lives in [`doc/`](./doc/), [`specifications.md`](./specifications.md) and
[`roadmap.md`](./roadmap.md).
