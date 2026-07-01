<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Navigation entre pages (M2 : sélection seule ; ajout/renommage/grille arrivent au M3). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { pagesSorted } from '../../domain/selectors';

  let { app }: { app: App } = $props();

  const pages = $derived(app.store.bank ? pagesSorted(app.store.bank) : []);
  const activeId = $derived(app.store.activePageId);
  const editMode = $derived(app.store.editMode);
</script>

<nav class="tabs">
  {#each pages as page, i (page.id)}
    <button
      class="tab"
      class:active={page.id === activeId}
      type="button"
      onclick={() => app.commands.setActivePage(page.id)}
    >
      {page.name || i + 1}
    </button>
  {/each}
  {#if editMode}
    <button class="tab add" type="button" aria-label="add-page" onclick={() => app.commands.addPage()}>
      +
    </button>
  {/if}
</nav>

<style>
  .tabs {
    display: flex;
    gap: 0.4rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .tab {
    padding: 0.35rem 0.9rem;
    border: 1px solid var(--muted);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .tab.active {
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }
</style>
