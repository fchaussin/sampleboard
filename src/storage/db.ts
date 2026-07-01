// SPDX-License-Identifier: GPL-3.0-or-later
// Wrapper tauri-plugin-sql + migrations (user_version) — voir specifications.md §8.
// Squelette M0 : le schéma SQLite et les migrations arrivent au jalon M5.

/** Nom du fichier SQLite dans le répertoire de données de l'app. */
export const DB_URL = 'sqlite:sampleboard.db';

/**
 * Ouvre la base et applique les migrations en séquence selon user_version.
 * TODO(M5) : charger tauri-plugin-sql, appliquer les migrations numérotées.
 */
export async function openDatabase(): Promise<void> {
  throw new Error('db: non implémenté (jalon M5)');
}
