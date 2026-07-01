#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# S'assure que node_modules (volume Docker) est installé et à jour vis-à-vis du
# lockfile, puis délègue à la commande demandée. Installation reproductible via `npm ci`.
set -euo pipefail

MARKER="node_modules/.installed"

if [ ! -e "$MARKER" ] || [ package-lock.json -nt "$MARKER" ]; then
  echo "[entrypoint] Installation des dépendances npm (npm ci)…"
  npm ci
  touch "$MARKER"
fi

exec "$@"
