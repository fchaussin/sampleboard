<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Development quickstart

The entire toolchain (Node, Rust, Tauri system deps) lives **inside Docker** — nothing is
installed on the host. `node_modules`, `src-tauri/target` and the cargo/npm caches are
Docker volumes. Designed for **rootless** Docker (container root = your unprivileged host
user), hardened (`cap_drop: ALL`, `no-new-privileges`), multi-arch (amd64/arm64).

```bash
cp .env.example .env    # optional (UID/GID); defaults to 1000

# Dev
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml up dev                       # Vite -> localhost:1420
docker compose -f docker-compose.dev.yml exec dev npm run check       # typecheck
docker compose -f docker-compose.dev.yml exec dev npm test            # unit tests
docker compose -f docker-compose.dev.yml exec dev npx playwright test # e2e

# Tauri desktop window (X server required; otherwise `xhost +local:`)
docker compose -f docker-compose.dev.yml -f docker-compose.gui.yml run --rm dev npm run tauri dev

# Prod (reproducible release build -> ./artifacts)
mkdir -p artifacts && docker compose -f docker-compose.prod.yml run --rm prod
```

Full details (Android toolchain, GUI overlay, volumes, hardening):
[`docker-environment.md`](./docker-environment.md).

> Development happens through `tauri dev` (web frontend inside the native WebView), never
> in a bare browser tab — that is what provides native SQLite. The bare-browser dev server
> at :1420 uses in-memory repositories (session-only) until the M10 web/PWA milestone.

## Without Docker (host tooling)

If you prefer tooling the host: **Node.js** ≥ 20, **npm**, **Rust** (stable) + Tauri system
dependencies (WebKitGTK on Linux) — see <https://tauri.app/start/prerequisites/>. Then
`npm install` and `npm run tauri dev`.

## Conventions

- **Architecture**: one-way dependency `domain ← engine, storage ← app ← ui`; state
  mutations only in `src/app/commands.ts`; explicit composition root
  (`src/app/create-app.ts`). See [`specifications.md`](../specifications.md) §4-§5.
- **i18n**: multilingual app, **zero hardcoded text** — keys only (`t('key')`),
  translations in `src/ui/i18n/*.json`, `fr.json` is the default and fallback. Code and
  SQLite schema are in neutral English.
- **Icons**: `src-tauri/icons/` are placeholders — regenerate from a real logo with
  `npm run tauri icon <source.png>`.
