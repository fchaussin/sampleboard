<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# worker-bundle.js + libarchive.wasm — build from source (M9, exigence F-Droid)

Extracteur d'archives WASM de l'app (import zip/rar M8, `src/engine/archive.ts`, servi sous
`/libarchive/` par le plugin Vite), **construit depuis les sources** — les artefacts
pré-compilés du paquet npm `libarchive.js` (qui committe en outre ses binaires dans son
propre dépôt) ne sont plus utilisés à l'exécution.

## Sources (toutes épinglées, tarballs vérifiés par SHA-256 au build)

| Composant | Version | Licence |
|---|---|---|
| libarchive.js | tag `v2.0.2` (github.com/nika-begiashvili/libarchivejs) | MIT |
| libarchive | 3.7.2 (lecteurs zip + rar4/rar5 **clean-room** — jamais d'unrar officiel, §16) | BSD-2-Clause |
| zlib | 1.3 | Zlib |
| xz (liblzma) | 5.2.11 | LGPL-2.1 (liblzma : domaine public/0BSD selon fichiers) |
| bzip2 | 1.0.8 | bzip2-1.0.6 (BSD-like) |
| openssl | 1.0.2s | OpenSSL/SSLeay |

## Toolchain & recette

`emscripten/emsdk:3.1.45` (image épinglée — l'upstream part d'un tag flottant) ; recettes
codecs + libarchive et édition de liens **identiques à l'upstream**
(`lib/tools/docker/Dockerfile` + `lib/tools/build.sh` du tag v2.0.2), puis
`npm ci && npm run build` (rollup, dépendances figées par le package-lock du tag).
Voir `docker/wasm/Dockerfile.libarchive`.

Reconstruction : `./scripts/build-libarchive-wasm.sh` (Docker rootless, zéro pollution hôte).

## Empreintes

```
sha256 125b4317dab41645ca2f193ebb7f222c5cd45406907557c7b4db9226a8da8150  worker-bundle.js
sha256 7a134111568235252b6671bcc928471652d498ba9bb76df8ca9cb06bd7f63579  libarchive.wasm
```

Validation de bout en bout : e2e d'import d'archives (zip/rar) — le dépliage réel passe par
ces artefacts.
