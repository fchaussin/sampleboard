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

<!-- En Édition, la bibliothèque porte un LISERÉ violet SUBTIL (arbitrage 2026-07-05) :
     elle sert dans les deux modes, le violet signale seulement le contexte armé. -->
<section class="panel" class:editing={app.store.editMode} aria-label={t('library.title', locale)}>
  <header>
    <!-- Import ALIGNÉ À GAUCHE de l'en-tête du panneau (arbitrage 2026-07-05) — point
         d'entrée unique (la modale de choix des fichiers + progression). -->
    <button class="import" type="button" onclick={() => app.commands.openImport()}>
      <Icon name="import" size={16} />
      <span>{t('library.import', locale)}</span>
    </button>
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

  /* Import poussé à GAUCHE ; « Gérer les tags » + fermeture restent à droite. */
  .import {
    margin-right: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.25rem;
    padding: 0 0.8rem;
    border: 1px solid var(--accent);
    border-radius: 999rem;
    background: transparent;
    color: var(--accent);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
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

  /* Édition armée : liseré intérieur discret, même violet que pads/pool/icône du mode. */
  .panel.editing {
    box-shadow: inset 0 0 0 2px color-mix(in oklab, var(--c-violet) 45%, transparent);
  }
</style>
