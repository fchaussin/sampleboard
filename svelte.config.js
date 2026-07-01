// SPDX-License-Identifier: GPL-3.0-or-later
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// SPA statique (Vite + Svelte 5), pas de SSR ni de routeur (voir specifications.md §4).
// Le montage se fait manuellement dans src/main.ts via la composition root.
export default {
  preprocess: vitePreprocess(),
};
