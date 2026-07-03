<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Modale de choix de sample (<dialog>, M6) : liste de la bibliothèque (méta + pré-écoute),
     option « aucun », et import direct — le sample importé est assigné dans la foulée. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { LibraryFilter } from '../../app/store.svelte';
  import { filterSamples } from '../../app/tag-filter';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';
  import PreviewButton from './PreviewButton.svelte';

  let {
    app,
    padId,
    open,
    onclose,
  }: {
    app: App;
    padId: string;
    open: boolean;
    onclose: () => void;
  } = $props();

  const locale = $derived(app.store.locale);
  // Combobox (#12) : recherche texte + filtre par tag, locaux à la modale.
  let search = $state('');
  let tagFilter = $state<LibraryFilter>(null);
  const samples = $derived(filterSamples(app.store.samples, app.store.sampleTags, tagFilter, search));
  const current = $derived(
    app.store.bank?.pads.find((p) => p.id === padId)?.sampleId ?? null,
  );

  let dialog: HTMLDialogElement;

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function choose(sampleId: string | null): void {
    app.commands.assignSample(padId, sampleId);
    onclose();
  }

  /** Filtrer peut masquer le sample en pré-écoute (et son bouton stop) → stop d'abord. */
  function setTagFilter(filter: LibraryFilter): void {
    app.commands.stopPreview();
    tagFilter = filter;
  }

  /** Import unifié : la modale d'import prend le relais, le pad sera assigné à la validation. */
  function openImport(): void {
    app.commands.openImport(padId);
    onclose();
  }
</script>

<dialog
  class="picker"
  bind:this={dialog}
  onclose={() => {
    app.commands.stopPreview(); // fermer la modale fait office de stop
    onclose();
  }}
  aria-label={t('picker.title', locale)}
>
  <header>
    <h2>{t('picker.title', locale)}</h2>
    <button class="close" type="button" aria-label={t('drawer.close', locale)} onclick={() => onclose()}>
      <Icon name="close" size={18} />
    </button>
  </header>

  <button class="import" type="button" onclick={openImport}>
    {t('library.import', locale)}
  </button>

  <!-- Recherche et filtre LOCAUX à la modale : la règle « toute action stoppe la
       pré-écoute » (§16) s'applique ici côté vue, comme dans Library. -->
  <input
    class="search"
    type="search"
    placeholder={t('picker.search', locale)}
    bind:value={search}
    oninput={() => app.commands.stopPreview()}
  />
  <div class="chip-row">
    <button class="chip" class:active={tagFilter === null} type="button" onclick={() => setTagFilter(null)}>
      {t('library.filter.all', locale)}
    </button>
    {#each app.store.tags as tag (tag.id)}
      <button class="chip" class:active={tagFilter === tag.id} type="button" onclick={() => setTagFilter(tag.id)}>
        {tag.label}
      </button>
    {/each}
    <button class="chip" class:active={tagFilter === 'untagged'} type="button" onclick={() => setTagFilter('untagged')}>
      {t('library.filter.untagged', locale)}
    </button>
  </div>

  <ul class="choices">
    <li>
      <button class="choice" class:current={current === null} type="button" onclick={() => choose(null)}>
        {t('editor.pad.sampleNone', locale)}
      </button>
    </li>
    {#each samples as s (s.id)}
      <li>
        <button class="choice" class:current={current === s.id} type="button" onclick={() => choose(s.id)}>
          {s.label}
        </button>
        <PreviewButton {app} sampleId={s.id} />
      </li>
    {/each}
  </ul>
</dialog>

<style>
  .picker {
    width: min(26.25rem, 92vw);
    max-height: 80dvh;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.875rem;
    background: var(--panel);
    color: var(--fg);
  }

  .picker::backdrop {
    background: rgb(0 0 0 / 55%);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
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

  .import {
    display: block;
    width: 100%;
    text-align: center;
    padding: 0.5rem;
    border: 1px dashed var(--accent);
    border-radius: 0.625rem;
    background: transparent;
    color: var(--accent);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    margin-bottom: 0.75rem;
  }

  /* Style .search mutualisé (app.css) — seul l'espacement est local. */
  .search {
    margin-bottom: 0.5rem;
  }

  .chip-row {
    margin-bottom: 0.6rem;
  }

  .choices {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    overflow-y: auto;
  }

  .choices li {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .choice {
    flex: 1;
    min-height: 2.625rem;
    padding: 0.4rem 0.7rem;
    text-align: left;
    border: 1px solid var(--border);
    border-radius: 0.625rem;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .choice.current {
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }

</style>
