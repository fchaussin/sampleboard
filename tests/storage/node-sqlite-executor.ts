// SPDX-License-Identifier: GPL-3.0-or-later
// SqlExecutor de test : un VRAI SQLite en mémoire (node:sqlite) derrière le contrat injecté
// dans les dépôts — le SQL des repositories et les migrations sont exercés pour de vrai.
import { DatabaseSync } from 'node:sqlite';
import type { SqlExecutor } from '../../src/storage/db';

type SqlValue = null | number | bigint | string | Uint8Array;

export interface TestExecutor extends SqlExecutor {
  close(): void;
}

export function createNodeSqliteExecutor(): TestExecutor {
  // Les clés étrangères sont pilotées par openDatabase (PRAGMA), comme en prod.
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  return {
    async execute(sql: string, params: unknown[] = []): Promise<void> {
      if (params.length === 0) {
        db.exec(sql); // DDL, PRAGMA, BEGIN/COMMIT…
        return;
      }
      db.prepare(sql).run(...(params as SqlValue[]));
    },
    async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return db.prepare(sql).all(...(params as SqlValue[])) as T[];
    },
    close(): void {
      db.close();
    },
  };
}
