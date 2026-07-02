// SPDX-License-Identifier: GPL-3.0-or-later
// Adaptateurs Tauri : SQL (tauri-plugin-sql) + fichiers audio (tauri-plugin-fs).
// SEUL module de storage/ qui touche les plugins ; les dépôts, eux, restent TS pur injectable.
import Database from '@tauri-apps/plugin-sql';
import { BaseDirectory, mkdir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs';
import { DB_URL, type SqlExecutor } from './db';
import type { AudioFileStore } from './types';

/** Sous-répertoire des octets audio dans {appDataDir} (voir §8, §13). */
const AUDIO_DIR = 'audio';

/** Exécuteur SQL branché sur la base native de l'app. */
export async function createTauriSqlExecutor(): Promise<SqlExecutor> {
  const db = await Database.load(DB_URL);
  return {
    async execute(sql: string, params?: unknown[]): Promise<void> {
      await db.execute(sql, params);
    },
    select<T>(sql: string, params?: unknown[]): Promise<T[]> {
      return db.select<T[]>(sql, params);
    },
  };
}

/** Fichiers audio de la bibliothèque sous {appDataDir}/audio/. */
export function createTauriAudioFileStore(): AudioFileStore {
  const base = { baseDir: BaseDirectory.AppData };
  // Création paresseuse et mémorisée du répertoire (premier lancement inclus).
  let dirReady: Promise<void> | null = null;
  const ensureDir = (): Promise<void> => (dirReady ??= mkdir(AUDIO_DIR, { ...base, recursive: true }));

  return {
    async write(fileName: string, data: Uint8Array): Promise<void> {
      await ensureDir();
      await writeFile(`${AUDIO_DIR}/${fileName}`, data, base);
    },
    read(fileName: string): Promise<Uint8Array> {
      return readFile(`${AUDIO_DIR}/${fileName}`, base);
    },
    async remove(fileName: string): Promise<void> {
      await remove(`${AUDIO_DIR}/${fileName}`, base);
    },
  };
}
