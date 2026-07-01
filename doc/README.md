<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Documentation Sampleboard

Doc **vivante**, tenue à jour au fil de l'implémentation. Elle est **séparée de la
spécification** :

- [`specifications.md`](../specifications.md) — le **quoi/pourquoi** : décisions figées,
  architecture, vocabulaire. Change rarement.
- `doc/` (ici) — le **comment** : guides d'utilisation et de développement de ce qui est
  **réellement implémenté**. Suit le code.

## Convention : doc-sync à chaque commit

Tout commit qui touche l'implémentation (`src/`, `src-tauri/src/`) met à jour la doc
correspondante dans `doc/`. Un mécanisme le rappelle automatiquement :
`.claude/hooks/doc-sync.sh` (hook `PreToolUse` sur `git commit`, non bloquant) signale un
commit de code sans mise à jour de `doc/`. Les commits purement chore/refactor peuvent s'en
dispenser en connaissance de cause.

## Sommaire

- [Environnement Docker (dev / prod)](./environnement-docker.md)
