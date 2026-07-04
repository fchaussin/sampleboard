<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Gestion des tags (M8, déplacée dans le TIROIR droit #20) : créer, renommer, supprimer.
     Ouverte depuis l'en-tête du panneau Bibliothèque — le tiroir passe AU-DESSUS du panneau
     (--z-drawer > --z-panel), la bibliothèque reste visible et se met à jour derrière. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { t } from '../i18n';

  let { app }: { app: App } = $props();

  const locale = $derived(app.store.locale);
  let newTagLabel = $state('');

  function addTag(event: SubmitEvent): void {
    event.preventDefault();
    app.commands.createTag(newTagLabel);
    newTagLabel = '';
  }
</script>

<!-- Ajout EN TÊTE : toujours accessible, jamais enfoui sous le défilement de la liste. -->
<form class="add-tag" onsubmit={addTag}>
  <input type="text" placeholder={t('tag.new', locale)} bind:value={newTagLabel} />
  <button type="submit">{t('tag.add', locale)}</button>
</form>

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

<style>
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
