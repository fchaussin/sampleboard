// SPDX-License-Identifier: GPL-3.0-or-later
// Wrapper SQL + migrations en séquence selon user_version — voir specifications.md §8.
// TS pur : l'exécuteur concret est injecté (tauri-plugin-sql en prod via tauri.ts,
// node:sqlite dans les tests). Jamais de modification destructive silencieuse.

/** Nom du fichier SQLite dans le répertoire de données de l'app. */
export const DB_URL = 'sqlite:sampleboard.db';

/** Contrat minimal d'exécution SQL (le seul que les dépôts connaissent). */
export interface SqlExecutor {
  execute(sql: string, params?: unknown[]): Promise<void>;
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

/** Une migration = un `user_version` cible + ses instructions, appliquées dans l'ordre. */
export interface Migration {
  version: number;
  statements: string[];
}

/** Exécute `job` avec exclusivité sur la base (les jobs s'enchaînent, jamais entrelacés). */
export type WriteLock = <T>(job: () => Promise<T>) => Promise<T>;

/** Verrou par défaut des dépôts : passant (les tests séquentiels n'en ont pas besoin). */
export const NO_LOCK: WriteLock = (job) => job();

/**
 * Verrou d'écriture PARTAGÉ entre les dépôts (créé une fois dans la composition root).
 * Indispensable avec tauri-plugin-sql : son pool sqlx ouvre une connexion par requête
 * concurrente — deux opérations entrelacées casseraient la transaction de bank-repository
 * (BEGIN et COMMIT sur des connexions différentes) ou y feraient entrer des écritures
 * étrangères. Sérialisées, les écritures restent sur une seule et même connexion.
 */
export function createWriteLock(): WriteLock {
  let tail: Promise<unknown> = Promise.resolve();
  return (job) => {
    // S'accroche à la fin de la file, que le job précédent ait réussi ou non.
    const run = tail.then(job, job);
    tail = run.catch(() => undefined); // un échec ne bloque jamais la file
    return run;
  };
}

// Schéma v1 (voir §8) : bank / pages / samples / pads / settings.
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE bank (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL
      )`,
      `CREATE TABLE pages (
        id          TEXT PRIMARY KEY,
        bank_id     TEXT NOT NULL REFERENCES bank(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        voice_mode  TEXT NOT NULL CHECK (voice_mode IN ('mono','poly')),
        rows        INTEGER NOT NULL DEFAULT 4 CHECK (rows BETWEEN 2 AND 12),
        cols        INTEGER NOT NULL DEFAULT 4 CHECK (cols BETWEEN 2 AND 6),
        position    INTEGER NOT NULL
      )`,
      `CREATE TABLE samples (
        id            TEXT PRIMARY KEY,
        label         TEXT NOT NULL,
        file_name     TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime          TEXT NOT NULL,
        size_bytes    INTEGER NOT NULL,
        duration_ms   INTEGER,
        created_at    INTEGER NOT NULL
      )`,
      `CREATE TABLE pads (
        id          TEXT PRIMARY KEY,
        page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        sample_id   TEXT REFERENCES samples(id) ON DELETE SET NULL,
        play_mode   TEXT NOT NULL CHECK (play_mode IN ('oneShot','gate','loop')),
        gain_db     REAL NOT NULL DEFAULT 0.0 CHECK (gain_db BETWEEN -60 AND 6),
        position    INTEGER NOT NULL
      )`,
      `CREATE TABLE settings (
        id                  INTEGER PRIMARY KEY CHECK (id = 0),
        background_behavior TEXT NOT NULL DEFAULT 'stopAll'
                              CHECK (background_behavior IN ('stopAll','stopSustained','keepPlaying')),
        max_voices          INTEGER NOT NULL DEFAULT 8 CHECK (max_voices >= 1),
        locale              TEXT NOT NULL DEFAULT 'fr'
      )`,
    ],
  },
];

/**
 * Ouvre la base : active les clés étrangères puis applique les migrations manquantes
 * en séquence croissante, en avançant `user_version` après chacune.
 */
export async function openDatabase(db: SqlExecutor, migrations: Migration[] = MIGRATIONS): Promise<void> {
  await db.execute('PRAGMA foreign_keys = ON');
  const rows = await db.select<{ user_version: number }>('PRAGMA user_version');
  let current = Number(rows[0]?.user_version ?? 0);

  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (migration.version <= current) continue;
    for (const statement of migration.statements) {
      await db.execute(statement);
    }
    await db.execute(`PRAGMA user_version = ${migration.version}`);
    current = migration.version;
  }
}
