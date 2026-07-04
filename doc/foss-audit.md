<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# FOSS audit of dependencies (milestone M6)

F-Droid requirement (spec §15): **100% FOSS**, no Google Play Services /
Firebase dependency, no tracker, no proprietary transitive. Audit performed on 2026-07-02 on the
locked dependency set (`package-lock.json`, `Cargo.lock`, Gradle of the generated project).

## Method

- **npm (runtime)**: recursive walk of the production `dependencies` from
  `package.json` (what Vite embeds in the bundle); reading the `license` field of each
  package. devDependencies (Vite, Svelte, Vitest, Playwright…) are **not shipped**.
- **Rust**: `cargo metadata` on `src-tauri` → `license` field of the 467 crates of the full
  graph (a superset: includes desktop-only crates such as dbus, absent from the Android
  build).
- **Gradle (Android)**: reading the `dependencies` of
  `src-tauri/gen/android/app/build.gradle.kts` (Tauri template).

## Results

### npm — 7 runtime packages, all permissive

| Package | License |
|---|---|
| `@tauri-apps/api`, `plugin-sql`, `plugin-fs`, `plugin-dialog` | Apache-2.0 OR MIT |
| `opus-recorder` | MIT |
| `libarchive.js` (+ dep. `comlink`) | MIT (comlink: Apache-2.0) |

`opus-recorder` **embeds as WASM**: libopus (**BSD-3-Clause**), libogg (**BSD-3-Clause**),
speexdsp (**BSD-3-Clause**) — permissive, compatible with GPL-3.0-or-later.
**Since M9, the executed artifact is rebuilt FROM SOURCE** (pinned emsdk toolchain,
submodules by SHA) and vendored: `src/vendor/opus-recorder/PROVENANCE.md`;
the pre-compiled WASM from the npm package is no longer used at runtime.

`libarchive.js` (M8 archive import, #13) **embeds as WASM**: libarchive
(**BSD-2-Clause**), including the zip and **clean-room rar4/rar5** readers — the official
unrar code (non-free license) **never** enters the app (decision §16).
**Since M9, worker + wasm are rebuilt FROM SOURCE** (pinned emsdk, source
tarballs — libarchive 3.7.2, zlib 1.3, xz 5.2.11, bzip2 1.0.8, openssl 1.0.2s — verified by
SHA-256) and vendored: `src/vendor/libarchive/PROVENANCE.md`.

### Rust — 467 crates, zero third-party strong copyleft, zero proprietary

Distribution: MIT / Apache-2.0 (overwhelming majority), BSD-2/3-Clause, Zlib, ISC,
Unicode-3.0, Unlicense/CC0/0BSD, **MPL-2.0** (5 crates — *per-file* copyleft, GPL-compatible
and accepted by F-Droid). No undeclared license. The only `GPL-3.0-or-later` in the graph
is **sampleboard itself**.

### Gradle — AndroidX + Material, all Apache-2.0

`androidx.webkit`, `androidx.appcompat`, `androidx.activity-ktx`,
`androidx.lifecycle-process`, `com.google.android.material`: **Apache-2.0**.
Material Components is a FOSS library published by Google — it is **not** Play
Services; no Firebase/GMS dependency, no tracker. `junit` (EPL-1.0) and
`androidx.test.*`: **tests only**, not shipped.

### Android permissions

The **release** APK requests **no permission** — no network (spec §16, v1 100%
offline). `INTERNET` only exists in the debug overlay
(`app/src/debug/AndroidManifest.xml`) for `tauri android dev` (loading the Vite server).

## Conclusion

**Compliant.** No proprietary or Play Services dependency in what is shipped;
all licenses compatible with GPL-3.0-or-later and F-Droid policies.

To re-verify at every dependency change (`package-lock.json` / `Cargo.lock` /
`build.gradle.kts`) — replay the method above.
