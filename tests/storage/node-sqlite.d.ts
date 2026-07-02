// SPDX-License-Identifier: GPL-3.0-or-later
// Déclaration ambiante minimale de node:sqlite (Node ≥ 22.5) — évite d'ajouter @types/node
// pour les seuls tests de la couche storage. Uniquement ce que l'exécuteur de test consomme.
declare module 'node:sqlite' {
  type SqlValue = null | number | bigint | string | Uint8Array;

  class StatementSync {
    all(...params: SqlValue[]): Record<string, SqlValue>[];
    run(...params: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }

  class DatabaseSync {
    constructor(path: string, options?: { enableForeignKeyConstraints?: boolean });
    prepare(sql: string): StatementSync;
    exec(sql: string): void;
    close(): void;
  }

  export { DatabaseSync, StatementSync };
}
