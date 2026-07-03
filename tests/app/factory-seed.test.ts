// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du semis d'usine (#14) : import sans réencodage via la commande dédiée, affectation
// des tags par token, sélection « board » sur la première page, meilleur effort (un fichier
// en échec n'interrompt pas le reste), silence total sans manifest.
import { describe, it, expect, vi } from 'vitest';
import { seedFactoryContent, type FactoryManifest } from '../../src/app/factory-seed';
import type { AppStore } from '../../src/app/store.svelte';
import type { Bank } from '../../src/domain/types';

const MANIFEST: FactoryManifest = {
  samples: [
    { file: 'boucle.ogg', label: 'Boucle', tags: ['ambience'] },
    { file: 'bip.ogg', label: 'Bip', tags: ['sfx', 'inconnu'] },
    { file: 'casse.ogg', label: 'Cassé', tags: ['sfx'] },
  ],
  board: [
    { file: 'bip.ogg' },
    { file: 'boucle.ogg', playMode: 'loop' },
    { file: 'casse.ogg' },
    { file: 'bip.ogg', playMode: 'turbo' },
  ],
};

function fakeBank(): Bank {
  return {
    id: 'bank',
    name: 'Banque',
    pages: [
      { id: 'p2', name: 'Deux', voiceMode: 'poly', rows: 2, cols: 2, position: 1, color: null },
      { id: 'p1', name: 'Principal', voiceMode: 'poly', rows: 2, cols: 2, position: 0, color: null },
    ],
    pads: [
      { id: 'padB', pageId: 'p1', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 1, color: null },
      { id: 'padA', pageId: 'p1', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 0, color: null },
      { id: 'padAutre', pageId: 'p2', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 0, color: null },
      { id: 'padC', pageId: 'p1', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 2, color: null },
      { id: 'padD', pageId: 'p1', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 3, color: null },
    ],
  };
}

function fakeDeps(manifest: FactoryManifest | null) {
  const files = new Map<string, ArrayBuffer>([
    ['boucle.ogg', new ArrayBuffer(4)],
    ['bip.ogg', new ArrayBuffer(4)],
    ['casse.ogg', new ArrayBuffer(4)],
  ]);
  let nextId = 0;
  const commands = {
    seedFactorySample: vi.fn(async (fileName: string) =>
      fileName === 'casse.ogg'
        ? ({ ok: false, reason: 'undecodable' } as const)
        : ({ ok: true, sampleId: `s${++nextId}-${fileName}` } as const),
    ),
    toggleSampleTag: vi.fn(),
    assignSample: vi.fn(),
    setPadPlayMode: vi.fn(),
  };
  const fetchBytes = vi.fn(async (path: string): Promise<ArrayBuffer | null> => {
    if (path === 'factory-samples/manifest.json') {
      return manifest === null
        ? null
        : new TextEncoder().encode(JSON.stringify(manifest)).buffer as ArrayBuffer;
    }
    const file = decodeURIComponent(path.replace('factory-samples/', ''));
    return files.get(file) ?? null;
  });
  const store = { bank: fakeBank() } as unknown as AppStore;
  const tagIdByToken = new Map([
    ['sfx', 'tag-sfx'],
    ['ambience', 'tag-amb'],
  ]);
  return { commands, store, fetchBytes, tagIdByToken };
}

describe('seedFactoryContent', () => {
  it('sème chaque sample du manifest avec son libellé curaté et ses tags connus', async () => {
    const deps = fakeDeps(MANIFEST);
    await seedFactoryContent(deps);

    expect(deps.commands.seedFactorySample).toHaveBeenCalledTimes(3);
    expect(deps.commands.seedFactorySample).toHaveBeenCalledWith('boucle.ogg', 'Boucle', expect.anything());
    // Tags : token connu → affectation ; token inconnu du semis → ignoré sans casser.
    expect(deps.commands.toggleSampleTag).toHaveBeenCalledWith('s1-boucle.ogg', 'tag-amb');
    expect(deps.commands.toggleSampleTag).toHaveBeenCalledWith('s2-bip.ogg', 'tag-sfx');
    expect(deps.commands.toggleSampleTag).toHaveBeenCalledTimes(2);
  });

  it('assigne la sélection board aux pads de la PREMIÈRE page, par position', async () => {
    const deps = fakeDeps(MANIFEST);
    await seedFactoryContent(deps);

    // Slot 0 → padA (position 0), slot 1 → padB ; le slot 2 (sample en échec) est sauté ;
    // le slot 3 (padD) reçoit bip mais son playMode invalide est ignoré.
    expect(deps.commands.assignSample).toHaveBeenCalledWith('padA', 's2-bip.ogg');
    expect(deps.commands.assignSample).toHaveBeenCalledWith('padB', 's1-boucle.ogg');
    expect(deps.commands.assignSample).toHaveBeenCalledWith('padD', 's2-bip.ogg');
    expect(deps.commands.assignSample).toHaveBeenCalledTimes(3);
    expect(deps.commands.setPadPlayMode).toHaveBeenCalledOnce();
    expect(deps.commands.setPadPlayMode).toHaveBeenCalledWith('padB', 'loop');
  });

  it('ne fait rien du tout sans manifest embarqué', async () => {
    const deps = fakeDeps(null);
    await seedFactoryContent(deps);
    expect(deps.commands.seedFactorySample).not.toHaveBeenCalled();
    expect(deps.commands.assignSample).not.toHaveBeenCalled();
  });

  it('survit à un manifest corrompu', async () => {
    const deps = fakeDeps(MANIFEST);
    deps.fetchBytes.mockResolvedValueOnce(new TextEncoder().encode('{pas du json').buffer as ArrayBuffer);
    await expect(seedFactoryContent(deps)).resolves.toBeUndefined();
    expect(deps.commands.seedFactorySample).not.toHaveBeenCalled();
  });
});
