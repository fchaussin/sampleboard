// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du coordinateur d'autosave (décision A, §9) : debounce banque, réglages immédiats,
// flush, arrêt, résilience aux échecs. Réactivité factice (contrat Watch), timers simulés.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPersistence, snapshotBank, type Watch } from '../../src/app/persistence';
import type { AppStore } from '../../src/app/store.svelte';
import type { Bank } from '../../src/domain/types';

function makeBank(): Bank {
  return {
    id: 'b',
    name: 'B',
    pages: [{ id: 'p', name: '', voiceMode: 'poly', rows: 4, cols: 4, position: 0, color: null }],
    pads: [
      { id: 'a', pageId: 'p', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 0, color: null, cueStart: null, cueEnd: null },
    ],
  };
}

function fakeStore(bank: Bank | null = makeBank()): AppStore {
  return {
    bank,
    samples: [],
    settings: { backgroundBehavior: 'stopAll', maxVoices: 8, locale: 'fr' },
    activePageId: null,
    editMode: false,
    selectedPadId: null,
    activePadIds: new Set<string>(),
  } as unknown as AppStore;
}

/** Réactivité factice : capture les abonnements, `fire(i)` simule une mutation observée. */
function fakeWatch() {
  const subs: Array<{ read: () => unknown; onChange: (v: unknown) => void }> = [];
  const watch = ((read: () => unknown, onChange: (v: unknown) => void) => {
    subs.push({ read, onChange });
    return () => {};
  }) as Watch;
  const fire = (i: number): void => {
    const sub = subs[i]!;
    sub.onChange(sub.read());
  };
  return { watch, subs, fire };
}

function setup(store = fakeStore()) {
  const { watch, subs, fire } = fakeWatch();
  const bankRepository = { load: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(undefined) };
  const settingsRepository = { load: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
  const persistence = createPersistence({
    store,
    bankRepository,
    settingsRepository,
    watch,
    debounceMs: 400,
  });
  return { store, persistence, bankRepository, settingsRepository, subs, fire };
}

const BANK = 0; // index d'abonnement banque
const SETTINGS = 1; // index d'abonnement réglages

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('persistence — autosave banque (débouncé)', () => {
  it('start abonne banque + réglages, sans aucune écriture initiale', () => {
    const { persistence, bankRepository, settingsRepository, subs } = setup();
    persistence.start();
    expect(subs).toHaveLength(2);
    expect(bankRepository.save).not.toHaveBeenCalled();
    expect(settingsRepository.save).not.toHaveBeenCalled();
  });

  it('un changement ne sauve qu’après le délai de debounce', async () => {
    const { persistence, bankRepository, fire } = setup();
    persistence.start();
    fire(BANK);
    await vi.advanceTimersByTimeAsync(399);
    expect(bankRepository.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(bankRepository.save).toHaveBeenCalledOnce();
  });

  it('une rafale de changements → une seule écriture, du dernier état', async () => {
    const { store, persistence, bankRepository, fire } = setup();
    persistence.start();
    fire(BANK);
    store.bank!.name = 'v2';
    fire(BANK);
    store.bank!.name = 'v3';
    fire(BANK);
    await vi.advanceTimersByTimeAsync(400);
    expect(bankRepository.save).toHaveBeenCalledOnce();
    expect(bankRepository.save.mock.calls[0]![0]).toMatchObject({ name: 'v3' });
  });

  it('le snapshot sauvegardé est découplé du store (mutation ultérieure sans effet)', async () => {
    const { store, persistence, bankRepository, fire } = setup();
    persistence.start();
    fire(BANK);
    await vi.advanceTimersByTimeAsync(400);
    const saved = bankRepository.save.mock.calls[0]![0] as Bank;
    store.bank!.pads[0]!.gainDb = -12;
    expect(saved.pads[0]!.gainDb).toBe(0);
  });

  it('flush écrit immédiatement le changement en attente', async () => {
    const { persistence, bankRepository, fire } = setup();
    persistence.start();
    fire(BANK);
    await persistence.flush();
    expect(bankRepository.save).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1000); // le timer annulé ne rejoue pas
    expect(bankRepository.save).toHaveBeenCalledOnce();
  });

  it('flush sans changement en attente : aucune écriture', async () => {
    const { persistence, bankRepository } = setup();
    persistence.start();
    await persistence.flush();
    expect(bankRepository.save).not.toHaveBeenCalled();
  });

  it('stop annule le debounce en cours', async () => {
    const { persistence, bankRepository, fire } = setup();
    persistence.start();
    fire(BANK);
    persistence.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(bankRepository.save).not.toHaveBeenCalled();
  });

  it('banque absente (null) : rien n’est écrit', async () => {
    const { persistence, bankRepository, fire } = setup(fakeStore(null));
    persistence.start();
    fire(BANK);
    await vi.advanceTimersByTimeAsync(400);
    expect(bankRepository.save).not.toHaveBeenCalled();
  });

  it('un échec d’écriture est absorbé : la sauvegarde suivante repart', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { persistence, bankRepository, fire } = setup();
    bankRepository.save.mockRejectedValueOnce(new Error('disque plein'));
    persistence.start();
    fire(BANK);
    await vi.advanceTimersByTimeAsync(400);
    fire(BANK);
    await vi.advanceTimersByTimeAsync(400);
    expect(bankRepository.save).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('persistence — réglages (immédiat, hors debounce)', () => {
  it('un changement de réglages écrit sans attendre', async () => {
    const { persistence, settingsRepository, fire } = setup();
    persistence.start();
    fire(SETTINGS);
    await vi.advanceTimersByTimeAsync(0);
    expect(settingsRepository.save).toHaveBeenCalledOnce();
    expect(settingsRepository.save).toHaveBeenCalledWith({
      backgroundBehavior: 'stopAll',
      maxVoices: 8,
      locale: 'fr',
    });
  });
});

describe('snapshotBank', () => {
  it('copie profonde : structures égales, références distinctes', () => {
    const bank = makeBank();
    const snapshot = snapshotBank(bank);
    expect(snapshot).toEqual(bank);
    expect(snapshot).not.toBe(bank);
    expect(snapshot.pages[0]).not.toBe(bank.pages[0]);
    expect(snapshot.pads[0]).not.toBe(bank.pads[0]);
  });
});
