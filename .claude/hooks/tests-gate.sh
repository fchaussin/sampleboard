#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# tests-gate — à CHAQUE `git commit`, applique la règle projet :
#   « pour chaque feature, les tests nécessaires doivent être ÉCRITS, EXÉCUTÉS et VALIDÉS. »
#
# Deux niveaux :
#   1) Présence (non bloquant) — du code d'implémentation est commité sans aucun test → avertit.
#   2) Exécution (BLOQUANT)   — lance la suite de tests en Docker rootless ; si elle échoue,
#      le commit est refusé (exit 2). Si Docker est indisponible, on avertit sans bloquer
#      (les tests devront être validés manuellement).
#
# Déclenché par le hook PreToolUse (matcher Bash) défini dans .claude/settings.json.
set -uo pipefail

input="$(cat 2>/dev/null || true)"

# Ne concerne que les commandes `git commit`.
printf '%s' "$input" | grep -q 'git commit' || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

# --- 1) Présence de tests -----------------------------------------------------------------
staged="$(git diff --cached --name-only 2>/dev/null || true)"
[ -z "$staged" ] && exit 0

impl="$(printf '%s\n' "$staged" | grep -E '^(src|src-tauri/src)/' | grep -vE '\.(test|spec)\.' || true)"
tests="$(printf '%s\n' "$staged" | grep -E '\.(test|spec)\.[cm]?[jt]sx?$' || true)"

if [ -n "$impl" ] && [ -z "$tests" ]; then
  echo "⚠ tests-gate : du code d'implémentation est commité sans aucun test." >&2
  echo "  → Écris les tests nécessaires (Vitest, src/**/*.test.ts) AVANT de documenter la feature." >&2
  echo "    (Rappel règle projet : écrit → exécuté → validé, puis doc.)" >&2
fi

# --- 2) Exécution & validation de la suite ------------------------------------------------
# Docker rootless : ces variables ne sont pas toujours exportées dans un shell non interactif.
export PATH="$HOME/bin:$PATH"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/$(id -u)/bus}"
export DOCKER_HOST="${DOCKER_HOST:-unix:///run/user/$(id -u)/docker.sock}"

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "⚠ tests-gate : Docker rootless indisponible — suite de tests NON exécutée." >&2
  echo "  → Lance l'env dev puis valide manuellement : npm run test (dans le conteneur)." >&2
  exit 0   # non bloquant : on ne casse pas le commit si l'outillage n'est pas là.
fi

echo "▶ tests-gate : exécution de la suite de tests (Docker rootless)…" >&2
if output="$(docker compose -f docker-compose.dev.yml run --rm -T dev npm run test 2>&1)"; then
  echo "✓ tests-gate : suite verte — commit autorisé." >&2
  exit 0
else
  echo "$output" | tail -30 >&2
  echo "✗ tests-gate : la suite de tests ÉCHOUE — commit refusé." >&2
  echo "  → Corrige/complète les tests jusqu'au vert avant de committer." >&2
  exit 2   # bloquant : les tests doivent être VALIDÉS.
fi
