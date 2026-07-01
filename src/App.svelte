<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import type { App } from './app/create-app';
  import { t } from './ui/i18n';
  import PageTabs from './ui/components/PageTabs.svelte';
  import PadGrid from './ui/components/PadGrid.svelte';
  import Editor from './ui/components/Editor.svelte';
  import DevLibrary from './ui/dev/DevLibrary.svelte';

  let { app }: { app: App } = $props();

  const locale = $derived(app.store.locale);
  const editMode = $derived(app.store.editMode);
</script>

<main>
  <header>
    <h1>{t('app.name', locale)}</h1>
    <button class="mode-toggle" class:on={editMode} type="button" onclick={() => app.commands.toggleEditMode()}>
      {editMode ? t('nav.play', locale) : t('nav.edit', locale)}
    </button>
  </header>

  <DevLibrary {app} />
  <PageTabs {app} />
  {#if editMode}
    <Editor {app} />
  {/if}
  <PadGrid {app} />
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 100vh;
    padding: 1.5rem;
    box-sizing: border-box;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  h1 {
    margin: 0;
    font-size: 1.6rem;
    letter-spacing: 0.02em;
  }

  .mode-toggle {
    padding: 0.35rem 0.9rem;
    border: 1px solid var(--accent);
    border-radius: 999px;
    background: transparent;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
  }

  .mode-toggle.on {
    background: var(--accent);
    color: #101014;
  }
</style>
