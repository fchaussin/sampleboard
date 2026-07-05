// SPDX-License-Identifier: GPL-3.0-or-later
// Tests de la validation AU BUILD des samples d'usine (#14) : cohérence manifest ↔ fichiers,
// tags admis, section board, traçabilité (avertissements) — et intégration sur la fixture
// RÉELLE du dépôt (le test échoue si un fichier est ajouté sans entrée de manifest).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  checkFactoryManifest,
  listFactoryAudioFiles,
  FACTORY_SAMPLES_DIR,
} from '../../vite-plugin-factory-samples';

const entry = (file: string, extra: object = {}) => ({
  file,
  label: 'Libellé',
  tags: ['sfx'],
  source: 'https://exemple.org',
  license: 'CC0',
  ...extra,
});

describe('checkFactoryManifest', () => {
  it('accepte une fixture cohérente et renseignée, sans erreur ni avertissement', () => {
    const { errors, warnings } = checkFactoryManifest(['a.ogg'], { samples: [entry('a.ogg')] });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('refuse une structure sans tableau samples', () => {
    expect(checkFactoryManifest([], null).errors).toHaveLength(1);
    expect(checkFactoryManifest([], { samples: 'nope' }).errors).toHaveLength(1);
  });

  it('signale les fichiers non listés, les entrées orphelines et les doublons', () => {
    const { errors } = checkFactoryManifest(['present.ogg', 'oublie.ogg'], {
      samples: [entry('present.ogg'), entry('present.ogg'), entry('fantome.ogg')],
    });
    expect(errors).toContainEqual(expect.stringContaining('oublie.ogg'));
    expect(errors).toContainEqual(expect.stringContaining('fantome.ogg'));
    expect(errors).toContainEqual(expect.stringContaining('dupliqué'));
  });

  it('refuse label vide, tags vides ou inconnus, et les formats non OGG', () => {
    const { errors } = checkFactoryManifest(['a.ogg', 'b.mp3'], {
      samples: [entry('a.ogg', { label: ' ', tags: ['inexistant'] }), entry('b.mp3')],
    });
    expect(errors).toContainEqual(expect.stringContaining('« label »'));
    expect(errors).toContainEqual(expect.stringContaining('tag inconnu'));
    expect(errors).toContainEqual(expect.stringContaining('convertir en OGG/Opus'));
  });

  it('avertit (sans échouer) quand source/licence restent à renseigner', () => {
    const { errors, warnings } = checkFactoryManifest(['a.ogg'], {
      samples: [entry('a.ogg', { source: 'TODO', license: '' })],
    });
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(1);
  });

  it('valide les planches (#28) : références, playMode, grille bornée, capacité, pages uniques', () => {
    const { errors } = checkFactoryManifest(['a.ogg'], {
      samples: [entry('a.ogg')],
      boards: [
        // Les DOUBLONS sont admis (un sample peut occuper plusieurs pads).
        { slots: [{ file: 'a.ogg', playMode: 'loop' }, { file: 'a.ogg' }, { file: 'inconnu.ogg', playMode: 'turbo' }] },
        { page: 2, rows: 1, cols: 2, slots: [{ file: 'a.ogg' }, { file: 'a.ogg' }, { file: 'a.ogg' }] },
        { page: 2, rows: 99, cols: 0, slots: [] },
      ],
    });
    expect(errors).toContainEqual(expect.stringContaining('inconnu.ogg'));
    expect(errors).toContainEqual(expect.stringContaining('playMode inconnu'));
    expect(errors).toContainEqual(expect.stringContaining('3 slots pour une grille 1×2'));
    expect(errors).toContainEqual(expect.stringContaining('page déclarée deux fois'));
    expect(errors).toContainEqual(expect.stringContaining('rows hors bornes'));
    expect(errors).toContainEqual(expect.stringContaining('cols hors bornes'));
    expect(errors).not.toContainEqual(expect.stringContaining('assigné deux fois'));
  });

  it("l'ancien format « board » est refusé (migration #28)", () => {
    const { errors } = checkFactoryManifest(['a.ogg'], {
      samples: [entry('a.ogg')],
      board: [{ file: 'a.ogg' }],
    });
    expect(errors).toContainEqual(expect.stringContaining('remplacé par « boards »'));
  });
});

describe('fixture réelle du dépôt', () => {
  const dir = fileURLToPath(new URL(`../../${FACTORY_SAMPLES_DIR}/`, import.meta.url));

  it('le manifest décrit exactement les fichiers présents (aucune erreur)', () => {
    const audioFiles = listFactoryAudioFiles(dir);
    expect(audioFiles.length).toBeGreaterThan(0);
    const manifest: unknown = JSON.parse(readFileSync(`${dir}manifest.json`, 'utf8'));
    expect(checkFactoryManifest(audioFiles, manifest).errors).toEqual([]);
  });
});
