// SPDX-License-Identifier: GPL-3.0-or-later
// Service worker de la PWA (M10, décision §16) — offline SANS bibliothèque tierce.
// Émis au BUILD par le plugin Vite `pwa-sw` (vite.config.ts) : le marqueur PRECACHE est
// remplacé par la liste réelle des assets construits (js/css hachés, worker+wasm
// libarchive, worker d'encodage) — ils sont donc TOUS précachés à l'installation, ce qui
// rend l'app hors-ligne DÈS la première visite (le cache runtime seul raterait le premier
// chargement : les assets partent avant que le SW ne contrôle la page).
// Stratégies : navigations = RÉSEAU d'abord (les mises à jour arrivent), repli cache ;
// autres GET même origine (dont samples d'usine au fil du semis) = CACHE d'abord.
const PRECACHE = /** @type {string[]} */ (self.__PRECACHE__);
const CACHE = `sampleboard-${self.__CACHE_VERSION__}`;
const CORE = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([...CORE, ...PRECACHE]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Réseau d'abord : une nouvelle version de l'app est servie dès qu'elle existe.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./', { ignoreVary: true }).then((hit) => hit ?? Response.error())),
    );
    return;
  }

  // Assets : cache d'abord (immuables par hachage Vite), remplissage au vol pour le reste
  // (samples d'usine récupérés pendant le semis, etc.). `ignoreVary` : des serveurs (dont
  // vite preview) émettent `Vary: Origin`, et l'en-tête Origin DIFFÈRE entre la requête
  // d'installation et les sous-ressources du document (crossorigin) — sans quoi le match
  // rate précisément au premier rechargement hors-ligne. Même origine : sans risque.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
