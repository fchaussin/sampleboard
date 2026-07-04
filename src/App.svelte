<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Agencement v1 (§11) : Topbar (infos page) / vue courante dans main / Bottombar (actions),
     tiroir contextuel à droite. La vue de <main> est une PROJECTION de l'URL (#23). -->
<script lang="ts">
  import type { Component } from 'svelte';
  import type { App } from './app/create-app';
  import type { ViewId } from './app/navigation';
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

  // Table vue → composant (#23) : structure de données, pas de branchements — la résolution
  // URL → vue et la synchronisation vivent dans app/navigation.ts + app/router.ts.
  const views: Record<ViewId, Component<{ app: App }>> = {
    board: PadGrid,
    library: LibraryPanel,
  };
  const View = $derived(views[app.store.view]);
</script>

<div class="shell">
  <Topbar {app} />
  <div class="body">
    <!-- Pool (#18) : Édition seulement — sidebar systématique en large (y compris à côté
         de la bibliothèque : le glisser ligne → pool se fait en flux), tiroir en étroit. -->
    {#if poolVisible}
      <PoolDrawer {app} overlay={!wide} closable={!wide} />
    {/if}
    <main>
      <!-- Rendu dynamique de la vue résolue (#22/#23) : bibliothèque ou grille remplacent
           le contenu, topbar et bottombar restent en place (Stop, bascule de mode, pages). -->
      <View {app} />
    </main>
  </div>
  <Bottombar {app} />
</div>

<Drawer {app} />

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
