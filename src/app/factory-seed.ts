// SPDX-License-Identifier: GPL-3.0-or-later
// Semis d'usine (#14, #28) : au PREMIER lancement uniquement, la bibliothèque est remplie
// depuis public/factory-samples/ (OGG/Opus pré-encodés au dépôt, manifest validé au build)
// et les PLANCHES d'usine (`boards`, une par rang de page — grille imposable) reçoivent
// leurs sélections. Meilleur effort : un fichier en échec est journalisé puis ignoré — le
// semis ne casse jamais le démarrage.
import type { PlayMode } from '../domain/enums';
import { pagesSorted } from '../domain/selectors';
import type { Commands } from './commands';
import type { AppStore } from './store.svelte';

/** Planche d'usine : sélection pré-assignée à la page de rang `page` (1-based, défaut 1). */
export interface FactoryBoard {
  page?: number;
  /** Grille imposée à la page AVANT assignation (ex. kit batterie 3×3). */
  rows?: number;
  cols?: number;
  slots?: Array<{ file: string; playMode?: string }>;
}

export interface FactoryManifest {
  samples?: Array<{ file: string; label: string; tags?: string[] }>;
  boards?: FactoryBoard[];
}

export interface FactorySeedDeps {
  commands: Pick<
    Commands,
    'seedFactorySample' | 'toggleSampleTag' | 'assignSample' | 'setPadPlayMode' | 'setPageGrid'
  >;
  store: AppStore;
  /** Octets d'une ressource embarquée (chemin relatif à la racine servie), ou null si absente. */
  fetchBytes: (path: string) => Promise<ArrayBuffer | null>;
  /** Token de tag du manifest (« sfx », « alert »…) → id du tag semé au premier lancement. */
  tagIdByToken: ReadonlyMap<string, string>;
}

const PLAY_MODES: readonly PlayMode[] = ['oneShot', 'gate', 'loop'];

export async function seedFactoryContent({
  commands,
  store,
  fetchBytes,
  tagIdByToken,
}: FactorySeedDeps): Promise<void> {
  const raw = await fetchBytes('factory-samples/manifest.json');
  if (!raw) return; // aucun contenu d'usine embarqué : rien à semer

  let manifest: FactoryManifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(raw)) as FactoryManifest;
  } catch (err) {
    console.warn('semis d’usine : manifest illisible', err);
    return;
  }

  // Planches préparées AVANT le semis : chaque slot est assigné DÈS que son sample est
  // semé (#27, préchargeur/paceur) — les planches se remplissent progressivement, chaque
  // pad est jouable à l'instant où il apparaît (plus de board qui « pop » à la fin).
  // LISTE de slots par fichier : un même sample peut occuper plusieurs pads.
  const bank = store.bank;
  const pagesByRank = bank ? pagesSorted(bank) : [];
  const slotsByFile = new Map<string, Array<{ padId: string; playMode: PlayMode | null }>>();
  for (const board of manifest.boards ?? []) {
    const page = pagesByRank[(board.page ?? 1) - 1];
    if (!page) continue; // rang de page inexistant : planche ignorée (meilleur effort)
    // Grille imposée par la planche (ex. kit batterie 3×3, #28) AVANT le mappage des
    // slots : le redimensionnement crée les pads manquants (board complet, §16).
    if (board.rows !== undefined && board.cols !== undefined) {
      commands.setPageGrid(page.id, board.rows, board.cols);
    }
    const pads = (bank?.pads ?? [])
      .filter((pad) => pad.pageId === page.id)
      .sort((a, b) => a.position - b.position);
    (board.slots ?? []).forEach((slot, index) => {
      const pad = pads[index];
      if (!pad) return;
      const playMode =
        slot.playMode !== undefined && (PLAY_MODES as readonly string[]).includes(slot.playMode)
          ? (slot.playMode as PlayMode)
          : null;
      const slots = slotsByFile.get(slot.file) ?? [];
      slots.push({ padId: pad.id, playMode });
      slotsByFile.set(slot.file, slots);
    });
  }

  for (const entry of manifest.samples ?? []) {
    const bytes = await fetchBytes(`factory-samples/${encodeURIComponent(entry.file)}`);
    if (!bytes) {
      console.warn(`semis d’usine : ${entry.file} introuvable`);
      continue;
    }
    const result = await commands.seedFactorySample(entry.file, entry.label, bytes);
    if (!result.ok) {
      console.warn(`semis d’usine : ${entry.file} rejeté (${result.reason})`);
      continue;
    }
    for (const token of entry.tags ?? []) {
      const tagId = tagIdByToken.get(token);
      if (tagId !== undefined) commands.toggleSampleTag(result.sampleId, tagId);
    }
    for (const slot of slotsByFile.get(entry.file) ?? []) {
      commands.assignSample(slot.padId, result.sampleId);
      if (slot.playMode) commands.setPadPlayMode(slot.padId, slot.playMode);
    }
  }
}
