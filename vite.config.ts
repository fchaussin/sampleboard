// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Config Vite orientée Tauri : port fixe, pas de nettoyage d'écran (logs Rust visibles),
// et on ignore le dossier Rust pour ne pas relancer le front à chaque build cargo.
// L'hôte de dev Tauri (mobile) est injecté via TAURI_DEV_HOST le cas échéant.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [svelte()],
  // SPA statique : pas de SSR (build client uniquement, sortie dans dist/).
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host ?? false,
    hmr: host
      ? { protocol: 'ws', host, port: 1421 }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
