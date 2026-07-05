// SPDX-License-Identifier: GPL-3.0-or-later
// Extraction d'archives (zip/rar, M8) via libarchive compilé en WASM dans un worker dédié.
// libarchive.js (MIT) enrobe libarchive (BSD, lecteurs zip + rar4/rar5 clean-room) :
// compatible GPL-3.0 et F-Droid — contrairement au code unrar officiel (licence non libre).
// Le worker et son .wasm sont servis côte à côte par le plugin Vite (voir vite.config.ts).
import { Archive } from 'libarchive.js';

/** Entrée extraite d'une archive (candidate à l'import). */
export interface ExtractedEntry {
  name: string;
  bytes: ArrayBuffer;
}

/** Port d'extraction injecté dans les commandes (factice dans les tests). */
export type ArchiveExtractor = (fileName: string, bytes: ArrayBuffer) => Promise<ExtractedEntry[]>;

// RELATIF au document : la web/PWA peut vivre sous un sous-chemin (GitHub Pages).
const WORKER_URL = 'libarchive/worker-bundle.js';

let initialized = false;

/** Aplati l'arborescence renvoyée par extractFiles() en une liste de fichiers. */
async function collectFiles(node: unknown, out: ExtractedEntry[]): Promise<void> {
  if (node instanceof File) {
    // Fichiers cachés (« ._x » AppleDouble & co) : du bruit, jamais des sons.
    if (!node.name.startsWith('.')) out.push({ name: node.name, bytes: await node.arrayBuffer() });
    return;
  }
  if (node !== null && typeof node === 'object') {
    for (const [name, child] of Object.entries(node)) {
      if (name === '__MACOSX') continue; // métadonnées macOS
      await collectFiles(child, out);
    }
  }
}

/** Extracteur réel : un worker WASM éphémère par archive (mémoire libérée à la fermeture). */
export function createArchiveExtractor(): ArchiveExtractor {
  return async (fileName, bytes) => {
    if (!initialized) {
      Archive.init({ workerUrl: WORKER_URL });
      initialized = true;
    }
    const reader = await Archive.open(new File([bytes], fileName));
    try {
      const tree: unknown = await reader.extractFiles();
      const entries: ExtractedEntry[] = [];
      await collectFiles(tree, entries);
      return entries;
    } finally {
      await reader.close();
    }
  };
}
