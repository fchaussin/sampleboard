// SPDX-License-Identifier: GPL-3.0-or-later
// Aide d'import partagée (Import rapide, Bibliothèque, modale de choix de sample) : un seul
// chemin fichier → commande (§4). Depuis M7, tout import OUVRE L'ÉDITEUR AUDIO (waveform +
// rognage) — l'entrée en bibliothèque se fait à la validation de l'éditeur.
import type { App } from '../app/create-app';
import type { ImportError } from '../app/commands';

/**
 * Décode le fichier et ouvre l'éditeur audio (pad à assigner mémorisé le cas échéant).
 * Renvoie le motif d'échec, ou null si l'éditeur est ouvert.
 */
export async function importFile(
  app: App,
  file: File,
  assignPadId: string | null = null,
): Promise<ImportError | null> {
  return app.commands.beginImport(file.name, await file.arrayBuffer(), assignPadId);
}
