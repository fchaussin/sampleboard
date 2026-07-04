#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Reconstruit l'extracteur d'archives WASM depuis les sources (docker/wasm/
# Dockerfile.libarchive) et dépose worker-bundle.js + libarchive.wasm vendorisés dans
# src/vendor/libarchive/. Zéro pollution hôte (build + create + cp, pas de BuildKit requis).
# Vérifier ensuite les hash contre src/vendor/libarchive/PROVENANCE.md.
set -eu
cd "$(dirname "$0")/.."
docker build -f docker/wasm/Dockerfile.libarchive -t sampleboard-wasm-libarchive docker/wasm
mkdir -p src/vendor/libarchive
cid=$(docker create sampleboard-wasm-libarchive)
trap 'docker rm -f "$cid" > /dev/null' EXIT
docker cp "$cid:/build/dist/worker-bundle.js" src/vendor/libarchive/worker-bundle.js
docker cp "$cid:/build/dist/libarchive.wasm" src/vendor/libarchive/libarchive.wasm
sha256sum src/vendor/libarchive/worker-bundle.js src/vendor/libarchive/libarchive.wasm
