<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Web distribution — PWA & Docker delivery (M10)

The web flavor is the SAME app as Android/Tauri, with browser-side persistence and an
offline-capable PWA shell. The Docker image is a **delivery mechanism** for it, not a
separate distribution (§16 decision).

## Browser persistence — IndexedDB repositories

`src/storage/idb.ts` implements the four `storage/types.ts` contracts (bank, samples +
audio bytes, settings, tags with n-to-n assignments) against IndexedDB:

- database `sampleboard` v1; stores: `kv` (bank/settings singletons), `samples`, `audio`
  (bytes keyed by fileName), `tags`, `sampleTags` (pair-keyed assignments);
- deletion cascades mirror the SQL schema (removing a sample deletes its bytes and
  assignments; removing a tag deletes its assignments);
- writes resolve on TRANSACTION COMPLETION (durable), reads merge settings over domain
  defaults (a setting added by an update gets its default);
- selected by the composition root whenever Tauri is absent and `indexedDB` exists — the
  in-memory repositories remain the test stand-in. First launch (bank, default tags,
  factory seeding) therefore happens ONCE per browser profile, like Tauri.

Tests: `tests/storage/idb.test.ts` (fake-indexeddb, dev-only) + `e2e/web-persistence.spec.ts`
(real browser: import → assign → reload → everything read back; deleted tags do not regrow).

## PWA — manifest + service worker

- `public/manifest.webmanifest` + icons (192/512 derived from the app icon), linked from
  `index.html` (with `theme-color`).
- `src/pwa/sw.js` is EMITTED AT BUILD by the `pwa-sw` Vite plugin (`vite.config.ts`),
  which injects: the real bundle file list (hashed js/css, libarchive worker+wasm, opus
  encoder worker), the **25 CC0 factory samples** (a first launch works fully offline,
  25/25 seeded from the precache), and a cache version derived from `package.json`.
- Strategies: **network-first for navigations** (updates propagate; cached fallback
  offline), **cache-first for same-origin GET assets** with runtime fill.
- `ignoreVary: true` on cache matches — some servers (vite preview) emit `Vary: Origin`,
  and the `Origin` header differs between install-time requests and document subresources
  (`crossorigin`), which made the FIRST offline reload miss the cache.
- Registered in **production web builds only**: never in dev (freshness hell), never in
  the Tauri WebView (its packaging is the APK).

## Docker delivery

```bash
docker compose -f docker-compose.web.yml up -d --build   # → http://localhost:8080
```

`docker/web/Dockerfile`: node:20-alpine build stage → `nginxinc/nginx-unprivileged`
(uid 101, listens on 8080 — allows `cap_drop: ALL`, `read_only`, `no-new-privileges`).
`docker/web/nginx.conf`: gzip, immutable cache for `/assets/`, `no-cache` for `sw.js`
and `index.html`, correct `application/wasm` MIME. Docker Hub publication planned
(`fchaussin/sampleboard`).

Note for reverse proxies: service workers require a secure context — serve over HTTPS
(or localhost). Nothing else is needed (fragment routing → no path fallback).

## Maintenance (Settings › Application, #31)

- **Reload to update** — non-destructive: asks the service worker to re-check, then
  reloads; navigations are network-first, so the latest published build is served as soon
  as it is reachable (offline falls back to the cache).
- **Erase all data…** — factory reset behind a native `<dialog>` confirmation: unregisters
  the SW, purges the caches, arms a `sessionStorage` flag and reloads; `main.ts` deletes
  the IndexedDB database at the NEXT boot, before any connection opens (a live connection
  would block `deleteDatabase`). The next start is a true first launch (starter bank
  reseeded).

## Validation performed

Against a production build (vite preview AND the nginx container): first load installs
the SW; offline reload renders the board; a first launch fully offline seeds 25/25 from
the precache; reloading offline on `#/library` restores the view from IndexedDB.
