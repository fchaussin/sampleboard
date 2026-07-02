// SPDX-License-Identifier: GPL-3.0-or-later
// Dépôts en mémoire — fallback quand le runtime Tauri est absent (navigateur nu :1420 en dev).
// Session seulement, rien ne survit au rechargement ; le « mode navigateur pur » persistant
// est une évolution v2 (voir §17). Sert aussi de doublure simple dans les tests.
import type { Bank, Sample, Settings, Tag } from '../domain/types';
import { defaultSettings } from '../domain/invariants';
import type { BankRepository, SampleRepository, SettingsRepository, TagRepository } from './types';

export interface Repositories {
  bankRepository: BankRepository;
  sampleRepository: SampleRepository;
  settingsRepository: SettingsRepository;
  tagRepository: TagRepository;
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
      async replace(sample: Sample, data: Uint8Array): Promise<void> {
        if (!samples.has(sample.id)) return;
        samples.set(sample.id, { ...sample });
        audioBytes.set(sample.fileName, data.slice());
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

    tagRepository: createMemoryTagRepository(),
  };
}

function createMemoryTagRepository(): TagRepository {
  const tags = new Map<string, Tag>();
  const assignments = new Map<string, Set<string>>();
  return {
    async list(): Promise<Tag[]> {
      return [...tags.values()].map((t) => ({ ...t })).sort((a, b) => a.label.localeCompare(b.label));
    },
    async create(tag: Tag): Promise<void> {
      tags.set(tag.id, { ...tag });
    },
    async rename(tagId: string, label: string): Promise<void> {
      const tag = tags.get(tagId);
      if (tag) tag.label = label;
    },
    async remove(tagId: string): Promise<void> {
      tags.delete(tagId);
      for (const set of assignments.values()) set.delete(tagId);
    },
    async assignments(): Promise<Map<string, Set<string>>> {
      return new Map([...assignments].map(([sampleId, set]) => [sampleId, new Set(set)]));
    },
    async assign(sampleId: string, tagId: string): Promise<void> {
      let set = assignments.get(sampleId);
      if (!set) {
        set = new Set();
        assignments.set(sampleId, set);
      }
      set.add(tagId);
    },
    async unassign(sampleId: string, tagId: string): Promise<void> {
      assignments.get(sampleId)?.delete(tagId);
    },
  };
}
