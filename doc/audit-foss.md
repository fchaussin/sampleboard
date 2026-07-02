<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Audit FOSS des dépendances (jalon M6)

Exigence F-Droid (spec §15) : **100 % FOSS**, aucune dépendance Google Play Services /
Firebase, aucun tracker, aucune transitive propriétaire. Audit réalisé le 2026-07-02 sur le
jeu de dépendances verrouillé (`package-lock.json`, `Cargo.lock`, Gradle du projet généré).

## Méthode

- **npm (runtime)** : parcours récursif des `dependencies` de production depuis
  `package.json` (ce que Vite embarque dans le bundle) ; lecture du champ `license` de chaque
  paquet. Les devDependencies (Vite, Svelte, Vitest, Playwright…) ne sont **pas expédiées**.
- **Rust** : `cargo metadata` sur `src-tauri` → champ `license` des 467 crates du graphe
  complet (sur-ensemble : inclut des crates desktop-only comme dbus, absentes du build
  Android).
- **Gradle (Android)** : lecture des `dependencies` de
  `src-tauri/gen/android/app/build.gradle.kts` (template Tauri).

## Résultats

### npm — 5 paquets runtime, tous permissifs

| Paquet | Licence |
|---|---|
| `@tauri-apps/api`, `plugin-sql`, `plugin-fs`, `plugin-dialog` | Apache-2.0 OR MIT |
| `opus-recorder` | MIT |

`opus-recorder` **embarque en WASM** : libopus (**BSD-3-Clause**), libogg (**BSD-3-Clause**),
speexdsp (**BSD-3-Clause**) — permissives, compatibles GPL-3.0-or-later. Rappel : la
reconstruction from-source de ce WASM est une tâche de reproductibilité M6 (voir roadmap).

### Rust — 467 crates, zéro copyleft fort tiers, zéro propriétaire

Distribution : MIT / Apache-2.0 (majorité écrasante), BSD-2/3-Clause, Zlib, ISC,
Unicode-3.0, Unlicense/CC0/0BSD, **MPL-2.0** (5 crates — copyleft *par fichier*, compatible
GPL et accepté F-Droid). Aucune licence non déclarée. L'unique `GPL-3.0-or-later` du graphe
est **sampleboard lui-même**.

### Gradle — AndroidX + Material, tous Apache-2.0

`androidx.webkit`, `androidx.appcompat`, `androidx.activity-ktx`,
`androidx.lifecycle-process`, `com.google.android.material` : **Apache-2.0**.
Material Components est une bibliothèque FOSS publiée par Google — ce n'est **pas** Play
Services ; aucune dépendance Firebase/GMS, aucun tracker. `junit` (EPL-1.0) et
`androidx.test.*` : **tests uniquement**, non expédiés.

### Permissions Android

L'APK **release** ne demande **aucune permission** — pas de réseau (spec §16, v1 100 %
hors-ligne). `INTERNET` n'existe que dans l'overlay debug
(`app/src/debug/AndroidManifest.xml`) pour `tauri android dev` (chargement du serveur Vite).

## Conclusion

**Conforme.** Aucune dépendance propriétaire ni Play Services dans ce qui est expédié ;
licences toutes compatibles GPL-3.0-or-later et politiques F-Droid.

À re-vérifier à chaque évolution de dépendances (`package-lock.json` / `Cargo.lock` /
`build.gradle.kts`) — rejouer la méthode ci-dessus.
