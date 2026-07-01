// SPDX-License-Identifier: GPL-3.0-or-later
// Dépôt bibliothèque : métadonnées en SQLite + octets audio en fichiers (voir §8).
// {appDataDir}/audio/{sampleId}.ogg — jamais de BLOB. Squelette M0 ; implémentation M4/M5.
import type { Sample } from '../domain/types';
import type { SampleRepository } from './types';

export function createSampleRepository(): SampleRepository {
  return {
    async list(): Promise<Sample[]> {
      throw new Error('sample-repository: non implémenté (jalon M5)');
    },
    async add(_sample: Sample, _bytes: Uint8Array): Promise<void> {
      throw new Error('sample-repository: non implémenté (jalon M5)');
    },
    async rename(_sampleId: string, _label: string): Promise<void> {
      throw new Error('sample-repository: non implémenté (jalon M5)');
    },
    async remove(_sampleId: string): Promise<void> {
      throw new Error('sample-repository: non implémenté (jalon M5)');
    },
    async readBytes(_fileName: string): Promise<Uint8Array> {
      throw new Error('sample-repository: non implémenté (jalon M5)');
    },
  };
}
