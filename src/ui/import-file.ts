// SPDX-License-Identifier: GPL-3.0-or-later
// Aide d'import partagée (bottombar « Import rapide » + panneau Bibliothèque) : un seul
// chemin fichier → commande, pour ne pas dupliquer la lecture/gestion d'erreur (§4).
import type { App } from '../app/create-app';
import type { ImportError } from '../app/commands';

/** Importe un fichier via la commande ; renvoie le motif d'échec, ou null si OK. */
export async function importFile(app: App, file: File): Promise<ImportError | null> {
  const result = await app.commands.importSample(file.name, await file.arrayBuffer());
  return result.ok ? null : result.reason;
}
