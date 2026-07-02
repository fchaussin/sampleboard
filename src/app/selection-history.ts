// SPDX-License-Identifier: GPL-3.0-or-later
// Historique d'actions de l'éditeur audio (M7) : pile undo/redo des sélections start/end.
// Classe pure (style OO, §16), instanciée par l'éditeur — testable isolément.

export interface Selection {
  start: number;
  end: number;
}

export class SelectionHistory {
  #past: Selection[] = [];
  #present: Selection;
  #future: Selection[] = [];

  constructor(initial: Selection) {
    this.#present = { ...initial };
  }

  get current(): Selection {
    return { ...this.#present };
  }

  get canUndo(): boolean {
    return this.#past.length > 0;
  }

  get canRedo(): boolean {
    return this.#future.length > 0;
  }

  /** Empile une nouvelle sélection (efface le futur). Ignore un état identique au courant. */
  push(selection: Selection): void {
    if (selection.start === this.#present.start && selection.end === this.#present.end) return;
    this.#past.push(this.#present);
    this.#present = { ...selection };
    this.#future = [];
  }

  /** Revient à la sélection précédente (ou renvoie la courante si rien à annuler). */
  undo(): Selection {
    const previous = this.#past.pop();
    if (previous) {
      this.#future.push(this.#present);
      this.#present = previous;
    }
    return this.current;
  }

  /** Rétablit la sélection annulée (ou renvoie la courante si rien à rétablir). */
  redo(): Selection {
    const next = this.#future.pop();
    if (next) {
      this.#past.push(this.#present);
      this.#present = next;
    }
    return this.current;
  }
}
