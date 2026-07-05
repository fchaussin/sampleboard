// SPDX-License-Identifier: GPL-3.0-or-later
// Samples d'usine (backlog #14) — validation du manifest AU BUILD (et au démarrage dev).
// `public/factory-samples/` est copié tel quel dans CHAQUE dist (web, Android, conteneur) ;
// ce plugin garantit que la fixture reste vraie : tout fichier audio du répertoire est
// décrit dans manifest.json (libellé + tags), et toute entrée pointe un fichier existant.
// Provenance/licence manquantes = avertissement (pas d'échec), le temps de la traçabilité.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export const FACTORY_SAMPLES_DIR = 'public/factory-samples';

/** Tout fichier audio déposé… */
const ANY_AUDIO_EXT = /\.(mp3|ogg|opus|wav|flac|m4a)$/i;
/** …mais seul l'OGG/Opus est admis : le semis copie les octets SANS réencodage runtime. */
const FACTORY_EXT = /\.ogg$/i;

/** Tokens des tags semés au premier lancement (voir main.ts) — seuls tags admis ici. */
export const DEFAULT_TAG_TOKENS = [
  'sfx',
  'replies',
  'jingle',
  'music',
  'ambience',
  'voice',
  'reaction',
  'meme',
  'alert',
  'drums',
] as const;

export interface FactoryManifestEntry {
  file: string;
  label: string;
  tags: string[];
  source: string;
  license: string;
}

/** Slot d'une planche d'usine (dans l'ordre des positions de la page ciblée). */
export interface FactoryBoardEntry {
  file: string;
  playMode?: string;
}

/** Planche d'usine (#28) : sélection pour la page de rang `page`, grille imposable. */
export interface FactoryBoardSpec {
  page?: number;
  rows?: number;
  cols?: number;
  slots?: FactoryBoardEntry[];
}

const PLAY_MODES = ['oneShot', 'gate', 'loop'];
/** Bornes de grille du domaine (§16) — dupliquées ici pour garder le plugin sans import src/. */
const ROWS_MAX = 12;
const COLS_MAX = 6;

export interface ManifestCheck {
  errors: string[];
  warnings: string[];
}

/** Champ de traçabilité considéré renseigné : non vide et différent de « TODO ». */
function isFilled(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '' && value.trim().toUpperCase() !== 'TODO';
}

/**
 * Vérifie la cohérence manifest ↔ fichiers audio présents. Pur (testable) :
 * erreurs = fixture incohérente (build refusé) ; avertissements = traçabilité incomplète.
 */
