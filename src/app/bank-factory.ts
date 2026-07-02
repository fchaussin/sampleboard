// SPDX-License-Identifier: GPL-3.0-or-later
// Fabrique des entités de la banque — responsabilité UNIQUE : les valeurs par défaut de
// création (§6, §16). Décision M6 : un board naît COMPLET et coloré — jamais de page
// vierge ni de pad sans couleur (grille remplie, couleurs de palette cycliques).
// Injectée (constructeur) dans les commandes et la composition root ; les noms localisés
// viennent du bootstrap (la couche app n'importe jamais ui/i18n, §4).
import type { Bank, Pad, Page } from '../domain/types';
import { COLORS, type Color } from '../domain/enums';
import { DEFAULT_COLS, DEFAULT_GAIN_DB, DEFAULT_ROWS, gridCapacity } from '../domain/invariants';
import { newId } from '../domain/id';

export interface BankFactoryOptions {
  /** Générateur d'identifiants (injectable pour les tests). Défaut : `newId()`. */
  ids?: () => string;
  /** Nom localisé de la page de rang `rank` (1-based) : « Principal », « Page 2 »… */
  pageName?: (rank: number) => string;
}

export class BankFactory {
  readonly #ids: () => string;
  readonly #pageName: (rank: number) => string;

  constructor({ ids = () => newId(), pageName = () => '' }: BankFactoryOptions = {}) {
    this.#ids = ids;
    this.#pageName = pageName;
  }

  /** Couleur par défaut d'un pad : cycle de la palette par position (board lisible d'emblée). */
  padColor(position: number): Color {
    return COLORS[position % COLORS.length]!;
  }

  /** Couleur par défaut de la page de rang `rank` (1-based) : cycle de la palette. */
  pageColor(rank: number): Color {
    return COLORS[(rank - 1) % COLORS.length]!;
  }

  /** Pad neuf aux valeurs par défaut du domaine (§6) + couleur de palette par position. */
  createPad(pageId: string, position: number): Pad {
    return {
      id: this.#ids(),
      pageId,
      name: '',
      sampleId: null,
      playMode: 'oneShot',
      gainDb: DEFAULT_GAIN_DB,
      position,
      color: this.padColor(position),
    };
  }

  /** Page neuve aux valeurs par défaut (§6) — `rank` (1-based) pilote position, nom, couleur. */
  createPage(rank: number, grid?: { rows: number; cols: number }): Page {
    return {
      id: this.#ids(),
      name: this.#pageName(rank),
      voiceMode: 'poly',
      rows: grid?.rows ?? DEFAULT_ROWS,
      cols: grid?.cols ?? DEFAULT_COLS,
      position: rank - 1,
      color: this.pageColor(rank),
    };
  }

  /**
   * Pads manquants pour que la grille de `page` soit complète (une case = un pad).
   * Sert à la création d'une page ET à l'agrandissement de sa grille.
   */
  fillPagePads(page: Page, existing: readonly Pad[]): Pad[] {
    const taken = new Set(
      existing.filter((p) => p.pageId === page.id).map((p) => p.position),
    );
    const pads: Pad[] = [];
    for (let position = 0; position < gridCapacity(page); position++) {
      if (!taken.has(position)) pads.push(this.createPad(page.id, position));
    }
    return pads;
  }

  /**
   * Grilles de la banque du premier lancement : PLUSIEURS pages aux layouts contrastés,
   * pour rendre le concept de page évident sans explication (décision M8).
   */
  static readonly FIRST_RUN_LAYOUTS: ReadonlyArray<{ rows: number; cols: number }> = [
    { rows: 4, cols: 4 }, // « Principal » — le défaut
    { rows: 2, cols: 2 }, // gros pads (panique/table de jeu)
    { rows: 8, cols: 6 }, // dense (banque de bruitages)
  ];

  /** Banque du premier lancement : pages complètes aux layouts variés, toutes colorées. */
  createBank(): Bank {
    const pages = BankFactory.FIRST_RUN_LAYOUTS.map((grid, i) => this.createPage(i + 1, grid));
    const pads = pages.flatMap((page) => this.fillPagePads(page, []));
    return { id: this.#ids(), name: '', pages, pads };
  }
}
