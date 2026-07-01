// SPDX-License-Identifier: GPL-3.0-or-later
// Config de test (Vitest). Tests unitaires TS purs du cœur (domain/engine) : environnement
// Node, Web Audio simulé par injection (aucune dépendance navigateur).
// Les tests vivent dans un répertoire dédié `tests/`, séparé de `src/`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
