// SPDX-License-Identifier: GPL-3.0-or-later
// Génération d'identifiants opaques (pads, pages, samples). Isolé pour être injectable/testable.
// Utilise l'API Web Crypto (présente dans la WebView Tauri et sous Node ≥ 19).

/** Nouvel identifiant unique, éventuellement préfixé (lisibilité en debug). */
export function newId(prefix = ''): string {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}-${uuid}` : uuid;
}
