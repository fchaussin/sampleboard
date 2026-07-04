<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Docker environment (dev / prod)

The whole toolchain (Node, Rust, Tauri dependencies) lives in Docker images. **Nothing is
installed on the host**: `node_modules`, `src-tauri/target` and the cargo/npm caches are
**Docker volumes**. Two separate environments: **dev** and **prod**.

## Principles

- **Rootless**: designed for Docker rootless. The container runs as the *container's root*,
  which maps to your **unprivileged** host user (rootless mapping). The rootless engine is
  what guarantees non-privilege, not the internal uid — which also avoids permission
  conflicts on bind-mounted files.
- **Hardened**: `cap_drop: ALL` + `no-new-privileges` everywhere, `tmpfs /tmp`, and
  **read-only source** for prod (deterministic build).
- **Portable**: multi-arch image (amd64/arm64), configurable UID/GID (`.env`), compatible
  with rootful/rootless Docker and Podman.
- **Rootful host**: uncomment `user:` in `docker-compose.dev.yml` to avoid actually being
  root.

## Files

| File | Role |
|---|---|
| `docker/Dockerfile` | Multi-stage: `base` (toolchain) → `dev`, `prod`. |
| `docker/entrypoint.sh` | Installs npm deps (`npm ci`) into the volume on first launch. |
| `docker-compose.dev.yml` | **dev** service (Vite HMR, `tauri dev`). |
| `docker-compose.prod.yml` | **prod** service (release build → `./artifacts`). |
| `docker-compose.android.yml` | **android** service (M6): pinned SDK/NDK/JDK, init + APK build. |
| `docker-compose.gui.yml` | X11 overlay to open the `tauri dev` window. |
| `.env.example` | UID/GID (portability) — `cp .env.example .env`. |

## Development

```bash
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml run --rm dev npm run check   # types
docker compose -f docker-compose.dev.yml up dev                       # Vite -> localhost:1420
docker compose -f docker-compose.dev.yml run --rm dev bash            # shell
```

**Tauri desktop** window (X server required; WSLg or Linux+X, otherwise `xhost +local:`):

```bash
docker compose -f docker-compose.dev.yml -f docker-compose.gui.yml run --rm dev npm run tauri dev
```

Since M5:

- **App data persisted**: the **`app-home`** volume (`/home/app`) holds the SQLite database
  (`~/.config/org.sampleboard.app/sampleboard.db`) and the audio files
  (`~/.local/share/org.sampleboard.app/audio/`) — bank, library and settings survive
  `run --rm`. To start from scratch: `docker volume rm ambianceur_app-home`.
- **Audio**: the GUI overlay exports `PULSE_SERVER` to the WSLg PulseAudio socket
  (`/mnt/wslg/PulseServer`, already bind-mounted) — without it, WebKitGTK has no output and
  the pads stay silent. Native Linux: `PULSE_SERVER=unix:$XDG_RUNTIME_DIR/pulse/native` in
  the environment before `docker compose`.

## Production (artifact build)

Sampleboard is a **client** app: "prod" does not run a server, it **produces the artifact**
then exits.

```bash
mkdir -p artifacts
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm prod
# -> prod frontend in ./artifacts/ ; release binary in the prod-target volume.
```

## Android (M6)

`android` image stage: JDK 17 + **pinned** Android SDK/NDK (cmdline-tools 11076708,
platform 34, build-tools 34.0.0, NDK 26.1.10909125) + Rust Android targets. The generated
Android project (`src-tauri/gen/android/`) is **committed**; `build/`, `.gradle`, `.tauri`
are ignored.

```bash
docker compose -f docker-compose.android.yml build
# (already done, once) docker compose -f docker-compose.android.yml run --rm android npm run tauri android init
docker compose -f docker-compose.android.yml run --rm android npm run tauri android build -- --apk --debug --target aarch64
docker compose -f docker-compose.android.yml run --rm android npm run tauri android build -- --apk --target aarch64   # release (unsigned)
# -> src-tauri/gen/android/app/build/outputs/apk/universal/{debug,release}/
```

Specifics:

- Gradle cache in the `gradle-cache` volume mounted at **`/root/.gradle`** (Gradle resolves
  `~` via /etc/passwd, not via `$HOME`).
- **`INTERNET` permission: debug builds only** (overlay
  `app/src/debug/AndroidManifest.xml`, required by `tauri android dev`); the **release** APK
  has **no permissions** (spec §16, v1 offline).
- Android `versionCode` derived from `version` in `tauri.conf.json` — **must be aligned at
  every release** (part of the end-of-milestone ritual).

## Prerequisites (once, host)

Docker rootless. System prerequisites: `uidmap`, `slirp4netns`, `dbus-user-session` (the only
root packages, generic to any rootless container), then Docker rootless installed in
`$HOME` (`get.docker.com/rootless`). See also the root `README.md`.

## Cleanup

```bash
docker compose -f docker-compose.dev.yml down -v    # + dev volumes
docker image rm sampleboard-dev sampleboard-prod
```
