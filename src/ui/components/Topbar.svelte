<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Barre du haut (§11) : infos de la page active — tap → tiroir page. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { pagesSorted } from '../../domain/selectors';
  import { t } from '../i18n';

  let { app }: { app: App } = $props();

  const locale = $derived(app.store.locale);
  const page = $derived(app.store.activePage);
  const editMode = $derived(app.store.editMode);
  const pageNumber = $derived(
    page && app.store.bank ? pagesSorted(app.store.bank).findIndex((p) => p.id === page.id) + 1 : 0,
  );
</script>

{#if page}
  <button
    class="topbar"
    type="button"
    title={t('topbar.pageInfo', locale)}
    onclick={() => app.commands.openPageDrawer()}
  >
    <span class="name">{page.name || pageNumber}</span>
    <span class="badges">
      {#if editMode}
        <span class="badge edit">{t('nav.edit', locale)}</span>
      {/if}
      <span class="badge">{t(`voice.${page.voiceMode}`, locale)}</span>
      <span class="badge">{page.rows}×{page.cols}</span>
    </span>
  </button>
{/if}

<style>
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-height: 52px;
    padding: 0.5rem 1rem;
    padding-top: calc(0.5rem + env(safe-area-inset-top));
    border: none;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
    color: inherit;
    font: inherit;
    cursor: pointer;
    text-align: left;
  }

  .name {
    font-weight: 700;
    font-size: 1.05rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badges {
    display: flex;
    gap: 0.4rem;
    flex-shrink: 0;
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
</style>
