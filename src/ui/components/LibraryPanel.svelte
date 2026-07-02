<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Bibliothèque en panneau PLEIN ÉCRAN (§11) : en-tête + contenu Library. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';
  import Library from './Library.svelte';

  let { app }: { app: App } = $props();
  const locale = $derived(app.store.locale);
</script>

<div class="panel" role="dialog" aria-label={t('library.title', locale)}>
  <header>
    <h2>{t('library.title', locale)}</h2>
    <button
      class="close close-library"
      type="button"
      aria-label={t('library.close', locale)}
      onclick={() => app.commands.closeLibrary()}
    >
      <Icon name="close" />
    </button>
  </header>
  <div class="content">
    <Library {app} />
  </div>
</div>

<style>
  .panel {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    z-index: var(--z-panel);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    padding-top: calc(0.75rem + env(safe-area-inset-top));
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }

  h2 {
    margin: 0;
    font-size: 1rem;
  }

  .close {
    display: inline-flex;
    min-width: 2.75rem;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 0.625rem;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  }
</style>
