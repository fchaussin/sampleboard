<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Documentation Sampleboard

Doc **vivante**, tenue à jour au fil de l'implémentation. Elle est **séparée de la
spécification** :

- [`specifications.md`](../specifications.md) — le **quoi/pourquoi** : décisions figées,
  architecture, vocabulaire. Change rarement.
- `doc/` (ici) — le **comment** : guides d'utilisation et de développement de ce qui est
  **réellement implémenté**. Suit le code.

## Conventions : garde-fous automatiques (`.claude/hooks/`)

À chaque `git commit`, deux hooks `PreToolUse` (déclarés dans `.claude/settings.json`) appliquent
les règles projet :

- **doc-sync** (`doc-sync.sh`, non bloquant) — tout commit qui touche l'implémentation (`src/`,
  `src-tauri/src/`) met à jour la doc correspondante dans `doc/`. Signale un commit de code sans
  mise à jour de `doc/`. Les commits purement chore/refactor peuvent s'en dispenser en
  connaissance de cause.
- **tests-gate** (`tests-gate.sh`) — avertit si du code est commité sans test et **exécute la
  suite en Docker, bloquant le commit si elle échoue**. Voir [tests](./tests.md).

## Sommaire

- [Environnement Docker (dev / prod)](./environnement-docker.md)
- [Moteur audio (M1)](./moteur-audio.md)
- [Cœur jouable (M2)](./coeur-jeu.md)
- [Édition (M3)](./edition.md)
- [Bibliothèque & import (M4)](./bibliotheque-import.md)
- [Persistance & réglages (M5)](./persistance-reglages.md)
- [Audit FOSS des dépendances (M6)](./audit-foss.md)
- [Tests](./tests.md)
