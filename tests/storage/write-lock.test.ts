// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du verrou d'écriture partagé (db.ts) : sérialisation stricte des jobs, résilience
// aux échecs, propagation des résultats. Voir la note pool sqlx dans db.ts.
import { describe, it, expect } from 'vitest';
import { createWriteLock } from '../../src/storage/db';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createWriteLock', () => {
  it('deux jobs concurrents ne s’entrelacent jamais', async () => {
    const lock = createWriteLock();
    const gate = deferred<void>();
    const trace: string[] = [];

    const first = lock(async () => {
      trace.push('a:début');
      await gate.promise; // le premier job traîne…
      trace.push('a:fin');
    });
    const second = lock(async () => {
      trace.push('b'); // …le second ne doit démarrer qu'après
    });

    await Promise.resolve();
    expect(trace).toEqual(['a:début']);
    gate.resolve();
    await Promise.all([first, second]);
    expect(trace).toEqual(['a:début', 'a:fin', 'b']);
  });

  it('propage la valeur de retour et l’erreur du job', async () => {
    const lock = createWriteLock();
    await expect(lock(async () => 42)).resolves.toBe(42);
    await expect(lock(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
  });

  it('un job en échec ne bloque pas les suivants', async () => {
    const lock = createWriteLock();
    await expect(lock(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(lock(async () => 'ok')).resolves.toBe('ok');
  });
});
