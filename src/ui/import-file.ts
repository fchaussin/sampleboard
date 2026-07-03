// SPDX-License-Identifier: GPL-3.0-or-later
// Aide d'import partagée (Import rapide, Bibliothèque, modale de choix de sample) : un seul
// chemin fichier → commande (§4). Depuis M7, l'import d'UN fichier audio OUVRE L'ÉDITEUR
// AUDIO (waveform + rognage). Depuis M8, plusieurs fichiers ou une archive (zip/rar) partent
// en LOT DIRECT : modale de progression, rognage possible après coup (« Découper »).
import type { App } from '../app/create-app';
import type { BatchSource, ImportError } from '../app/commands';
import { ARCHIVE_EXTENSIONS, isArchiveFileName } from '../domain/invariants';

/** Valeur `accept` des inputs d'import : tout audio + les archives prises en charge. */
export const IMPORT_ACCEPT = ['audio/*', ...ARCHIVE_EXTENSIONS.map((ext) => `.${ext}`)].join(',');

/**
 * Décode le fichier et ouvre l'éditeur audio (pad à assigner mémorisé le cas échéant).
 * Renvoie le motif d'échec, ou null si l'éditeur est ouvert.
 */
export async function importFile(
  app: App,
  file: File,
  assignPadId: string | null = null,
  addToPool = false,
): Promise<ImportError | null> {
  return app.commands.beginImport(file.name, await file.arrayBuffer(), assignPadId, addToPool);
}

/**
 * Point d'entrée des inputs d'import : UN fichier audio → éditeur (comportement M7) ;
 * plusieurs fichiers ou une archive → lot direct (la modale de progression prend le relais,
 * les échecs s'y affichent par fichier — d'où le retour null sur ce chemin).
 */
export async function importFiles(
  app: App,
  files: File[],
  assignPadId: string | null = null,
  addToPool = false,
): Promise<ImportError | null> {
  const first = files[0];
  if (!first) return null;
  if (files.length === 1 && !isArchiveFileName(first.name)) {
    return importFile(app, first, assignPadId, addToPool);
  }

  const sources: BatchSource[] = [];
  for (const file of files) {
    try {
      sources.push({ name: file.name, bytes: await file.arrayBuffer() });
    } catch {
      sources.push({ name: file.name, bytes: null }); // affiché « readFailed » dans la modale
    }
  }
  void app.commands.importBatch(sources, { addToPool });
  return null;
}
