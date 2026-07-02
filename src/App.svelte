<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Agencement v1 (§11) : Topbar (infos page) / grille plein écran / Bottombar (actions),
     tiroir contextuel à droite et bibliothèque en panneau plein écran. -->
<script lang="ts">
  import type { App } from './app/create-app';
  import Topbar from './ui/components/Topbar.svelte';
  import PadGrid from './ui/components/PadGrid.svelte';
  import Bottombar from './ui/components/Bottombar.svelte';
  import Drawer from './ui/components/Drawer.svelte';
  import LibraryPanel from './ui/components/LibraryPanel.svelte';

  let { app }: { app: App } = $props();
</script>

<div class="shell">
  <Topbar {app} />
  <main>
    <PadGrid {app} />
  </main>
  <Bottombar {app} />
</div>

<Drawer {app} />

{#if app.store.libraryOpen}
  <LibraryPanel {app} />
{/if}

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
  }

  main {
    flex: 1;
    overflow-y: auto;
    display: flex;
    align-items: safe center;
    justify-content: center;
    padding: 0.75rem;
  }
</style>
