// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { factorySamples } from './vite-plugin-factory-samples';

// Worker d'extraction d'archives (libarchive.js, M8) : le worker résout `libarchive.wasm`
// RELATIVEMENT à sa propre URL — les deux fichiers doivent donc être servis côte à côte,
// sous un nom stable (pas de hash Vite). Ce plugin les sert en dev et les copie au build.
// Depuis M9 (F-Droid), les artefacts sont CONSTRUITS DEPUIS LES SOURCES et vendorisés —
// voir src/vendor/libarchive/PROVENANCE.md + scripts/build-libarchive-wasm.sh.
const LIBARCHIVE_DIST = fileURLToPath(new URL('./src/vendor/libarchive/', import.meta.url));
const LIBARCHIVE_FILES = [
  { name: 'worker-bundle.js', mime: 'text/javascript' },
  { name: 'libarchive.wasm', mime: 'application/wasm' },
];

function libarchiveAssets(): Plugin {
  return {
    name: 'libarchive-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = LIBARCHIVE_FILES.find((f) => req.url === `/libarchive/${f.name}`);
        if (!file) return next();
        res.setHeader('Content-Type', file.mime);
        res.end(readFileSync(LIBARCHIVE_DIST + file.name));
      });
    },
    generateBundle() {
      for (const f of LIBARCHIVE_FILES) {
        this.emitFile({
          type: 'asset',
          fileName: `libarchive/${f.name}`,
          source: readFileSync(LIBARCHIVE_DIST + f.name),
        });
      }
    },
  };
}

/**
 * Service worker de la PWA (M10) : émet `sw.js` au build avec la liste RÉELLE des fichiers
 * du bundle injectée dans `self.__PRECACHE__` (offline dès la première visite) et une
 * version de cache dérivée du package (invalide les caches à chaque release). À placer
 * APRÈS les plugins qui émettent des assets (libarchive) pour les voir dans le bundle.
 */
function pwaServiceWorker(): Plugin {
  return {
    name: 'pwa-sw',
    generateBundle(_options, bundle) {
      // Bundle (js/css hachés, libarchive) + samples d'usine (public/, hors bundle — 1,5 Mo
      // CC0) : le PREMIER lancement hors-ligne sème la banque complète, pas un semis tronqué.
      const factory = JSON.parse(
        readFileSync('public/factory-samples/manifest.json', 'utf8'),
      ) as { samples: Array<{ file: string }> };
      const files = [
        ...Object.keys(bundle).filter((f) => f !== 'sw.js'),
        'factory-samples/manifest.json',
        ...factory.samples.map((s) => `factory-samples/${encodeURIComponent(s.file)}`),
      ];
      const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;
      const source = readFileSync('src/pwa/sw.js', 'utf8')
        .replaceAll('self.__PRECACHE__', JSON.stringify(files))
        .replaceAll('self.__CACHE_VERSION__', JSON.stringify(version));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// Config Vite orientée Tauri : port fixe, pas de nettoyage d'écran (logs Rust visibles),
// et on ignore le dossier Rust pour ne pas relancer le front à chaque build cargo.
// Le serveur écoute sur toutes les interfaces (accessible depuis l'hôte via le mapping Docker).
// HMR : passe par le MÊME port (1420) que l'app — évite un 2ᵉ port à mapper/joindre depuis
// l'hôte. Un vrai appareil mobile pourra passer une IP LAN via TAURI_DEV_HOST.
const envHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  // Base RELATIVE : le même build se sert à la racine (Tauri, nginx) ou sous un
  // sous-chemin (GitHub Pages — https://<user>.github.io/sampleboard/). SPA à routage
  // par fragment : aucun autre impact.
  base: './',
  // Version affichée aux Réglages (#31) — même source que le cache du service worker.
  define: {
    __APP_VERSION__: JSON.stringify(
      (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version,
    ),
  },
  plugins: [svelte(), libarchiveAssets(), factorySamples(), pwaServiceWorker()],
  // SPA statique : pas de SSR (build client uniquement, sortie dans dist/).
  clearScreen: false,
  server: {
    host: true,
    port: 1420,
    strictPort: true,
    hmr: envHost && envHost !== '0.0.0.0' ? { protocol: 'ws', host: envHost } : { clientPort: 1420 },
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
