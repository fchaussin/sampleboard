// SPDX-License-Identifier: GPL-3.0-or-later
// Coordinateur d'autosave débouncé — abonné réactif UNIQUE (voir §9, décision A).
// Squelette M0 : le câblage réactif (config débouncée, réglages immédiats) arrive au jalon M5.
import type { BankRepository, SettingsRepository } from '../storage/types';
import type { AppStore } from './store.svelte';

export interface PersistenceDeps {
  store: AppStore;
  bankRepository: BankRepository;
  settingsRepository: SettingsRepository;
}

export interface Persistence {
  /** Démarre l'abonnement d'autosave. */
  start(): void;
  /** Arrête l'abonnement (démontage). */
  stop(): void;
}

export function createPersistence(_deps: PersistenceDeps): Persistence {
  return {
    start(): void {
      // TODO(M5) : $effect débouncé (~300–500 ms) sur l'arbre banque ;
      // écritures immédiates pour import et réglages.
    },
    stop(): void {
      // TODO(M5)
    },
  };
}
