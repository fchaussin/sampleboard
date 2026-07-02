// SPDX-License-Identifier: GPL-3.0-or-later
// Dépôt bibliothèque : métadonnées en SQLite + octets audio en fichiers (voir §8).
// {appDataDir}/audio/{sampleId}.ogg — jamais de BLOB. Suppression d'un sample encore
// référencé : les pads passent à NULL via ON DELETE SET NULL (décision §8).
import type { Sample } from '../domain/types';
import { NO_LOCK, type SqlExecutor, type WriteLock } from './db';
import type { AudioFileStore, SampleRepository } from './types';

interface SampleRow {
  id: string;
  label: string;
  file_name: string;
  original_name: string;
  mime: string;
  size_bytes: number;
  duration_ms: number | null;
  created_at: number;
}

export interface SampleRepositoryDeps {
  db: SqlExecutor;
  files: AudioFileStore;
  /** Verrou d'écriture partagé entre dépôts (voir db.ts › createWriteLock). */
  lock?: WriteLock;
}

export function createSampleRepository({ db, files, lock = NO_LOCK }: SampleRepositoryDeps): SampleRepository {
  return {
    async list(): Promise<Sample[]> {
      const rows = await db.select<SampleRow>(
        `SELECT id, label, file_name, original_name, mime, size_bytes, duration_ms, created_at
         FROM samples ORDER BY created_at, id`,
      );
      return rows.map((r) => ({
        id: r.id,
        label: r.label,
        fileName: r.file_name,
        originalName: r.original_name,
        mime: r.mime,
        sizeBytes: r.size_bytes,
        durationMs: r.duration_ms,
        createdAt: r.created_at,
      }));
    },

    add(sample: Sample, data: Uint8Array): Promise<void> {
      return lock(async () => {
        // Fichier d'abord : si l'insertion échoue ensuite, on retire le fichier (au pire un
        // orphelin inoffensif) ; l'inverse — une ligne sans fichier — serait un sample mort.
        await files.write(sample.fileName, data);
        try {
          await db.execute(
            `INSERT INTO samples (id, label, file_name, original_name, mime, size_bytes, duration_ms, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sample.id,
              sample.label,
              sample.fileName,
              sample.originalName,
              sample.mime,
              sample.sizeBytes,
              sample.durationMs,
              sample.createdAt,
            ],
          );
        } catch (err) {
          try {
            await files.remove(sample.fileName);
          } catch {
            // fichier orphelin : inoffensif, l'erreur d'origine prime
          }
          throw err;
        }
      });
    },

    rename(sampleId: string, label: string): Promise<void> {
      return lock(async () => {
        await db.execute('UPDATE samples SET label = ? WHERE id = ?', [label, sampleId]);
      });
    },

    replace(sample: Sample, data: Uint8Array): Promise<void> {
      return lock(async () => {
        // Retravail (M7) : même fichier réécrit, métadonnées dépendantes mises à jour.
        await files.write(sample.fileName, data);
        await db.execute('UPDATE samples SET size_bytes = ?, duration_ms = ? WHERE id = ?', [
          sample.sizeBytes,
          sample.durationMs,
          sample.id,
        ]);
      });
    },

    remove(sampleId: string): Promise<void> {
      return lock(async () => {
        const rows = await db.select<Pick<SampleRow, 'file_name'>>(
          'SELECT file_name FROM samples WHERE id = ?',
          [sampleId],
        );
        // La ligne d'abord (ON DELETE SET NULL sur les pads), le fichier ensuite.
        await db.execute('DELETE FROM samples WHERE id = ?', [sampleId]);
        const fileName = rows[0]?.file_name;
        if (fileName !== undefined) {
          try {
            await files.remove(fileName);
          } catch (err) {
            console.warn(`sample-repository: fichier orphelin non supprimé (${fileName})`, err);
          }
        }
      });
    },

    readBytes(fileName: string): Promise<Uint8Array> {
      return files.read(fileName);
    },
  };
}
