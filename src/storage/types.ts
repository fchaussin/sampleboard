// SPDX-License-Identifier: GPL-3.0-or-later
// Contrats de la couche persistance (voir specifications.md §8). TS pur.
// Tout accès aux données passe par ces dépôts ; aucun composant ne touche sql/fs directement.
import type { Bank, Sample, Settings } from '../domain/types';

export interface BankRepository {
  load(): Promise<Bank | null>;
  save(bank: Bank): Promise<void>;
}

export interface SampleRepository {
  list(): Promise<Sample[]>;
  add(sample: Sample, bytes: Uint8Array): Promise<void>;
  rename(sampleId: string, label: string): Promise<void>;
  remove(sampleId: string): Promise<void>;
  /** Remplace les octets ET les métadonnées d'un sample existant (retravail, M7). */
  replace(sample: Sample, bytes: Uint8Array): Promise<void>;
  /** Octets audio lus depuis {appDataDir}/audio/{fileName}. */
  readBytes(fileName: string): Promise<Uint8Array>;
}

export interface SettingsRepository {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}

/**
 * Octets audio de la bibliothèque sur disque ({appDataDir}/audio/{fileName}, voir §8, §13).
 * Implémentation réelle : tauri-plugin-fs (tauri.ts) ; en mémoire pour le web nu et les tests.
 */
export interface AudioFileStore {
  write(fileName: string, data: Uint8Array): Promise<void>;
  read(fileName: string): Promise<Uint8Array>;
  remove(fileName: string): Promise<void>;
}
