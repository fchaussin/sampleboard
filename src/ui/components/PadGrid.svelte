<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Grille rows×cols de la page active. En Édition, les cases vides permettent d'ajouter un pad. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { padsOfPage, padAtPosition } from '../../domain/selectors';
  import { gridCapacity } from '../../domain/invariants';
  import Pad from './Pad.svelte';

  let { app }: { app: App } = $props();

  const page = $derived(app.store.activePage);
  const editMode = $derived(app.store.editMode);
  const pads = $derived(page && app.store.bank ? padsOfPage(app.store.bank, page.id) : []);
  const cells = $derived(page ? Array.from({ length: gridCapacity(page) }, (_, i) => i) : []);
</script>

{#if page}
  <div class="grid" style="--cols:{page.cols}; --rows:{page.rows}">
    {#each cells as position (position)}
      {@const p = padAtPosition(pads, position)}
      {#if p}
        <Pad {app} pad={p} />
      {:else if editMode}
        <button
          class="cell-add"
          type="button"
          aria-label="add"
          onclick={() => app.commands.addPad(page.id, position)}
        >
          +
        </button>
      {:else}
        <div class="cell-empty" aria-hidden="true"></div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  /* Full adaptatif (décision M6) : la grille remplit main, les cases se partagent 1fr. */
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    grid-template-rows: repeat(var(--rows), 1fr);
    gap: 0.5rem;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .cell-empty {
    border: 1px dashed var(--muted);
    border-radius: 0.75rem;
    opacity: 0.2;
  }

  .cell-add {
    border: 1px dashed var(--accent);
    border-radius: 0.75rem;
    background: transparent;
    color: var(--accent);
    font-size: 1.4rem;
    cursor: pointer;
    opacity: 0.6;
  }

  .cell-add:hover {
    opacity: 1;
  }
</style>
