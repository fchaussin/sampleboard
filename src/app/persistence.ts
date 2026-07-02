// SPDX-License-Identifier: GPL-3.0-or-later
// Coordinateur d'autosave — abonné réactif UNIQUE (voir §9, décision A).
// Banque : débounce (~400 ms) sur tout changement de l'arbre. Réglages : écriture immédiate.
// L'import, lui, écrit immédiatement via son dépôt dans la commande (hors de ce module).
// TS pur : la réactivité est injectée (`watch`, implémentée en runes dans watch.svelte.ts).
import type { Bank, Settings } from '../domain/types';
import type { BankRepository, SettingsRepository } from '../storage/types';
import type { AppStore } from './store.svelte';

/**
 * Abonnement réactif : relit `read` à chaque mutation de ce qu'il consulte et appelle
 * `onChange` avec la nouvelle valeur (PAS au premier passage). Renvoie le désabonnement.
 */
export type Watch = <T>(read: () => T, onChange: (value: T) => void) => () => void;

export interface PersistenceDeps {
  store: AppStore;
  bankRepository: BankRepository;
  settingsRepository: SettingsRepository;
  watch: Watch;
  /** Délai de débounce de la banque, en ms (défaut 400 — voir §9). */
  debounceMs?: number;
}

export interface Persistence {
  /** Démarre l'abonnement d'autosave (APRÈS hydratation, sinon le défaut écraserait la base). */
  start(): void;
  /** Arrête l'abonnement (démontage). */
  stop(): void;
  /** Écrit sans attendre la fin du débounce (mise en arrière-plan, fermeture). */
  flush(): Promise<void>;
}

export function createPersistence({
  store,
  bankRepository,
  settingsRepository,
  watch,
  debounceMs = 400,
}: PersistenceDeps): Persistence {
  let unsubscribes: Array<() => void> = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingBank: Bank | null = null;
  // Les écritures s'enchaînent (jamais deux sauvegardes concurrentes) ; un échec est
  // journalisé sans casser la chaîne — la sauvegarde suivante repart d'un état complet.
  let queue: Promise<void> = Promise.resolve();

  function enqueue(job: () => Promise<void>): Promise<void> {
    queue = queue.then(job).catch((err) => {
      console.error('persistence: échec de sauvegarde', err);
    });
    return queue;
  }

  function saveBankNow(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const bank = pendingBank;
    pendingBank = null;
    if (!bank) return queue;
    return enqueue(() => bankRepository.save(bank));
  }

  function onBankChanged(bank: Bank | null): void {
    if (!bank) return;
    pendingBank = bank; // le dernier état gagne : un seul save par rafale
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void saveBankNow(), debounceMs);
  }

  function onSettingsChanged(settings: Settings): void {
    void enqueue(() => settingsRepository.save(settings));
  }

  return {
    start(): void {
      if (unsubscribes.length > 0) return; // déjà démarré
      unsubscribes = [
        watch(() => (store.bank ? snapshotBank(store.bank) : null), onBankChanged),
        watch(() => ({ ...store.settings }), onSettingsChanged),
      ];
    },
    stop(): void {
      for (const unsubscribe of unsubscribes) unsubscribe();
      unsubscribes = [];
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pendingBank = null;
    },
    flush(): Promise<void> {
      return saveBankNow();
    },
  };
}

/**
 * Copie profonde explicite de l'arbre banque. Lire chaque champ un à un fait double emploi
 * volontaire : le watcher réactif s'abonne ainsi à TOUTES les feuilles de l'arbre, et le
 * snapshot sauvegardé est découplé des mutations ultérieures du store.
 */
export function snapshotBank(bank: Bank): Bank {
  return {
    id: bank.id,
    name: bank.name,
    pages: bank.pages.map((p) => ({
      id: p.id,
      name: p.name,
      voiceMode: p.voiceMode,
      rows: p.rows,
      cols: p.cols,
      position: p.position,
    })),
    pads: bank.pads.map((p) => ({
      id: p.id,
      pageId: p.pageId,
      name: p.name,
      sampleId: p.sampleId,
      playMode: p.playMode,
      gainDb: p.gainDb,
      position: p.position,
    })),
  };
}
