// SPDX-License-Identifier: GPL-3.0-or-later
// Aide d'import partagée (Import rapide, Bibliothèque, modale de choix de sample) : un seul
// chemin fichier → commande — DRY, pas de logique d'import dispersée dans les composants (§4).
import type { App } from '../app/create-app';
import type { ImportError, ImportResult } from '../app/commands';

/** Importe un fichier via la commande et renvoie le résultat complet. */
export function importFile(app: App, file: File): Promise<ImportResult> {
  return file.arrayBuffer().then((bytes) => app.commands.importSample(file.name, bytes));
}

/** Variante « erreur seulement » pour les appelants qui n'exploitent pas le sampleId. */
export async function importFileError(app: App, file: File): Promise<ImportError | null> {
  const result = await importFile(app, file);
  return result.ok ? null : result.reason;
}
