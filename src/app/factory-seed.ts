// SPDX-License-Identifier: GPL-3.0-or-later
// Semis d'usine (#14) : au PREMIER lancement uniquement, la bibliothèque est remplie depuis
// public/factory-samples/ (OGG/Opus pré-encodés au dépôt, manifest validé au build) et la
// page « Principal » reçoit la sélection « board » du manifest. Meilleur effort : un fichier
// en échec est journalisé puis ignoré — le semis ne casse jamais le démarrage.
import type { PlayMode } from '../domain/enums';
import { pagesSorted } from '../domain/selectors';
import type { Commands } from './commands';
import type { AppStore } from './store.svelte';

export interface FactoryManifest {
  samples?: Array<{ file: string; label: string; tags?: string[] }>;
  board?: Array<{ file: string; playMode?: string }>;
}

export interface FactorySeedDeps {
  commands: Pick<Commands, 'seedFactorySample' | 'toggleSampleTag' | 'assignSample' | 'setPadPlayMode'>;
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

  const sampleIdByFile = new Map<string, string>();
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
    sampleIdByFile.set(entry.file, result.sampleId);
    for (const token of entry.tags ?? []) {
      const tagId = tagIdByToken.get(token);
      if (tagId !== undefined) commands.toggleSampleTag(result.sampleId, tagId);
    }
  }

  // Sélection « board » → pads de la première page (« Principal »), dans l'ordre des positions.
  const bank = store.bank;
  const mainPage = bank ? pagesSorted(bank)[0] : undefined;
  if (!bank || !mainPage) return;
  const pads = bank.pads
    .filter((pad) => pad.pageId === mainPage.id)
    .sort((a, b) => a.position - b.position);
  (manifest.board ?? []).forEach((slot, index) => {
    const pad = pads[index];
    const sampleId = sampleIdByFile.get(slot.file);
    if (!pad || sampleId === undefined) return;
    commands.assignSample(pad.id, sampleId);
    if (slot.playMode !== undefined && (PLAY_MODES as readonly string[]).includes(slot.playMode)) {
      commands.setPadPlayMode(pad.id, slot.playMode as PlayMode);
    }
  });
}
