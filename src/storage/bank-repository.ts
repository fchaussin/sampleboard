// SPDX-License-Identifier: GPL-3.0-or-later
// Dépôt banque : config sérialisable (banque, pages, pads) en SQLite (voir §8).
// Sauvegarde par upsert-puis-élagage : chaque ligne écrite reste valide même si une
// sauvegarde est interrompue — pas de fenêtre « tout supprimé, rien réinséré ».
import type { Bank, Pad, Page } from '../domain/types';
import type { PlayMode, VoiceMode } from '../domain/enums';
import { isValidColor } from '../domain/invariants';
import { NO_LOCK, type SqlExecutor, type WriteLock } from './db';
import type { BankRepository } from './types';

interface BankRow {
  id: string;
  name: string;
}

interface PageRow {
  id: string;
  name: string;
  voice_mode: VoiceMode;
  rows: number;
  cols: number;
  position: number;
  color: string | null;
}

interface PadRow {
  id: string;
  page_id: string;
  name: string;
  sample_id: string | null;
  play_mode: PlayMode;
  gain_db: number;
  position: number;
  color: string | null;
}

/** Token de palette relu : un token inconnu (palette réduite, donnée altérée) devient neutre. */
function sanitizeColor(value: string | null): Page['color'] {
  return isValidColor(value) ? value : null;
}

export function createBankRepository(db: SqlExecutor, lock: WriteLock = NO_LOCK): BankRepository {
  /** Supprime les lignes absentes de l'état courant (après upsert). */
  async function prune(table: 'pages' | 'pads', keptIds: string[]): Promise<void> {
    if (keptIds.length === 0) {
      await db.execute(`DELETE FROM ${table}`);
      return;
    }
    const placeholders = keptIds.map(() => '?').join(', ');
    await db.execute(`DELETE FROM ${table} WHERE id NOT IN (${placeholders})`, keptIds);
  }

  return {
    async load(): Promise<Bank | null> {
      const banks = await db.select<BankRow>('SELECT id, name FROM bank LIMIT 1');
      const bankRow = banks[0];
      if (!bankRow) return null;

      const pageRows = await db.select<PageRow>(
        'SELECT id, name, voice_mode, rows, cols, position, color FROM pages WHERE bank_id = ? ORDER BY position',
        [bankRow.id],
      );
      // Une banque a au moins une page (§6) : sans page, l'état est invalide → repartir du défaut.
      if (pageRows.length === 0) return null;

      const padRows = await db.select<PadRow>(
        `SELECT p.id, p.page_id, p.name, p.sample_id, p.play_mode, p.gain_db, p.position, p.color
         FROM pads p JOIN pages pg ON pg.id = p.page_id
         WHERE pg.bank_id = ? ORDER BY p.position`,
        [bankRow.id],
      );

      const pages: Page[] = pageRows.map((r) => ({
        id: r.id,
        name: r.name,
        voiceMode: r.voice_mode,
        rows: r.rows,
        cols: r.cols,
        position: r.position,
        color: sanitizeColor(r.color),
      }));
      const pads: Pad[] = padRows.map((r) => ({
        id: r.id,
        pageId: r.page_id,
        name: r.name,
        sampleId: r.sample_id,
        playMode: r.play_mode,
        gainDb: r.gain_db,
        position: r.position,
        color: sanitizeColor(r.color),
      }));
      return { id: bankRow.id, name: bankRow.name, pages, pads };
    },

    save(bank: Bank): Promise<void> {
      // Toute la transaction sous verrou : aucune autre écriture ne s'y entrelace.
      return lock(() => saveBank(bank));
    },
  };

  async function saveBank(bank: Bank): Promise<void> {
    await db.execute('BEGIN IMMEDIATE');
    try {
      await db.execute(
        `INSERT INTO bank (id, name) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
        [bank.id, bank.name],
      );
      // v1 mono-banque (§16) : toute autre banque résiduelle est purgée (cascade pages/pads).
      await db.execute('DELETE FROM bank WHERE id <> ?', [bank.id]);

      for (const page of bank.pages) {
        await db.execute(
          `INSERT INTO pages (id, bank_id, name, voice_mode, rows, cols, position, color)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET bank_id = excluded.bank_id, name = excluded.name,
             voice_mode = excluded.voice_mode, rows = excluded.rows, cols = excluded.cols,
             position = excluded.position, color = excluded.color`,
          [page.id, bank.id, page.name, page.voiceMode, page.rows, page.cols, page.position, page.color ?? null],
        );
      }
      await prune('pages', bank.pages.map((p) => p.id));

      for (const pad of bank.pads) {
        // sample_id via sous-requête : une référence pendante (sample supprimé entre-temps)
        // est écrite NULL au lieu de violer la clé étrangère.
        await db.execute(
          `INSERT INTO pads (id, page_id, name, sample_id, play_mode, gain_db, position, color)
           VALUES (?, ?, ?, (SELECT id FROM samples WHERE id = ?), ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET page_id = excluded.page_id, name = excluded.name,
             sample_id = excluded.sample_id, play_mode = excluded.play_mode,
             gain_db = excluded.gain_db, position = excluded.position, color = excluded.color`,
          [pad.id, pad.pageId, pad.name, pad.sampleId, pad.playMode, pad.gainDb, pad.position, pad.color ?? null],
        );
      }
      await prune('pads', bank.pads.map((p) => p.id));

      await db.execute('COMMIT');
    } catch (err) {
      try {
        await db.execute('ROLLBACK');
      } catch {
        // transaction déjà retombée : l'erreur d'origine prime
      }
      throw err;
    }
  }
}
