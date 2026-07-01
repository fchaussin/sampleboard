// SPDX-License-Identifier: GPL-3.0-or-later
// Dépôt réglages globaux : ligne unique dans `settings` (voir §8).
// Squelette M0 : implémentation au jalon M5.
import type { Settings } from '../domain/types';
import type { SettingsRepository } from './types';

export function createSettingsRepository(): SettingsRepository {
  return {
    async load(): Promise<Settings> {
      throw new Error('settings-repository: non implémenté (jalon M5)');
    },
    async save(_settings: Settings): Promise<void> {
      throw new Error('settings-repository: non implémenté (jalon M5)');
    },
  };
}
