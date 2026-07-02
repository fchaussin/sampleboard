// SPDX-License-Identifier: GPL-3.0-or-later
// Dépôt des tags de samples (M8, §16) : CRUD des tags + affectations n-à-n en SQLite.
// « Non classé » n'existe pas ici : c'est l'absence d'affectation (filtre virtuel).
import type { Tag } from '../domain/types';
import { NO_LOCK, type SqlExecutor, type WriteLock } from './db';
import type { TagRepository } from './types';

interface TagRow {
  id: string;
  label: string;
}

interface AssignmentRow {
  sample_id: string;
  tag_id: string;
}

export function createTagRepository(db: SqlExecutor, lock: WriteLock = NO_LOCK): TagRepository {
  return {
    async list(): Promise<Tag[]> {
      return db.select<TagRow>('SELECT id, label FROM tags ORDER BY label');
    },

    create(tag: Tag): Promise<void> {
      return lock(async () => {
        await db.execute('INSERT INTO tags (id, label) VALUES (?, ?)', [tag.id, tag.label]);
      });
    },

    rename(tagId: string, label: string): Promise<void> {
      return lock(async () => {
        await db.execute('UPDATE tags SET label = ? WHERE id = ?', [label, tagId]);
      });
    },

    remove(tagId: string): Promise<void> {
      return lock(async () => {
        // Les affectations suivent (ON DELETE CASCADE sur sample_tags).
        await db.execute('DELETE FROM tags WHERE id = ?', [tagId]);
      });
    },

    async assignments(): Promise<Map<string, Set<string>>> {
      const rows = await db.select<AssignmentRow>('SELECT sample_id, tag_id FROM sample_tags');
      const map = new Map<string, Set<string>>();
      for (const row of rows) {
        let set = map.get(row.sample_id);
        if (!set) {
          set = new Set();
          map.set(row.sample_id, set);
        }
        set.add(row.tag_id);
      }
      return map;
    },

    assign(sampleId: string, tagId: string): Promise<void> {
      return lock(async () => {
        await db.execute(
          'INSERT INTO sample_tags (sample_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
          [sampleId, tagId],
        );
      });
    },

    unassign(sampleId: string, tagId: string): Promise<void> {
      return lock(async () => {
        await db.execute('DELETE FROM sample_tags WHERE sample_id = ? AND tag_id = ?', [
          sampleId,
          tagId,
        ]);
      });
    },
  };
}
