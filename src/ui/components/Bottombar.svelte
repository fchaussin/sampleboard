<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Barre d'actions (§11) : Jeu ↔ Édition, Stop général, pages (défilables, ajout en
     Édition), Import rapide, Bibliothèque, Réglages généraux. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { ImportError } from '../../app/commands';
  import { pagesSorted } from '../../domain/selectors';
  import { importFile } from '../import-file';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  let { app }: { app: App } = $props();

  const locale = $derived(app.store.locale);
  const editMode = $derived(app.store.editMode);
  const pages = $derived(app.store.bank ? pagesSorted(app.store.bank) : []);
  const activeId = $derived(app.store.activePageId);

  let importing = $state(false);
  let importError = $state<ImportError | null>(null);

  async function onQuickImport(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    importing = true;
    importError = null;
    importError = await importFile(app, file);
    importing = false;
  }
</script>

{#if importError}
  <div class="snackbar" role="alert">
    <span>{t(`library.error.${importError}`, locale)}</span>
    <button type="button" aria-label={t('drawer.close', locale)} onclick={() => (importError = null)}>
      <Icon name="close" size={16} />
    </button>
  </div>
{/if}

<nav class="bottombar">
  <button
    class="action mode-toggle"
    class:on={editMode}
    type="button"
    title={editMode ? t('nav.play', locale) : t('nav.edit', locale)}
    aria-label={editMode ? t('nav.play', locale) : t('nav.edit', locale)}
    onclick={() => app.commands.toggleEditMode()}
  >
    <Icon name="edit" />
  </button>

  <button
    class="action stop"
    type="button"
    title={t('bottombar.stopAll', locale)}
    aria-label={t('bottombar.stopAll', locale)}
    onclick={() => app.commands.stopAllVoices()}
  >
    <Icon name="stop" />
  </button>

  <div class="pages" role="tablist">
    {#each pages as page, i (page.id)}
      <button
        class="tab"
        class:active={page.id === activeId}
        type="button"
        role="tab"
        aria-selected={page.id === activeId}
        onclick={() => app.commands.setActivePage(page.id)}
      >
        {page.name || i + 1}
      </button>
    {/each}
    {#if editMode}
      <button
        class="tab add"
        type="button"
        title={t('bottombar.addPage', locale)}
        aria-label={t('bottombar.addPage', locale)}
        onclick={() => app.commands.addPage()}
      >
        <Icon name="plus" size={16} />
      </button>
    {/if}
  </div>

  <label class="action import" class:busy={importing} title={t('bottombar.import', locale)}>
    <Icon name="import" />
    <input type="file" accept="audio/*" onchange={onQuickImport} disabled={importing} />
  </label>

  <button
    class="action open-library"
    type="button"
    title={t('bottombar.library', locale)}
    aria-label={t('bottombar.library', locale)}
    onclick={() => app.commands.openLibrary()}
  >
    <Icon name="library" />
  </button>

  <button
    class="action open-settings"
    type="button"
    title={t('settings.title', locale)}
    aria-label={t('settings.title', locale)}
    onclick={() => app.commands.openSettingsDrawer()}
  >
    <Icon name="settings" />
  </button>
</nav>

<style>
  .bottombar {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
    border-top: 1px solid var(--border);
    background: var(--panel);
  }

  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    flex-shrink: 0;
  }

  .action:active {
    background: var(--border);
  }

  .mode-toggle.on {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .stop:active {
    color: var(--danger);
  }

  .pages {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 0 0.2rem;
  }

  .pages::-webkit-scrollbar {
    display: none;
  }

  .tab {
    min-width: 40px;
    min-height: 40px;
    padding: 0 0.7rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .tab.active {
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 700;
  }

  .import {
    position: relative;
  }

  .import input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .import.busy {
    opacity: 0.4;
    pointer-events: none;
  }

  .snackbar {
    position: fixed;
    left: 50%;
    bottom: calc(76px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.9rem;
    border: 1px solid var(--danger);
    border-radius: 10px;
    background: var(--panel);
    color: var(--danger);
    font-size: 0.85rem;
    z-index: 30;
  }

  .snackbar button {
    display: inline-flex;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 0.2rem;
  }
</style>
