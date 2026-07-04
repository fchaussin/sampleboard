#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Reconstruit l'encodeur OGG/Opus WASM depuis les sources (voir docker/wasm/Dockerfile) et
# dépose l'artefact vendorisé dans src/vendor/opus-recorder/. Zéro pollution hôte : tout se
# passe dans Docker (sans BuildKit : build + create + cp). Relancer après tout changement de
# toolchain/ref, puis vérifier le hash contre src/vendor/opus-recorder/PROVENANCE.md.
set -eu
cd "$(dirname "$0")/.."
docker build -f docker/wasm/Dockerfile --target build -t sampleboard-wasm-opus docker/wasm
mkdir -p src/vendor/opus-recorder
cid=$(docker create sampleboard-wasm-opus)
trap 'docker rm -f "$cid" > /dev/null' EXIT
docker cp "$cid:/build/dist/encoderWorker.min.js" src/vendor/opus-recorder/encoderWorker.min.js
sha256sum src/vendor/opus-recorder/encoderWorker.min.js
