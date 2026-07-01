#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# doc-sync — rappel à CHAQUE `git commit` de tenir la doc (doc/) à jour, séparée des specs.
# Mécanisme volontairement NON bloquant (exit 0) : il signale, il ne casse jamais un commit.
# Déclenché par le hook PreToolUse (matcher Bash) défini dans .claude/settings.json.
set -euo pipefail

input="$(cat 2>/dev/null || true)"

# Ne concerne que les commandes `git commit`.
printf '%s' "$input" | grep -q 'git commit' || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

staged="$(git diff --cached --name-only 2>/dev/null || true)"
[ -z "$staged" ] && exit 0

impl="$(printf '%s\n' "$staged" | grep -E '^src/|^src-tauri/src/' || true)"
docs="$(printf '%s\n' "$staged" | grep -E '^doc/' || true)"

if [ -n "$impl" ] && [ -z "$docs" ]; then
  echo "⚠ doc-sync : du code d'implémentation est commité sans mise à jour de doc/." >&2
  echo "  → Documente la fonctionnalité dans doc/ (doc SÉPARÉE de specifications.md)," >&2
  echo "    ou assume un commit chore/refactor sans impact doc." >&2
fi

exit 0
