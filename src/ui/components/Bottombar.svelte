<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Barre d'actions (§11) : icône Édition, pages (défilables, ajout en Édition), Import
     rapide, Bibliothèque, Réglages. Le Stop général vit en topbar (arbitrage 2026-07-05). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { pagesSorted } from '../../domain/selectors';
  import { attachDragScroll } from '../interaction/drag-scroll';
  import { tintStyle } from '../tint';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  let { app }: { app: App } = $props();

  const locale = $derived(app.store.locale);
  const editMode = $derived(app.store.editMode);
  const pages = $derived(app.store.bank ? pagesSorted(app.store.bank) : []);
  const activeId = $derived(app.store.activePageId);

  /* La piste défile masquée : à la souris elle se fait GLISSER (le tactile panne nativement). */
  function dragScroll(node: HTMLElement) {
    return { destroy: attachDragScroll(node) };
  }
</script>

<nav class="bottombar">
  <!-- Icône UNIQUE d'Édition (arbitrage 2026-07-05, remplace le toggle segmenté) : neutre
       au repos (c'est le bouton d'ENTRÉE, pas un disabled), VIOLET plein quand le mode est
       armé — même code couleur que les pads/pool/bibliothèque en Édition. Re-tap = Jeu. -->
  <button
    class="mode-toggle"
    class:armed={editMode}
    type="button"
    role="switch"
    aria-checked={editMode}
    title={editMode ? t('nav.play', locale) : t('nav.edit', locale)}
    aria-label={t('nav.edit', locale)}
    onclick={() => app.commands.toggleEditMode()}
  >
    <Icon name="edit" size={18} />
  </button>

  <!-- Pool (#18) : outil d'ÉDITION, collé à la bascule — son tiroir s'ouvre à GAUCHE.
       Bouton du tiroir en écran étroit seulement : en large, la sidebar est systématique
       (voir App.svelte). -->
  {#if editMode}
    <button
      class="action open-pool"
      type="button"
      title={t('pool.title', locale)}
      aria-label={t('pool.title', locale)}
      onclick={() => (app.store.poolOpen ? app.commands.closePool() : app.commands.openPool())}
    >
      <Icon name="pool" />
    </button>
  {/if}

  <!-- Le Stop général vit DÉSORMAIS en topbar, à droite du visualiseur (arbitrage 2026-07-05). -->

  <div class="pages" role="tablist" use:dragScroll>
    {#each pages as page, i (page.id)}
      <button
        class="tab"
        class:active={page.id === activeId}
        class:tinted={!!page.color}
        type="button"
        role="tab"
        aria-selected={page.id === activeId}
        style={tintStyle(page.color)}
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

  <!-- Ouvre la MODALE d'import (choix des fichiers + progression), pas le sélecteur OS. -->
  <button
    class="action import"
    type="button"
    title={t('bottombar.import', locale)}
    aria-label={t('bottombar.import', locale)}
    onclick={() => app.commands.openImport()}
  >
    <Icon name="import" />
  </button>

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
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0;
    border: none;
    border-radius: 0.75rem;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    flex-shrink: 0;
  }

  /* Écran large (#18) : la sidebar pool est systématique en Édition — pas de bouton. */
  @media (min-width: 48rem) {
    .open-pool {
      display: none;
    }
  }

  .action:active {
    background: var(--border);
  }

  /* Icône unique d'Édition : compacte (une case d'action), violet plein quand armée. */
  .mode-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
  }

  .mode-toggle.armed {
    background: var(--c-violet);
    border-color: var(--c-violet);
    color: var(--fg);
  }

  .pages {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex: 1;
    /* Indispensable : sans min-width:0, un enfant flex ne rétrécit pas sous son contenu —
       la piste pousserait les actions hors écran au lieu de défiler. */
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 0 0.2rem;
    /* Tactile : pan horizontal natif ; souris/stylet : glisser-pour-panner (drag-scroll). */
    touch-action: pan-x;
    cursor: grab;
  }

  .pages::-webkit-scrollbar {
    display: none;
  }

  .tab {
    min-width: 2.5rem;
    max-width: 8rem; /* un nom long n'avale pas la piste : ellipse */
    min-height: 2.5rem;
    padding: 0 0.7rem;
    border: 1px solid var(--border);
    border-radius: 999rem;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .tab.tinted {
    border-color: var(--tint);
    color: var(--tint);
  }

  .tab.active {
    border-color: var(--tint, var(--accent));
    background: var(--tint, var(--accent));
    color: var(--accent-contrast);
    font-weight: 700;
  }

  /* Écrans étroits : DEUX rangées — la piste des pages prend une rangée pleine largeur
     au-dessus des actions (sinon elle serait écrasée à quelques pixels). */
  @media (max-width: 30rem) {
    .bottombar {
      flex-wrap: wrap;
      gap: 0.3rem 0.2rem;
      padding: 0.4rem 0.4rem calc(0.4rem + env(safe-area-inset-bottom));
    }

    .pages {
      order: -1;
      flex-basis: 100%;
    }

    .action {
      min-width: 2.5rem;
      min-height: 2.5rem;
    }

    .tab {
      padding: 0 0.5rem;
      max-width: 6rem;
    }

    /* Actions réparties sur toute la largeur de leur rangée : l'espace se creuse APRÈS
       le groupe d'Édition de gauche (icône + pool #18), avant l'import. */
    .import {
      margin-left: auto;
    }
  }
</style>
