<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Bibliothèque (§11) : import, renommage, pré-écoute, suppression (avertit des pads impactés). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { ImportError } from '../../app/commands';
  import { filterSamples } from '../../app/tag-filter';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';
  import PreviewButton from './PreviewButton.svelte';

  let { app }: { app: App } = $props();
  const locale = $derived(app.store.locale);
  const tags = $derived(app.store.tags);
  const filter = $derived(app.store.libraryFilter);

  let error = $state<ImportError | null>(null);
  // Sample en attente de confirmation de suppression (impacte des pads).
  let confirming = $state<string | null>(null);

  // Recherche texte, locale au panneau (comme dans SamplePicker).
  let search = $state('');
  // Filtre M8 (tag ou « Non classé » virtuel) combiné à la recherche sur le label.
  const samples = $derived(filterSamples(app.store.samples, app.store.sampleTags, filter, search));

  /** Sortie de l'état « aucun résultat » : efface recherche ET filtre. */
  function resetFilters(): void {
    search = '';
    app.commands.setLibraryFilter(null);
  }

  /** Ligne dépliée (tags + assignation à la volée), ou null. */
  let expanded = $state<string | null>(null);

  function toggleExpanded(sampleId: string): void {
    app.commands.stopPreview(); // toute autre action fait office de stop
    expanded = expanded === sampleId ? null : sampleId;
  }

  function sampleHasTag(sampleId: string, tagId: string): boolean {
    return app.store.sampleTags.get(sampleId)?.has(tagId) ?? false;
  }


  function impactedPads(sampleId: string): number {
    return app.store.bank ? app.store.bank.pads.filter((p) => p.sampleId === sampleId).length : 0;
  }

  /** Méta affichées : taille (Mo) et durée (s), formatées selon la langue. */
  function meta(sizeBytes: number, durationMs: number | null): string {
    const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const size = `${nf.format(sizeBytes / 1_048_576)} ${t('unit.mb', locale)}`;
    if (durationMs === null) return size;
    return `${size} · ${nf.format(durationMs / 1000)} ${t('unit.seconds', locale)}`;
  }

  function requestDelete(sampleId: string): void {
    if (impactedPads(sampleId) > 0) {
      confirming = sampleId;
    } else {
      app.commands.deleteSample(sampleId);
    }
  }

  function confirmDelete(sampleId: string): void {
    app.commands.deleteSample(sampleId);
    confirming = null;
  }

  /** Retravail (M7) : rouvre le sample dans l'éditeur audio (« découper »). */
  async function rework(sampleId: string): Promise<void> {
    error = null;
    try {
      error = await app.commands.beginSampleRework(sampleId);
    } catch (err) {
      // Jamais d'échec muet : un imprévu s'affiche comme une erreur de lecture.
      console.error('découper: échec inattendu', err);
      error = 'readFailed';
    }
  }
</script>

