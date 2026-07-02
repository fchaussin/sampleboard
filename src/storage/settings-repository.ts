// SPDX-License-Identifier: GPL-3.0-or-later
// Dépôt réglages globaux : ligne unique (id = 0) dans `settings` (voir §8).
import type { BackgroundBehavior } from '../domain/enums';
import type { Settings } from '../domain/types';
import { defaultSettings } from '../domain/invariants';
import { NO_LOCK, type SqlExecutor, type WriteLock } from './db';
import type { SettingsRepository } from './types';

interface SettingsRow {
  background_behavior: BackgroundBehavior;
  max_voices: number;
  locale: string;
}

export function createSettingsRepository(db: SqlExecutor, lock: WriteLock = NO_LOCK): SettingsRepository {
  return {
    async load(): Promise<Settings> {
      const rows = await db.select<SettingsRow>(
        'SELECT background_behavior, max_voices, locale FROM settings WHERE id = 0',
      );
      const row = rows[0];
      if (!row) return defaultSettings();
      return {
        backgroundBehavior: row.background_behavior,
        maxVoices: row.max_voices,
        locale: row.locale,
      };
    },

    save(settings: Settings): Promise<void> {
      return lock(async () => {
        await db.execute(
          `INSERT INTO settings (id, background_behavior, max_voices, locale)
           VALUES (0, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET background_behavior = excluded.background_behavior,
             max_voices = excluded.max_voices, locale = excluded.locale`,
          [settings.backgroundBehavior, settings.maxVoices, settings.locale],
        );
      });
    },
  };
}
