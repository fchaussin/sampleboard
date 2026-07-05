// SPDX-License-Identifier: GPL-3.0-or-later
// Tests du semis d'usine (#14, #28) : import sans réencodage via la commande dédiée,
// affectation des tags par token, PLANCHES par page (grille imposable, page 2 batterie),
// meilleur effort (un fichier en échec n'interrompt pas le reste), silence sans manifest.
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
  boards: [
    {
      slots: [
        { file: 'bip.ogg' },
        { file: 'boucle.ogg', playMode: 'loop' },
        { file: 'casse.ogg' },
        { file: 'bip.ogg', playMode: 'turbo' },
      ],
    },
    // Planche page 2 (#28) : grille imposée 1×2, slot unique.
    { page: 2, rows: 1, cols: 2, slots: [{ file: 'boucle.ogg' }] },
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
      { id: 'padB', pageId: 'p1', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 1, color: null, cueStart: null, cueEnd: null },
      { id: 'padA', pageId: 'p1', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 0, color: null, cueStart: null, cueEnd: null },
      { id: 'padAutre', pageId: 'p2', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 0, color: null, cueStart: null, cueEnd: null },
      { id: 'padC', pageId: 'p1', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 2, color: null, cueStart: null, cueEnd: null },
      { id: 'padD', pageId: 'p1', name: '', sampleId: null, playMode: 'oneShot', gainDb: 0, position: 3, color: null, cueStart: null, cueEnd: null },
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
    setPageGrid: vi.fn(),
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

  it('assigne chaque planche à SA page, par position (doublons multi-pads compris)', async () => {
    const deps = fakeDeps(MANIFEST);
    await seedFactoryContent(deps);

    // Planche 1 : slot 0 → padA, slot 1 → padB ; slot 2 (sample en échec) sauté ;
    // slot 3 (padD) reçoit bip mais son playMode invalide est ignoré.
    expect(deps.commands.assignSample).toHaveBeenCalledWith('padA', 's2-bip.ogg');
    expect(deps.commands.assignSample).toHaveBeenCalledWith('padB', 's1-boucle.ogg');
    expect(deps.commands.assignSample).toHaveBeenCalledWith('padD', 's2-bip.ogg');
    // Planche 2 : slot 0 → padAutre (page de rang 2).
    expect(deps.commands.assignSample).toHaveBeenCalledWith('padAutre', 's1-boucle.ogg');
    expect(deps.commands.assignSample).toHaveBeenCalledTimes(4);
    expect(deps.commands.setPadPlayMode).toHaveBeenCalledOnce();
    expect(deps.commands.setPadPlayMode).toHaveBeenCalledWith('padB', 'loop');
  });

  it("impose la grille déclarée par une planche AVANT d'assigner (#28)", async () => {
    const deps = fakeDeps(MANIFEST);
    await seedFactoryContent(deps);
    expect(deps.commands.setPageGrid).toHaveBeenCalledOnce();
    expect(deps.commands.setPageGrid).toHaveBeenCalledWith('p2', 1, 2); // page rang 2 seulement
  });

  it("l'assignation d'une planche est PROGRESSIVE : le slot part avec son sample (#27)", async () => {
    const deps = fakeDeps(MANIFEST);
    let resolveFirst: (v: ArrayBuffer | null) => void = () => {};
    // Le 1er fichier (boucle.ogg) reste en vol : bip.ogg (slot 0) doit être assigné SANS lui.
    deps.fetchBytes.mockImplementation(async (path: string) => {
      if (path === 'factory-samples/manifest.json') {
        return new TextEncoder().encode(JSON.stringify(MANIFEST)).buffer as ArrayBuffer;
      }
      if (path.includes('boucle')) return new Promise<ArrayBuffer | null>((r) => { resolveFirst = r; });
      return new ArrayBuffer(4);
    });
    const run = seedFactoryContent(deps);
    await vi.waitFor(() => expect(deps.commands.assignSample).not.toHaveBeenCalled());
    resolveFirst(new ArrayBuffer(4)); // boucle.ogg atterrit → padB assigné pendant que le semis continue
    await vi.waitFor(() => expect(deps.commands.assignSample).toHaveBeenCalledWith('padB', 's1-boucle.ogg'));
    await run;
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
