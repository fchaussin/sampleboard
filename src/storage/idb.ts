// SPDX-License-Identifier: GPL-3.0-or-later
// Dépôts IndexedDB (M10, décision §16) — persistance NAVIGATEUR de la distribution web/PWA.
// Implémentation web des contrats de storage/types.ts : mêmes garanties que la voie SQLite
// (cascades de suppression comprises), transactions IDB natives (pas de verrou d'écriture
// applicatif). Le schéma SQL reste propre à Tauri ; le mode mémoire reste la doublure de
// test. TS pur, zéro dépendance.
import type { Bank, Sample, Settings, Tag } from '../domain/types';
import { defaultSettings } from '../domain/invariants';
import type { Repositories } from './memory';

const DB_VERSION = 1;

/** Magasins v1 — `kv` porte les singletons (banque, réglages), le reste est par entité. */
const STORES = {
  kv: 'kv', // 'bank' → Bank, 'settings' → Settings
  samples: 'samples', // keyPath 'id'
  audio: 'audio', // clé fileName → Uint8Array
  tags: 'tags', // keyPath 'id'
  sampleTags: 'sampleTags', // clé `${sampleId}|${tagId}` → { sampleId, tagId }
} as const;

interface Assignment {
  sampleId: string;
  tagId: string;
}

/** Promifie une requête IDB (l'API est à callbacks). */
function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('idb: request failed'));
  });
}

/** Résolution à la COMPLÉTION de la transaction : les écritures sont réellement durables. */
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('idb: transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('idb: transaction aborted'));
  });
}

function openDatabase(name: string): Promise<IDBDatabase> {
  const request = indexedDB.open(name, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORES.kv)) db.createObjectStore(STORES.kv);
    if (!db.objectStoreNames.contains(STORES.samples))
      db.createObjectStore(STORES.samples, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(STORES.audio)) db.createObjectStore(STORES.audio);
    if (!db.objectStoreNames.contains(STORES.tags))
      db.createObjectStore(STORES.tags, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(STORES.sampleTags))
      db.createObjectStore(STORES.sampleTags);
  };
  return req(request as IDBRequest<IDBDatabase>);
}

const pairKey = (sampleId: string, tagId: string): string => `${sampleId}|${tagId}`;

