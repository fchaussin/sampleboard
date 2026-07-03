<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Pool (M8, revu #18) : liste de travail de samples, disponible en Édition SEULEMENT.
     Sidebar SYSTÉMATIQUE en flux sur écran large (ni bouton ni fermeture) ; tiroir
     par-dessus (`overlay`) en étroit — refermable (`closable`) — ou quand la bibliothèque
     est ouverte, pour y déposer des lignes glissées. Toucher un élément l'ARME
     (assignation à la volée) ; un élément se glisse aussi directement sur un pad. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { t } from '../i18n';
  import { carriesSample, droppedSampleId, setSampleDrag } from '../interaction/sample-dnd';
  import Icon from './Icon.svelte';

  let {
    app,
    overlay = false,
    closable = false,
  }: { app: App; overlay?: boolean; closable?: boolean } = $props();

  const locale = $derived(app.store.locale);
  const armed = $derived(app.store.assigningSampleId);
  const items = $derived(
    app.store.poolSampleIds
      .map((id) => app.store.samples.find((s) => s.id === id))
      .filter((s) => s !== undefined),
  );

  let dropping = $state(false);

  function arm(sampleId: string): void {
    if (armed === sampleId) app.commands.stopAssigning();
    else app.commands.startAssigning(sampleId);
  }

  function onDragOver(e: DragEvent): void {
    if (!carriesSample(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    dropping = true;
  }

  function onDrop(e: DragEvent): void {
    dropping = false;
    const id = droppedSampleId(e);
    if (id === null) return;
    e.preventDefault();
    app.commands.addToPool(id);
  }
</script>

<div
  class="pool"
  class:overlay
  class:dropping
  role="complementary"
  aria-label={t('pool.title', locale)}
  ondragover={onDragOver}
  ondragleave={() => (dropping = false)}
  ondrop={onDrop}
>
  <header>
    <h2>{t('pool.title', locale)}</h2>
    <button
      class="icon-action add"
      type="button"
      title={t('pool.addSamples', locale)}
      aria-label={t('pool.addSamples', locale)}
      onclick={() => app.commands.openLibrary()}
    >
      <Icon name="plus" size={16} />
    </button>
    <button
      class="icon-action clear"
      type="button"
      title={t('pool.clear', locale)}
      aria-label={t('pool.clear', locale)}
      disabled={items.length === 0}
      onclick={() => app.commands.clearPool()}
    >🗑</button>
    {#if closable}
      <button
        class="icon-action close"
        type="button"
        aria-label={t('drawer.close', locale)}
        onclick={() => app.commands.closePool()}
      >
        <Icon name="close" size={18} />
      </button>
    {/if}
  </header>

  {#if items.length === 0}
    <p class="empty">{t('pool.empty', locale)}</p>
  {:else}
    <p class="hint">{t('pool.hint', locale)}</p>
    <ul>
      {#each items as sample (sample.id)}
        <li draggable="true" ondragstart={(e) => setSampleDrag(e, sample.id)}>
          <button
            class="item"
            class:armed={armed === sample.id}
            type="button"
            aria-pressed={armed === sample.id}
            onclick={() => arm(sample.id)}
          >
            {sample.label}
          </button>
          <button
            class="remove"
            type="button"
            title={t('pool.remove', locale)}
            aria-label={t('pool.remove', locale)}
            onclick={() => app.commands.removeFromPool(sample.id)}
          >
            <Icon name="close" size={14} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  /* Défaut : SIDEBAR en flux (dans .body), la grille se resserre à côté. */
  .pool {
    flex-shrink: 0;
    width: min(15rem, 70vw);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--panel);
    border-right: 1px solid var(--border);
    overflow-y: auto;
  }

  /* Tiroir (`overlay`, écran étroit ou bibliothèque ouverte) : GAUCHE fixé, sans voile —
     les pads restent touchables pendant l'assignation, et il flotte AU-DESSUS de la
     bibliothèque ouverte pour recevoir ses lignes glissées (--z-pool). */
  .pool.overlay {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    padding-top: calc(0.75rem + env(safe-area-inset-top));
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
    box-shadow: 0.75rem 0 2rem rgb(0 0 0 / 35%);
    z-index: var(--z-pool);
  }

  /* Zone de dépôt active : liseré accentué pendant le survol d'un glissement. */
  .pool.dropping {
    outline: 2px dashed var(--accent);
    outline-offset: -0.375rem;
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  h2 {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 1rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty,
  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 0.8rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .item {
    flex: 1;
    min-width: 0;
    min-height: 2.5rem;
    padding: 0.3rem 0.6rem;
    text-align: left;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item.armed {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 600;
  }

  .remove {
    display: inline-flex;
    min-width: 2rem;
    min-height: 2rem;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
</style>
