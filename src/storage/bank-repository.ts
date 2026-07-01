// SPDX-License-Identifier: GPL-3.0-or-later
// Dépôt banque : config sérialisable (banque, pages, pads) en SQLite (voir §8).
// Squelette M0 : implémentation au jalon M5.
import type { Bank } from '../domain/types';
import type { BankRepository } from './types';

export function createBankRepository(): BankRepository {
  return {
    async load(): Promise<Bank | null> {
      throw new Error('bank-repository: non implémenté (jalon M5)');
    },
    async save(_bank: Bank): Promise<void> {
      throw new Error('bank-repository: non implémenté (jalon M5)');
    },
  };
}