<section class="library">
  <!-- Barre d'outils sticky : import, recherche et filtres restent visibles au défilement. -->
  <div class="toolbar">
    <div class="head">
      <!-- Point d'entrée UNIQUE de l'import : la modale (choix des fichiers + progression). -->
      <button class="import" type="button" onclick={() => app.commands.openImport()}>
        {t('library.import', locale)}
      </button>
      {#if error}
        <span class="error">{t(`library.error.${error}`, locale)}</span>
      {/if}
    </div>

    <input
      class="search"
      type="search"
      placeholder={t('library.search', locale)}
      aria-label={t('library.search', locale)}
      bind:value={search}
      oninput={() => app.commands.stopPreview()}
    />

    <div class="chip-row filters">
      <button class="chip" class:active={filter === null} type="button" onclick={() => app.commands.setLibraryFilter(null)}>
        {t('library.filter.all', locale)}
      </button>
      {#each tags as tag (tag.id)}
        <button class="chip" class:active={filter === tag.id} type="button" onclick={() => app.commands.setLibraryFilter(tag.id)}>
          {tag.label}
        </button>
      {/each}
      <button class="chip" class:active={filter === 'untagged'} type="button" onclick={() => app.commands.setLibraryFilter('untagged')}>
        {t('library.filter.untagged', locale)}
      </button>
    </div>
  </div>

  {#if app.store.samples.length === 0}
    <p class="empty">{t('library.empty', locale)}</p>
  {:else if samples.length === 0}
    <!-- Bibliothèque non vide mais recherche/filtre sans correspondance. -->
    <p class="empty">
      {t('library.noResults', locale)}
      <button class="chip" type="button" onclick={resetFilters}>{t('library.reset', locale)}</button>
    </p>
  {:else}
    <ul class="list">
      {#each samples as s (s.id)}
        <li>
          <span class="cell">
            <input
              class="label"
              type="text"
              value={s.label}
              oninput={(e) => app.commands.renameSample(s.id, e.currentTarget.value)}
            />
            <span class="meta">{meta(s.sizeBytes, s.durationMs)}</span>
          </span>
          <!-- Actions groupées : le bloc passe SOUS le nom quand la ligne est trop étroite. -->
          <div class="actions">
            <PreviewButton {app} sampleId={s.id} />
            <button type="button" class="icon-action rework" title={t('library.rework', locale)} aria-label={t('library.rework', locale)} onclick={() => rework(s.id)}>✂</button>
            <button
              type="button"
              class="icon-action assign-start"
              title={t('assign.start', locale)}
              aria-label={t('assign.start', locale)}
              onclick={() => app.commands.startAssigning(s.id)}
            ><Icon name="assign" size={16} /></button>
            <button
              type="button"
              class="icon-action pool-add"
              title={t('pool.add', locale)}
              aria-label={t('pool.add', locale)}
              disabled={app.store.poolSampleIds.includes(s.id)}
              onclick={() => app.commands.addToPool(s.id)}
            ><Icon name="pool" size={16} /></button>
            <button
              type="button"
              class="icon-action tags-toggle"
              class:active={expanded === s.id}
              title={t('library.tags', locale)}
              aria-label={t('library.tags', locale)}
              aria-expanded={expanded === s.id}
              onclick={() => toggleExpanded(s.id)}
            ><Icon name="tag" size={16} /></button>
            {#if confirming === s.id}
              <span class="confirm">
                {impactedPads(s.id)}
                {t('library.impacted', locale)}
                <button type="button" class="danger" onclick={() => confirmDelete(s.id)}>{t('library.confirm', locale)}</button>
                <button type="button" class="icon-action" onclick={() => (confirming = null)}>✕</button>
              </span>
            {:else}
              <button type="button" class="icon-action danger" title={t('library.delete', locale)} onclick={() => requestDelete(s.id)}>🗑</button>
            {/if}
          </div>
        </li>
        {#if expanded === s.id}
          <li class="expansion">
            <div class="chip-row">
              {#each tags as tag (tag.id)}
                <button
                  class="chip"
                  class:active={sampleHasTag(s.id, tag.id)}
                  type="button"
                  aria-pressed={sampleHasTag(s.id, tag.id)}
                  onclick={() => app.commands.toggleSampleTag(s.id, tag.id)}
                >
                  {tag.label}
                </button>
              {/each}
            </div>

          </li>
        {/if}
      {/each}
    </ul>
  {/if}

</section>

<style>
  .library {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 32.5rem;
    margin: 0 auto;
    width: 100%;
  }

  /* Colle au bord haut du conteneur scrollable (.content du panneau) ; la liste défile derrière. */
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-bottom: 0.25rem;
    background: var(--bg);
  }

  .head {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }

  .import {
    padding: 0.35rem 0.9rem;
    border: 1px solid var(--accent);
    border-radius: 0.5rem;
    background: transparent;
    color: var(--accent);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .error {
    color: var(--danger);
    font-size: 0.8rem;
  }

  .empty {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    text-align: center;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  li {
    display: flex;
    align-items: center;
    flex-wrap: wrap; /* les actions basculent sous le nom quand la ligne est trop étroite */
    gap: 0.4rem;
    font-size: 0.85rem;
  }

  .cell {
    flex: 1 1 10rem; /* base mini du nom : en deçà, .actions passe à la ligne */
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-left: auto; /* alignées à droite, y compris sur leur propre ligne */
  }

  .label {
    width: 100%;
    padding: 0.25rem 0.5rem;
    background: transparent;
    color: inherit;
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    font: inherit;
  }

  .meta {
    font-size: 0.72rem;
    color: var(--muted);
    padding-left: 0.5rem;
  }

  .confirm {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    color: var(--muted);
  }

  .danger {
    border-color: var(--danger);
    color: var(--danger);
  }

  .filters {
    justify-content: center;
  }

  .expansion {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--panel);
  }

  .assign-start {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* --- Adaptation au média --- */

  /* Écran large (tablette, paysage, desktop) : la liste devient une grille de cartes. */
  @media (min-width: 48rem) {
    .library {
      max-width: 64rem;
    }

    .list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
      align-items: start;
      gap: 0.4rem;
    }

    .list li {
      padding: 0.5rem;
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      background: var(--panel);
    }

    /* La ligne dépliée (tags) occupe toute la largeur de la grille. */
    .list .expansion {
      grid-column: 1 / -1;
    }
  }

</style>
