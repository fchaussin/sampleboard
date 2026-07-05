// SPDX-License-Identifier: GPL-3.0-or-later
// Maintenance de la distribution WEB/PWA (#31) : mise à jour et réinitialisation d'usine.
// Deux gestes DISTINCTS — se mettre à jour ne coûte jamais ses données à l'utilisateur :
// - reloadForUpdate : pousse le service worker à se re-vérifier puis recharge ; les
//   navigations étant réseau-d'abord (sw.js), le rechargement sert la dernière version
//   publiée dès qu'elle est joignable (hors-ligne : on retombe sur le cache, sans casse).
// - requestFactoryReset : désenregistre le SW, purge les caches, pose un DRAPEAU de
//   réinitialisation puis recharge — la suppression d'IndexedDB s'exécute AU BOOT SUIVANT
//   (main.ts), avant toute ouverture de connexion : pas de deleteDatabase bloqué par la
//   connexion vivante de l'app.
export const RESET_FLAG = 'sampleboard-factory-reset';

/** Recharge l'app en récupérant la dernière version publiée (non destructif). */
export async function reloadForUpdate(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update().catch(() => {});
  }
  location.reload();
}

/** Purge SW + caches, arme le drapeau, recharge — le boot suivant repart d'usine. */
export async function requestFactoryReset(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
  }
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
  sessionStorage.setItem(RESET_FLAG, '1');
  location.reload();
}

/** À appeler AVANT createApp : exécute la réinitialisation demandée au chargement précédent. */
export async function applyPendingFactoryReset(dbName = 'sampleboard'): Promise<void> {
  if (sessionStorage.getItem(RESET_FLAG) === null) return;
  sessionStorage.removeItem(RESET_FLAG);
  await new Promise<void>((resolve) => {
    // Aucune connexion ouverte à ce stade (avant la composition root) : suppression nette.
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve(); // meilleur effort : le boot continue quoi qu'il arrive
    request.onblocked = () => resolve();
  });
}
