// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du filtre PUR de bibliothèque (tag-filter) : branche RECHERCHE de filterSamples
// (casse, espaces, combinaison avec le filtre par tag). matchesFilter seul est déjà
// couvert dans commands.tags.test.ts.
import { describe, it, expect } from 'vitest';
import { filterSamples } from '../../src/app/tag-filter';
import type { Sample } from '../../src/domain/types';

function sample(id: string, label: string): Sample {
  return {
    id,
    label,
    fileName: `${id}.ogg`,
    originalName: label,
    mime: 'audio/ogg',
    sizeBytes: 0,
    durationMs: null,
    createdAt: 0,
  };
}

const samples = [sample('s1', 'Kick lourd'), sample('s2', 'Nappe'), sample('s3', 'kick sec')];
const noTags = new Map<string, Set<string>>();

describe('filterSamples — recherche texte', () => {
  it('recherche vide : tous les samples passent', () => {
    expect(filterSamples(samples, noTags, null)).toHaveLength(3);
    expect(filterSamples(samples, noTags, null, '')).toHaveLength(3);
  });

  it('filtre sur le label, insensible à la casse', () => {
    const found = filterSamples(samples, noTags, null, 'KICK');
    expect(found.map((s) => s.id)).toEqual(['s1', 's3']);
  });

  it('ignore les espaces autour de la saisie', () => {
    expect(filterSamples(samples, noTags, null, '  kick  ')).toHaveLength(2);
  });

  it('aucune correspondance : tableau vide', () => {
    expect(filterSamples(samples, noTags, null, 'zzz')).toEqual([]);
  });

  it('se combine au filtre par tag (ET logique)', () => {
    const sampleTags = new Map([['s1', new Set(['t1'])]]);
    expect(filterSamples(samples, sampleTags, 't1', 'kick').map((s) => s.id)).toEqual(['s1']);
    expect(filterSamples(samples, sampleTags, 't1', 'nappe')).toEqual([]);
  });

  it('se combine au filtre « Non classé »', () => {
    const sampleTags = new Map([['s1', new Set(['t1'])]]);
    expect(filterSamples(samples, sampleTags, 'untagged', 'kick').map((s) => s.id)).toEqual(['s3']);
  });
});
