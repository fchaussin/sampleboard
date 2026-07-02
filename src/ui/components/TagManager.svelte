<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Gestion des tags (M8) : modale <dialog> standard ouverte depuis l'en-tête du panneau
     Bibliothèque — créer, renommer, supprimer. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  let { app, open, onclose }: { app: App; open: boolean; onclose: () => void } = $props();

  const locale = $derived(app.store.locale);
  let dialog: HTMLDialogElement;
  let newTagLabel = $state('');

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function addTag(event: SubmitEvent): void {
    event.preventDefault();
    app.commands.createTag(newTagLabel);
    newTagLabel = '';
  }
</script>

<dialog class="tag-manager" bind:this={dialog} onclose={() => onclose()} aria-label={t('library.manageTags', locale)}>
  <header>
    <h2>{t('library.manageTags', locale)}</h2>
    <button class="close" type="button" aria-label={t('drawer.close', locale)} onclick={() => onclose()}>
      <Icon name="close" size={18} />
    </button>
  </header>

  <ul class="tag-list">
    {#each app.store.tags as tag (tag.id)}
      <li>
        <input
          type="text"
          value={tag.label}
          onchange={(e) => app.commands.renameTag(tag.id, e.currentTarget.value)}
        />
        <button
          type="button"
          class="delete"
          title={t('tag.delete', locale)}
          aria-label={t('tag.delete', locale)}
          onclick={() => app.commands.deleteTag(tag.id)}
        >🗑</button>
      </li>
    {/each}
  </ul>

  <form class="add-tag" onsubmit={addTag}>
    <input type="text" placeholder={t('tag.new', locale)} bind:value={newTagLabel} />
    <button type="submit">{t('tag.add', locale)}</button>
  </form>
</dialog>

<style>
  .tag-manager {
    width: min(24rem, 92vw);
    max-height: 80dvh;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.875rem;
    background: var(--panel);
    color: var(--fg);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .tag-manager:not([open]) {
    display: none;
  }

  .tag-manager::backdrop {
    background: rgb(0 0 0 / 55%);
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
    padding: 0.4rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .tag-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    overflow-y: auto;
  }

  .tag-list li,
  .add-tag {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 0.35rem 0.5rem;
    background: var(--bg);
    color: inherit;
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    font: inherit;
  }

  .delete {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--danger);
    border-radius: 0.375rem;
    background: transparent;
    color: var(--danger);
    cursor: pointer;
  }

  .add-tag button {
    min-height: 2.25rem;
    padding: 0 0.8rem;
    border: 1px solid var(--accent);
    border-radius: 0.375rem;
    background: var(--accent);
    color: var(--accent-contrast);
    font: inherit;
    cursor: pointer;
  }
</style>
