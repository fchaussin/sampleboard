<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Bibliothèque en VUE du layout (#22, supersède le panneau plein écran §11) : rendue
     dans <main> à la place de la grille — topbar (titre de vue) et bottombar restent.
     L'en-tête se réduit à une barre d'outils : Gérer les tags + fermeture (retour board). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';
  import Library from './Library.svelte';

  let { app }: { app: App } = $props();
  const locale = $derived(app.store.locale);
</script>

<section class="panel" aria-label={t('library.title', locale)}>
  <header>
    <!-- Gestion des tags dans le TIROIR droit (#20). -->
    <button class="manage-tags" type="button" onclick={() => app.commands.openTagsDrawer()}>
      {t('library.manageTags', locale)}
    </button>
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
</section>

<style>
  /* Vue en FLUX dans <main> (#22) : remplit l'espace de la grille, aucune surcouche. */
  .panel {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.4rem;
    padding: 0.25rem 0.5rem;
  }

  .manage-tags {
    min-height: 2.25rem;
    padding: 0 0.7rem;
    border: 1px solid var(--border);
    border-radius: 999rem;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
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
