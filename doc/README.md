<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Sampleboard documentation

**Living** documentation, kept up to date as implementation progresses. It is **separate from
the specification**:

- [`specifications.md`](../specifications.md) — the **what/why**: frozen decisions,
  architecture, vocabulary. Rarely changes.
- `doc/` (here) — the **how**: usage and development guides for what is
  **actually implemented**. Follows the code.

## Conventions: automated guardrails (`.claude/hooks/`)

On every `git commit`, two `PreToolUse` hooks (declared in `.claude/settings.json`) enforce
the project rules:

- **doc-sync** (`doc-sync.sh`, non-blocking) — any commit touching the implementation (`src/`,
  `src-tauri/src/`) must update the corresponding documentation in `doc/`. Flags a code commit
  that does not update `doc/`. Purely chore/refactor commits may knowingly skip it.
- **tests-gate** (`tests-gate.sh`) — warns if code is committed without tests and **runs the
  suite in Docker, blocking the commit if it fails**. See [tests](./tests.md).

## Contents

- [Development quickstart](./development.md)
- [Docker environment (dev / prod)](./docker-environment.md)
- [Web distribution — PWA & Docker delivery (M10)](./web-distribution.md)
- [Audio engine (M1)](./audio-engine.md)
- [Playable core (M2)](./playable-core.md)
- [Editing (M3)](./editing.md)
- [Library & import (M4)](./library-import.md)
- [Persistence & settings (M5)](./persistence-settings.md)
- [Interface (M6)](./interface.md)
- [« Découper » audio editor (M7)](./audio-editor.md)
- [Factory samples (#14)](./factory-samples.md)
- [FOSS dependency audit (M7)](./foss-audit.md)
- [Tests](./tests.md)
