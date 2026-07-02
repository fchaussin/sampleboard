// SPDX-License-Identifier: GPL-3.0-or-later
// Dépôts en mémoire — fallback quand le runtime Tauri est absent (navigateur nu :1420 en dev).
// Session seulement, rien ne survit au rechargement ; le « mode navigateur pur » persistant
// est une évolution v2 (voir §17). Sert aussi de doublure simple dans les tests.
import type { Bank, Sample, Settings } from '../domain/types';
import { defaultSettings } from '../domain/invariants';
import type { BankRepository, SampleRepository, SettingsRepository } from './types';

export interface Repositories {
  bankRepository: BankRepository;
  sampleRepository: SampleRepository;
  settingsRepository: SettingsRepository;
}

export function createMemoryRepositories(): Repositories {
  let bank: Bank | null = null;
  let settings: Settings = defaultSettings();
  const samples = new Map<string, Sample>();
  const audioBytes = new Map<string, Uint8Array>(); // par fileName

  return {
    bankRepository: {
      async load(): Promise<Bank | null> {
        return bank ? structuredClone(bank) : null;
      },
      async save(next: Bank): Promise<void> {
        bank = structuredClone(next);
      },
    },

    sampleRepository: {
      async list(): Promise<Sample[]> {
        return [...samples.values()].map((s) => ({ ...s }));
      },
      async add(sample: Sample, data: Uint8Array): Promise<void> {
        samples.set(sample.id, { ...sample });
        audioBytes.set(sample.fileName, data.slice());
      },
      async rename(sampleId: string, label: string): Promise<void> {
        const sample = samples.get(sampleId);
        if (sample) sample.label = label;
      },
      async remove(sampleId: string): Promise<void> {
        const sample = samples.get(sampleId);
        if (!sample) return;
        samples.delete(sampleId);
        audioBytes.delete(sample.fileName);
      },
      async readBytes(fileName: string): Promise<Uint8Array> {
        const data = audioBytes.get(fileName);
        if (!data) throw new Error(`memory: fichier audio inconnu (${fileName})`);
        return data.slice();
      },
    },

    settingsRepository: {
      async load(): Promise<Settings> {
        return { ...settings };
      },
      async save(next: Settings): Promise<void> {
        settings = { ...next };
      },
    },
  };
}
