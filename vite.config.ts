// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Config Vite orientée Tauri : port fixe, pas de nettoyage d'écran (logs Rust visibles),
// et on ignore le dossier Rust pour ne pas relancer le front à chaque build cargo.
// Le serveur écoute sur toutes les interfaces (accessible depuis l'hôte via le mapping Docker).
// HMR : passe par le MÊME port (1420) que l'app — évite un 2ᵉ port à mapper/joindre depuis
// l'hôte. Un vrai appareil mobile pourra passer une IP LAN via TAURI_DEV_HOST.
const envHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [svelte()],
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
