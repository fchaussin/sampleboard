// SPDX-License-Identifier: GPL-3.0-or-later
// Domaine pur : lectures dérivées de l'arbre banque (voir specifications.md §6).
// Fonctions pures, sans effet ni dépendance externe — testables telles quelles.
import type { Bank, Pad, Page } from './types';

/** Pages d'une banque triées par `position` (copie ; n'altère pas l'ordre source). */
export function pagesSorted(bank: Bank): Page[] {
  return [...bank.pages].sort((a, b) => a.position - b.position);
}

/** Pads d'une page, triés par `position` (grille). */
export function padsOfPage(bank: Bank, pageId: string): Pad[] {
  return bank.pads.filter((p) => p.pageId === pageId).sort((a, b) => a.position - b.position);
}

/** Pad occupant une position dans une liste de pads (ou `undefined` : case vide). */
export function padAtPosition(pads: readonly Pad[], position: number): Pad | undefined {
  return pads.find((p) => p.position === position);
}

export function findPad(bank: Bank, padId: string): Pad | undefined {
  return bank.pads.find((p) => p.id === padId);
}

export function findPage(bank: Bank, pageId: string): Page | undefined {
  return bank.pages.find((p) => p.id === pageId);
}
