<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Barre d'actions (§11) : Jeu ↔ Édition, Stop général, pages (défilables, ajout en
     Édition), Import rapide, Bibliothèque, Réglages généraux. -->
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
  <!-- Toggle segmenté Jeu ↔ Édition : les DEUX options visibles, curseur glissant sur l'active. -->
  <button
    class="mode-toggle"
    type="button"
    role="switch"
    aria-checked={editMode}
    title={editMode ? t('nav.play', locale) : t('nav.edit', locale)}
    aria-label={t('nav.edit', locale)}
    onclick={() => app.commands.toggleEditMode()}
  >
    <span class="knob" class:right={editMode}></span>
    <span class="seg" class:active={!editMode}><Icon name="play" size={16} /></span>
    <span class="seg" class:active={editMode}><Icon name="edit" size={16} /></span>
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
    class="action open-pool"
    type="button"
    title={t('pool.title', locale)}
    aria-label={t('pool.title', locale)}
    onclick={() => (app.store.poolOpen ? app.commands.closePool() : app.commands.openPool())}
  >
    <Icon name="pool" />
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

  .action:active {
    background: var(--border);
  }

  /* Toggle segmenté : curseur (knob) glissant sous le segment actif ; le segment INACTIF
     reste lisible (pastille blanche translucide, effet grisé) ; contour marqué. */
  .mode-toggle {
    position: relative;
    display: inline-flex;
    align-items: stretch;
    gap: 0.25rem;
    min-height: 2.75rem;
    padding: 0.25rem;
    border: 1px solid var(--muted);
    border-radius: 999rem;
    background: var(--bg);
    cursor: pointer;
    flex-shrink: 0;
  }

  .mode-toggle .seg {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.375rem;
    border-radius: 999rem;
    background: rgb(255 255 255 / 10%);
    color: var(--muted);
    transition: color 0.15s ease, background 0.15s ease;
  }

  .mode-toggle .seg.active {
    background: transparent; /* le knob accentué prend le relais */
    color: var(--accent-contrast);
  }

  .mode-toggle .knob {
    position: absolute;
    top: 0.25rem;
    bottom: 0.25rem;
    left: 0.25rem;
    width: 2.375rem;
    border-radius: 999rem;
    background: var(--accent);
    transition: transform 0.18s ease;
  }

  .mode-toggle .knob.right {
    transform: translateX(2.625rem); /* largeur du segment + l'écart */
  }

  .stop:active {
    color: var(--danger);
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

    /* Actions réparties sur toute la largeur de leur rangée. */
    .mode-toggle {
      margin-right: auto;
    }
  }
</style>
