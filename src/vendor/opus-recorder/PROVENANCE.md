<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# encoderWorker.min.js — build from source (M9, exigence F-Droid)

Encodeur OGG/Opus WASM de l'app (`src/engine/encoder.ts`), **construit depuis les sources**
— l'artefact pré-compilé du paquet npm `opus-recorder` n'est plus utilisé à l'exécution
(le paquet reste en dépendance pour référence de version uniquement).

## Sources

| Composant | Référence | Licence |
|---|---|---|
| opus-recorder | tag `v8.0.5` (github.com/chris-rudmin/opus-recorder) | MIT |
| libopus | sous-module épinglé par SHA dans le tag (v1.3.1, gitlab.xiph.org/xiph/opus) | BSD-3-Clause |
| speexdsp | sous-module épinglé par SHA dans le tag (1.2.0, gitlab.xiph.org/xiph/speexdsp) | BSD-3-Clause |

## Toolchain & recette

`emscripten/emsdk:3.1.26` (image Docker épinglée) ; recette **identique à la cible
`$(LIBOPUS_ENCODER_MIN)` du Makefile upstream** (`-O3`, `NO_DYNAMIC_EXECUTION`,
`NO_FILESYSTEM`, `SINGLE_FILE` — WASM inliné). Voir `docker/wasm/Dockerfile`.

Reconstruction : `./scripts/build-opus-wasm.sh` (Docker rootless, zéro pollution hôte).

## Empreinte

```
sha256 2313c9dea8b7fcfbff60ec2de0928a152ad1d8b48a1553d5d2d79fb89b95991b  encoderWorker.min.js
```

L'artefact npm (même version, emsdk upstream non épinglé) diffère à l'octet — le nôtre fait
foi et est validé par les tests de bout en bout (`e2e/encoder-duration.spec.ts`, imports).
