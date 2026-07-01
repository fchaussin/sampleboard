// SPDX-License-Identifier: GPL-3.0-or-later
// Génération d'identifiants opaques (pads, pages, samples). Isolé pour être injectable/testable.
// Robuste : `crypto.randomUUID` n'existe QUE en contexte sécurisé (https/localhost) ; on retombe
// sur `crypto.getRandomValues` (disponible partout, y compris via une IP LAN en http), sinon un
// import réussi mais un ID qui jette abortirait silencieusement l'opération.

/** UUID v4 sans dépendance au contexte sécurisé. */
function uuidV4(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40; // version 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variant
  let hex = '';
  for (let i = 0; i < 16; i++) hex += b[i]!.toString(16).padStart(2, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Nouvel identifiant unique, éventuellement préfixé (lisibilité en debug). */
export function newId(prefix = ''): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : uuidV4();
  return prefix ? `${prefix}-${uuid}` : uuid;
}
