// SPDX-License-Identifier: GPL-3.0-or-later
// Déclarations ambiantes minimales des built-ins Node utilisés par l'outillage de build
// (plugin factory-samples) et ses tests — évite d'ajouter @types/node au projet navigateur
// (même convention que tests/storage/node-sqlite.d.ts).
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string): string[];
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: URL | string): string;
}

declare const process: { cwd(): string };
