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
  import AudioEditor from './ui/components/AudioEditor.svelte';
  import AssignBanner from './ui/components/AssignBanner.svelte';

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

{#if app.store.assigningSampleId}
  <AssignBanner {app} />
{/if}

{#if app.store.audioEditor}
  {#key app.store.audioEditor}
    <AudioEditor {app} editor={app.store.audioEditor} />
  {/key}
{/if}

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
  }

  /* La grille occupe TOUT l'espace disponible (full adaptatif, décision M6). */
  main {
    flex: 1;
    min-height: 0;
    display: flex;
    padding: 0.5rem;
  }
</style>
