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

// Config Vite orientée Tauri : port fixe, pas de nettoyage d'écran (logs Rust visibles),
// et on ignore le dossier Rust pour ne pas relancer le front à chaque build cargo.
// Le serveur écoute sur toutes les interfaces (accessible depuis l'hôte via le mapping Docker).
// HMR : passe par le MÊME port (1420) que l'app — évite un 2ᵉ port à mapper/joindre depuis
// l'hôte. Un vrai appareil mobile pourra passer une IP LAN via TAURI_DEV_HOST.
const envHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [svelte(), libarchiveAssets(), factorySamples()],
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
