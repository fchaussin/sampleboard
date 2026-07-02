// SPDX-License-Identifier: GPL-3.0-or-later
// Tests de la fabrique (M6) : un board naît COMPLET — page nommée/colorée, une case = un pad,
// chaque pad coloré (cycle de palette par position).
import { describe, it, expect } from 'vitest';
import { BankFactory } from '../../src/app/bank-factory';
import { COLORS } from '../../src/domain/enums';

function factory(): BankFactory {
  let n = 0;
  return new BankFactory({
    ids: () => `id-${n++}`,
    pageName: (rank) => (rank === 1 ? 'Principal' : `Page ${rank}`),
  });
}

describe('BankFactory', () => {
  it('createBank : PLUSIEURS pages aux layouts contrastés, toutes complètes et colorées', () => {
    const bank = factory().createBank();
    expect(bank.pages.length).toBeGreaterThanOrEqual(2); // le concept de page saute aux yeux
    const principal = bank.pages[0]!;
    expect(principal.name).toBe('Principal');
    expect(principal.color).toBe(COLORS[0]);
    expect(principal).toMatchObject({ rows: 4, cols: 4 });
    // Layouts variés : au moins deux dimensions de grille distinctes.
    const layouts = new Set(bank.pages.map((p) => `${p.rows}x${p.cols}`));
    expect(layouts.size).toBeGreaterThanOrEqual(2);
    // Chaque page est COMPLÈTE : une case = un pad.
    for (const page of bank.pages) {
      const pads = bank.pads.filter((p) => p.pageId === page.id);
      expect(pads).toHaveLength(page.rows * page.cols);
    }
  });

  it('chaque pad a une couleur dès l’init : cycle de palette par position', () => {
    const bank = factory().createBank();
    for (const pad of bank.pads) {
      expect(pad.color).toBe(COLORS[pad.position % COLORS.length]);
    }
  });

  it('createPage : rang → nom, couleur (cycle) et position', () => {
    const f = factory();
    const page2 = f.createPage(2);
    expect(page2).toMatchObject({ name: 'Page 2', color: COLORS[1], position: 1 });
    const pageWrap = f.createPage(COLORS.length + 1); // le cycle reboucle
    expect(pageWrap.color).toBe(COLORS[0]);
  });

  it('fillPagePads ne comble que les cases libres de la page visée', () => {
    const f = factory();
    const page = f.createPage(1);
    const existing = [f.createPad(page.id, 3), f.createPad('autre-page', 5)];
    const created = f.fillPagePads(page, existing);
    expect(created).toHaveLength(15); // 16 cases, la 3 est prise (le pad d'une autre page ne compte pas)
    expect(created.some((p) => p.position === 3)).toBe(false);
  });
});