/** Ouvre (et crée au besoin) la base puis expose les quatre dépôts. */
export async function createIdbRepositories(dbName = 'sampleboard'): Promise<Repositories> {
  const db = await openDatabase(dbName);

  /** Toutes les affectations d'une transaction donnée (cascades et lecture globale). */
  async function allAssignments(tx: IDBTransaction): Promise<Assignment[]> {
    return req(tx.objectStore(STORES.sampleTags).getAll() as IDBRequest<Assignment[]>);
  }

  return {
    bankRepository: {
      async load(): Promise<Bank | null> {
        const tx = db.transaction(STORES.kv, 'readonly');
        const bank = await req(tx.objectStore(STORES.kv).get('bank') as IDBRequest<Bank | undefined>);
        if (!bank) return null;
        // Compat ascendante : une banque d'avant M11 n'a pas de points cue → défaut null
        // (sinon la détection « a des cue » verrait `undefined !== null` comme vrai).
        for (const pad of bank.pads) {
          pad.cueStart ??= null;
          pad.cueEnd ??= null;
        }
        return bank;
      },
      async save(bank: Bank): Promise<void> {
        const tx = db.transaction(STORES.kv, 'readwrite');
        // $state proxifie l'arbre : on clone un objet BRUT avant le structured clone d'IDB.
        tx.objectStore(STORES.kv).put(JSON.parse(JSON.stringify(bank)), 'bank');
        await done(tx);
      },
    },

    settingsRepository: {
      async load(): Promise<Settings> {
        const tx = db.transaction(STORES.kv, 'readonly');
        const settings = await req(
          tx.objectStore(STORES.kv).get('settings') as IDBRequest<Settings | undefined>,
        );
        // Défauts complétés champ à champ : un réglage ajouté par une mise à jour a sa valeur.
        return { ...defaultSettings(), ...(settings ?? {}) };
      },
      async save(settings: Settings): Promise<void> {
        const tx = db.transaction(STORES.kv, 'readwrite');
        tx.objectStore(STORES.kv).put(JSON.parse(JSON.stringify(settings)), 'settings');
        await done(tx);
      },
    },

    sampleRepository: {
      async list(): Promise<Sample[]> {
        const tx = db.transaction(STORES.samples, 'readonly');
        const samples = await req(tx.objectStore(STORES.samples).getAll() as IDBRequest<Sample[]>);
        return samples.sort((a, b) => a.createdAt - b.createdAt);
      },
      async add(sample: Sample, bytes: Uint8Array): Promise<void> {
        const tx = db.transaction([STORES.samples, STORES.audio], 'readwrite');
        tx.objectStore(STORES.samples).put({ ...sample });
        tx.objectStore(STORES.audio).put(bytes, sample.fileName);
        await done(tx);
      },
      async rename(sampleId: string, label: string): Promise<void> {
        const tx = db.transaction(STORES.samples, 'readwrite');
        const store = tx.objectStore(STORES.samples);
        const sample = await req(store.get(sampleId) as IDBRequest<Sample | undefined>);
        if (sample) store.put({ ...sample, label });
        await done(tx);
      },
      async remove(sampleId: string): Promise<void> {
        // Miroir des cascades SQL : octets audio ET affectations partent avec le sample.
        const tx = db.transaction([STORES.samples, STORES.audio, STORES.sampleTags], 'readwrite');
        const store = tx.objectStore(STORES.samples);
        const sample = await req(store.get(sampleId) as IDBRequest<Sample | undefined>);
        if (sample) {
          store.delete(sampleId);
          tx.objectStore(STORES.audio).delete(sample.fileName);
          for (const a of await allAssignments(tx)) {
            if (a.sampleId === sampleId) tx.objectStore(STORES.sampleTags).delete(pairKey(a.sampleId, a.tagId));
          }
        }
        await done(tx);
      },
      async replace(sample: Sample, bytes: Uint8Array): Promise<void> {
        const tx = db.transaction([STORES.samples, STORES.audio], 'readwrite');
        tx.objectStore(STORES.samples).put({ ...sample });
        tx.objectStore(STORES.audio).put(bytes, sample.fileName);
        await done(tx);
      },
      async readBytes(fileName: string): Promise<Uint8Array> {
        const tx = db.transaction(STORES.audio, 'readonly');
        const bytes = await req(
          tx.objectStore(STORES.audio).get(fileName) as IDBRequest<Uint8Array | undefined>,
        );
        if (!bytes) throw new Error(`idb: audio bytes missing (${fileName})`);
        return bytes;
      },
    },

    tagRepository: {
      async list(): Promise<Tag[]> {
        const tx = db.transaction(STORES.tags, 'readonly');
        return req(tx.objectStore(STORES.tags).getAll() as IDBRequest<Tag[]>);
      },
      async create(tag: Tag): Promise<void> {
        const tx = db.transaction(STORES.tags, 'readwrite');
        tx.objectStore(STORES.tags).put({ ...tag });
        await done(tx);
      },
      async rename(tagId: string, label: string): Promise<void> {
        const tx = db.transaction(STORES.tags, 'readwrite');
        const store = tx.objectStore(STORES.tags);
        const tag = await req(store.get(tagId) as IDBRequest<Tag | undefined>);
        if (tag) store.put({ ...tag, label });
        await done(tx);
      },
      async remove(tagId: string): Promise<void> {
        // Miroir du ON DELETE CASCADE : les affectations du tag partent avec lui.
        const tx = db.transaction([STORES.tags, STORES.sampleTags], 'readwrite');
        tx.objectStore(STORES.tags).delete(tagId);
        for (const a of await allAssignments(tx)) {
          if (a.tagId === tagId) tx.objectStore(STORES.sampleTags).delete(pairKey(a.sampleId, a.tagId));
        }
        await done(tx);
      },
      async assignments(): Promise<Map<string, Set<string>>> {
        const tx = db.transaction(STORES.sampleTags, 'readonly');
        const map = new Map<string, Set<string>>();
        for (const a of await allAssignments(tx)) {
          const set = map.get(a.sampleId) ?? new Set<string>();
          set.add(a.tagId);
          map.set(a.sampleId, set);
        }
        return map;
      },
      async assign(sampleId: string, tagId: string): Promise<void> {
        const tx = db.transaction(STORES.sampleTags, 'readwrite');
        tx.objectStore(STORES.sampleTags).put({ sampleId, tagId }, pairKey(sampleId, tagId));
        await done(tx);
      },
      async unassign(sampleId: string, tagId: string): Promise<void> {
        const tx = db.transaction(STORES.sampleTags, 'readwrite');
        tx.objectStore(STORES.sampleTags).delete(pairKey(sampleId, tagId));
        await done(tx);
      },
    },
  };
}
