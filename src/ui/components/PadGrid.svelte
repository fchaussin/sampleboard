<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Grille rows×cols de la page active ; place les pads par position, cases vides sinon. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { padsOfPage, padAtPosition } from '../../domain/selectors';
  import { gridCapacity } from '../../domain/invariants';
  import Pad from './Pad.svelte';

  let { app }: { app: App } = $props();

  const page = $derived(app.store.activePage);
  const pads = $derived(page && app.store.bank ? padsOfPage(app.store.bank, page.id) : []);
  const cells = $derived(page ? Array.from({ length: gridCapacity(page) }, (_, i) => i) : []);
</script>

{#if page}
  <div class="grid" style="--cols:{page.cols}; --rows:{page.rows}">
    {#each cells as position (position)}
      {@const p = padAtPosition(pads, position)}
      {#if p}
        <Pad {app} pad={p} />
      {:else}
        <div class="cell-empty" aria-hidden="true"></div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    grid-template-rows: repeat(var(--rows), 1fr);
    gap: 0.5rem;
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
  }

  .cell-empty {
    border: 1px dashed var(--muted);
    border-radius: 12px;
    opacity: 0.2;
    aspect-ratio: 1;
  }
</style>
