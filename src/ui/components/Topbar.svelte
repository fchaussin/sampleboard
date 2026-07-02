<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Barre du haut (§11) : infos de la page active (tap → tiroir page), visualiseur global
     multi-voix, et Stop général contextuel (visible pendant la lecture, à côté des ondes). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { pagesSorted } from '../../domain/selectors';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';
  import TopbarWaveform from './TopbarWaveform.svelte';

  let { app }: { app: App } = $props();

  const locale = $derived(app.store.locale);
  const page = $derived(app.store.activePage);
  const editMode = $derived(app.store.editMode);
  const playing = $derived(app.store.activePadIds.size > 0);
  const pageNumber = $derived(
    page && app.store.bank ? pagesSorted(app.store.bank).findIndex((p) => p.id === page.id) + 1 : 0,
  );
</script>

{#if page}
  <header class="topbar">
    <button
      class="page-info"
      type="button"
      title={t('topbar.pageInfo', locale)}
      onclick={() => app.commands.openPageDrawer()}
    >
      <span class="name">{page.name || pageNumber}</span>
    </button>

    <TopbarWaveform {app} />

    {#if playing}
      <button
        class="stop"
        type="button"
        title={t('bottombar.stopAll', locale)}
        aria-label={t('bottombar.stopAll', locale)}
        onclick={() => app.commands.stopAllVoices()}
      >
        <Icon name="stop" size={18} />
      </button>
    {/if}

    <button
      class="page-badges"
      type="button"
      title={t('topbar.pageInfo', locale)}
      onclick={() => app.commands.openPageDrawer()}
    >
      {#if editMode}
        <span class="badge edit">{t('nav.edit', locale)}</span>
      {/if}
      <span class="badge">{t(`voice.${page.voiceMode}`, locale)}</span>
      <span class="badge">{page.rows}×{page.cols}</span>
    </button>
  </header>
{/if}

<style>
  .topbar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    min-height: 52px;
    padding: 0.35rem 0.6rem;
    padding-top: calc(0.35rem + env(safe-area-inset-top));
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }

  .page-info,
  .page-badges {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 44px;
    padding: 0.25rem 0.4rem;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    flex-shrink: 0;
  }

  .name {
    font-weight: 700;
    font-size: 1.05rem;
    max-width: 38vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    padding: 0.15rem 0.55rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 0.75rem;
    color: var(--muted);
  }

  .badge.edit {
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }

  /* Stop général contextuel, à côté du visualiseur (visible pendant la lecture). */
  .stop {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    min-height: 40px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: transparent;
    color: var(--danger);
    cursor: pointer;
    flex-shrink: 0;
  }
</style>
