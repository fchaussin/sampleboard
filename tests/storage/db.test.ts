// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du wrapper migrations (user_version) contre un vrai SQLite en mémoire.
import { describe, it, expect, afterEach } from 'vitest';
import { openDatabase, MIGRATIONS, type Migration } from '../../src/storage/db';
import { createNodeSqliteExecutor, type TestExecutor } from './node-sqlite-executor';

let executors: TestExecutor[] = [];

function db(): TestExecutor {
  const executor = createNodeSqliteExecutor();
  executors.push(executor);
  return executor;
}

afterEach(() => {
  for (const e of executors) e.close();
  executors = [];
});

async function userVersion(executor: TestExecutor): Promise<number> {
  const rows = await executor.select<{ user_version: number }>('PRAGMA user_version');
  return Number(rows[0]?.user_version);
}

async function tableNames(executor: TestExecutor): Promise<string[]> {
  const rows = await executor.select<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  return rows.map((r) => r.name);
}

describe('openDatabase — migrations', () => {
  it('applique le schéma v1 et fixe user_version', async () => {
    const executor = db();
    await openDatabase(executor);
    expect(await userVersion(executor)).toBe(1);
    expect(await tableNames(executor)).toEqual(['bank', 'pads', 'pages', 'samples', 'settings']);
  });

  it('est idempotent : une réouverture ne rejoue rien', async () => {
    const executor = db();
    await openDatabase(executor);
    await openDatabase(executor); // CREATE TABLE rejoué aurait levé « table already exists »
    expect(await userVersion(executor)).toBe(1);
  });

  it('applique les migrations manquantes dans l’ordre croissant', async () => {
    const executor = db();
    const m1: Migration = { version: 1, statements: ['CREATE TABLE a (x)'] };
    const m2: Migration = { version: 2, statements: ['CREATE TABLE b (y)'] };
    await openDatabase(executor, [m1]);
    expect(await userVersion(executor)).toBe(1);
    // Nouvelle version de l'app : seule m2 est en attente (m1 rejouée aurait levé une erreur).
    await openDatabase(executor, [m2, m1]); // désordre volontaire : trié en interne
    expect(await userVersion(executor)).toBe(2);
    expect(await tableNames(executor)).toEqual(['a', 'b']);
  });

  it('le schéma v1 porte les gardes CHECK du domaine (§8)', async () => {
    const executor = db();
    await openDatabase(executor);
    await executor.execute("INSERT INTO bank (id, name) VALUES ('b', '')");
    await expect(
      executor.execute(
        "INSERT INTO pages (id, bank_id, name, voice_mode, rows, cols, position) VALUES ('p', 'b', '', 'duo', 4, 4, 0)",
      ),
    ).rejects.toThrow(); // voice_mode hors ('mono','poly')
    await expect(
      executor.execute(
        "INSERT INTO pages (id, bank_id, name, voice_mode, rows, cols, position) VALUES ('p', 'b', '', 'poly', 13, 4, 0)",
      ),
    ).rejects.toThrow(); // rows hors [2,12]
  });

  it('les clés étrangères sont actives (page inconnue refusée)', async () => {
    const executor = db();
    await openDatabase(executor);
    await expect(
      executor.execute(
        "INSERT INTO pads (id, page_id, name, sample_id, play_mode, gain_db, position) VALUES ('p', 'fantome', '', NULL, 'oneShot', 0, 0)",
      ),
    ).rejects.toThrow();
  });
});

describe('MIGRATIONS', () => {
  it('les versions sont uniques et contiguës depuis 1', () => {
    const versions = MIGRATIONS.map((m) => m.version).sort((a, b) => a - b);
    expect(versions).toEqual(versions.map((_, i) => i + 1));
  });
});
