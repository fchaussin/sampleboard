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
  import ImportModal from './ui/components/ImportModal.svelte';
  import AssignBanner from './ui/components/AssignBanner.svelte';
  import PoolDrawer from './ui/components/PoolDrawer.svelte';

  let { app }: { app: App } = $props();

  // Écran large (#18) : la sidebar pool est SYSTÉMATIQUE en Édition — pas de bouton, pas
  // d'état d'ouverture. En étroit, le pool redevient un tiroir piloté par poolOpen.
  const wideQuery = window.matchMedia('(min-width: 48rem)');
  let wide = $state(wideQuery.matches);
  wideQuery.addEventListener('change', (e) => (wide = e.matches));

  const poolVisible = $derived(app.store.editMode && (wide || app.store.poolOpen));
  // Tiroir flottant : écran étroit, ou bibliothèque ouverte (le pool flotte AU-DESSUS
  // pour recevoir les lignes glissées) ; sinon sidebar en flux.
  const poolOverlay = $derived(!wide || app.store.libraryOpen);
</script>

<div class="shell">
  <Topbar {app} />
  <div class="body">
    <!-- Pool (#18) : Édition seulement — sidebar systématique en large, tiroir en étroit. -->
    {#if poolVisible}
      <PoolDrawer {app} overlay={poolOverlay} closable={!wide} />
    {/if}
    <main>
      <PadGrid {app} />
    </main>
  </div>
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

{#if app.store.importOpen || app.store.batchImport}
  <ImportModal {app} />
{/if}

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
  }

  /* Corps : rangée sidebar pool + grille (le pool en flux ne masque jamais les pads). */
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  /* La grille occupe TOUT l'espace disponible (full adaptatif, décision M6). */
  main {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    padding: 0.5rem;
  }
</style>
