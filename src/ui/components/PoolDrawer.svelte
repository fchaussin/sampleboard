<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Pool (M8) : tiroir GAUCHE — liste de travail de samples. Toucher un élément l'ARME
     (assignation à la volée) ; le tiroir reste ouvert pendant qu'on touche les pads. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  let { app }: { app: App } = $props();

  const locale = $derived(app.store.locale);
  const armed = $derived(app.store.assigningSampleId);
  const items = $derived(
    app.store.poolSampleIds
      .map((id) => app.store.samples.find((s) => s.id === id))
      .filter((s) => s !== undefined),
  );

  function arm(sampleId: string): void {
    if (armed === sampleId) app.commands.stopAssigning();
    else app.commands.startAssigning(sampleId);
  }
</script>

<div class="pool" role="complementary" aria-label={t('pool.title', locale)}>
  <header>
    <h2>{t('pool.title', locale)}</h2>
    <button
      class="close"
      type="button"
      aria-label={t('drawer.close', locale)}
      onclick={() => app.commands.closePool()}
    >
      <Icon name="close" size={18} />
    </button>
  </header>

  {#if items.length === 0}
    <p class="empty">{t('pool.empty', locale)}</p>
  {:else}
    <p class="hint">{t('pool.hint', locale)}</p>
    <ul>
      {#each items as sample (sample.id)}
        <li>
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
  /* Tiroir GAUCHE, sans voile : les pads restent touchables pendant l'assignation. */
  .pool {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(15rem, 70vw);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    padding-top: calc(0.75rem + env(safe-area-inset-top));
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
    background: var(--panel);
    border-right: 1px solid var(--border);
    box-shadow: 0.75rem 0 2rem rgb(0 0 0 / 35%);
    z-index: var(--z-drawer);
    overflow-y: auto;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: 1rem;
  }

  .close {
    display: inline-flex;
    min-width: 2.5rem;
    min-height: 2.5rem;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
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
