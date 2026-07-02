// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du dépôt de tags (M8) contre un vrai SQLite : CRUD, affectations, cascades.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../../src/storage/db';
import { createTagRepository } from '../../src/storage/tag-repository';
import { createNodeSqliteExecutor, type TestExecutor } from './node-sqlite-executor';

let executor: TestExecutor;

beforeEach(async () => {
  executor = createNodeSqliteExecutor();
  await openDatabase(executor);
  await executor.execute(
    `INSERT INTO samples (id, label, file_name, original_name, mime, size_bytes, duration_ms, created_at)
     VALUES ('s1', 's1', 's1.ogg', 's1', 'audio/ogg', 1, NULL, 0)`,
  );
});

afterEach(() => {
  executor.close();
});

describe('TagRepository', () => {
  it('create/list (trié par libellé), rename, remove', async () => {
    const repo = createTagRepository(executor);
    await repo.create({ id: 't2', label: 'Zeste' });
    await repo.create({ id: 't1', label: 'Ambiance' });
    expect((await repo.list()).map((t) => t.label)).toEqual(['Ambiance', 'Zeste']);
    await repo.rename('t2', 'Alerte');
    expect((await repo.list()).map((t) => t.label)).toEqual(['Alerte', 'Ambiance']);
    await repo.remove('t1');
    expect((await repo.list()).map((t) => t.id)).toEqual(['t2']);
  });

  it('assign/unassign + assignments ; ré-affectation idempotente', async () => {
    const repo = createTagRepository(executor);
    await repo.create({ id: 't1', label: 'A' });
    await repo.assign('s1', 't1');
    await repo.assign('s1', 't1'); // idempotent (ON CONFLICT DO NOTHING)
    expect(await repo.assignments()).toEqual(new Map([['s1', new Set(['t1'])]]));
    await repo.unassign('s1', 't1');
    expect((await repo.assignments()).size).toBe(0);
  });

  it('supprimer un tag ou un sample emporte ses affectations (cascades)', async () => {
    const repo = createTagRepository(executor);
    await repo.create({ id: 't1', label: 'A' });
    await repo.assign('s1', 't1');
    await repo.remove('t1');
    expect((await repo.assignments()).size).toBe(0);

    await repo.create({ id: 't2', label: 'B' });
    await repo.assign('s1', 't2');
    await executor.execute("DELETE FROM samples WHERE id = 's1'");
    expect((await repo.assignments()).size).toBe(0);
  });

  it('affecter à un sample inexistant est refusé (FK)', async () => {
    const repo = createTagRepository(executor);
    await repo.create({ id: 't1', label: 'A' });
    await expect(repo.assign('fantome', 't1')).rejects.toThrow();
  });
});
