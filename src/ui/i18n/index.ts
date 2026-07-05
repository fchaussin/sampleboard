// SPDX-License-Identifier: GPL-3.0-or-later
// Loader i18n minimal + t() (voir specifications.md §3). en = défaut & fallback
// (décision 2026-07-05 — dépôt public international) ; fr disponible via les Réglages.
// Le code ne porte QUE des clés (tokens) ; zéro texte en dur dans les composants.
// La langue courante réactive vit dans le store (rune settings.locale) ; t() reste pur.
import en from './en.json';
import fr from './fr.json';
import { DEFAULT_LOCALE } from '../../domain/invariants';

type Messages = Record<string, string>;

// Registre des tables de traduction — alimente aussi le sélecteur des Réglages.
const translations: Record<string, Messages> = {
  en,
  fr,
};

/**
 * Résout une clé i18n pour une langue donnée.
 * Ordre : langue demandée → fallback en → clé brute (jamais de texte en dur perdu).
 */
export function t(key: string, locale: string = DEFAULT_LOCALE): string {
  const fallback = translations[DEFAULT_LOCALE] ?? {};
  const table = translations[locale] ?? fallback;
  return table[key] ?? fallback[key] ?? key;
}

/** Langues pour lesquelles une table est chargée. */
export function availableLocales(): string[] {
  return Object.keys(translations);
}

export { DEFAULT_LOCALE };