export function checkFactoryManifest(audioFiles: string[], manifestRaw: unknown): ManifestCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const samples = (manifestRaw as { samples?: unknown } | null)?.samples;
  if (!Array.isArray(samples)) {
    return { errors: ['manifest.json : structure attendue { "samples": [...] }'], warnings };
  }

  const listed = new Set<string>();
  for (const entry of samples as Array<Partial<FactoryManifestEntry>>) {
    const file = typeof entry.file === 'string' ? entry.file : '';
    if (!file) {
      errors.push('entrée sans champ « file »');
      continue;
    }
    if (listed.has(file)) errors.push(`${file} : entrée dupliquée dans le manifest`);
    listed.add(file);
    if (!audioFiles.includes(file)) {
      errors.push(`${file} : listé dans le manifest mais absent du répertoire`);
    }
    if (typeof entry.label !== 'string' || entry.label.trim() === '') {
      errors.push(`${file} : « label » manquant ou vide`);
    }
    if (!Array.isArray(entry.tags) || entry.tags.length === 0) {
      errors.push(`${file} : « tags » manquant ou vide`);
    } else {
      for (const tag of entry.tags) {
        if (!(DEFAULT_TAG_TOKENS as readonly string[]).includes(tag)) {
          errors.push(`${file} : tag inconnu « ${String(tag)} »`);
        }
      }
    }
    if (!isFilled(entry.source) || !isFilled(entry.license)) {
      warnings.push(`${file} : source/licence à renseigner`);
    }
  }

  for (const file of audioFiles) {
    if (!FACTORY_EXT.test(file)) {
      errors.push(`${file} : format non admis — convertir en OGG/Opus (semis sans réencodage)`);
      continue;
    }
    if (!listed.has(file)) errors.push(`${file} : présent dans le répertoire mais absent du manifest`);
  }

  if ((manifestRaw as { board?: unknown }).board !== undefined) {
    errors.push('« board » : format remplacé par « boards » (planches par page, #28)');
  }
  const boards = (manifestRaw as { boards?: unknown }).boards;
  if (boards !== undefined) {
    if (!Array.isArray(boards)) {
      errors.push('« boards » : tableau attendu');
    } else {
      const pagesSeen = new Set<number>();
      for (const board of boards as FactoryBoardSpec[]) {
        const page = board.page ?? 1;
        const label = `boards[page ${page}]`;
        if (!Number.isInteger(page) || page < 1) errors.push(`${label} : rang de page invalide`);
        if (pagesSeen.has(page)) errors.push(`${label} : page déclarée deux fois`);
        pagesSeen.add(page);
        const hasRows = board.rows !== undefined;
        const hasCols = board.cols !== undefined;
        if (hasRows !== hasCols) errors.push(`${label} : rows et cols vont ensemble`);
        if (hasRows && hasCols) {
          if (!Number.isInteger(board.rows) || board.rows! < 1 || board.rows! > ROWS_MAX)
            errors.push(`${label} : rows hors bornes [1, ${ROWS_MAX}]`);
          if (!Number.isInteger(board.cols) || board.cols! < 1 || board.cols! > COLS_MAX)
            errors.push(`${label} : cols hors bornes [1, ${COLS_MAX}]`);
        }
        const slots = board.slots ?? [];
        if (!Array.isArray(slots)) {
          errors.push(`${label} : « slots » tableau attendu`);
          continue;
        }
        if (hasRows && hasCols && slots.length > board.rows! * board.cols!) {
          errors.push(`${label} : ${slots.length} slots pour une grille ${board.rows}×${board.cols}`);
        }
        // Un même sample PEUT occuper plusieurs slots (pas d'erreur de doublon).
        for (const entry of slots as Array<Partial<FactoryBoardEntry>>) {
          const file = typeof entry.file === 'string' ? entry.file : '';
          if (!file || !listed.has(file)) {
            errors.push(`${label} : « ${file || '(sans file)'} » ne référence aucun sample`);
          }
          if (entry.playMode !== undefined && !PLAY_MODES.includes(entry.playMode)) {
            errors.push(`${label} : « ${file} » playMode inconnu « ${String(entry.playMode)} »`);
          }
        }
      }
    }
  }
  return { errors, warnings };
}

/** Fichiers audio du répertoire d'usine (vide si le répertoire n'existe pas). */
export function listFactoryAudioFiles(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => ANY_AUDIO_EXT.test(f));
  } catch {
    return [];
  }
}

export function factorySamples(): Plugin {
  let root = process.cwd();
  return {
    name: 'factory-samples-manifest',
    configResolved(config) {
      root = config.root;
    },
    buildStart() {
      const dir = join(root, FACTORY_SAMPLES_DIR);
      const audioFiles = listFactoryAudioFiles(dir);
      if (audioFiles.length === 0) return; // pas de samples d'usine : rien à valider

      let manifestRaw: unknown;
      try {
        manifestRaw = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
      } catch (err) {
        throw new Error(`factory-samples : manifest.json illisible — ${String(err)}`);
      }

      const { errors, warnings } = checkFactoryManifest(audioFiles, manifestRaw);
      if (warnings.length > 0) {
        this.warn(
          `factory-samples : ${warnings.length} sample(s) sans provenance/licence renseignée ` +
            `(obligatoire avant soumission F-Droid) — ex. ${warnings[0]}`,
        );
      }
      if (errors.length > 0) {
        throw new Error(`factory-samples : fixture incohérente :\n - ${errors.join('\n - ')}`);
      }
    },
  };
}
