<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Bibliothèque (§11) : import, renommage, pré-écoute, suppression (avertit des pads impactés). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { ImportError } from '../../app/commands';
  import { filterSamples } from '../../app/tag-filter';
  import { importFile } from '../import-file';
  import { t } from '../i18n';

  let { app }: { app: App } = $props();
  const locale = $derived(app.store.locale);
  const tags = $derived(app.store.tags);
  const filter = $derived(app.store.libraryFilter);

  let busy = $state(false);
  let error = $state<ImportError | null>(null);
  // Sample en attente de confirmation de suppression (impacte des pads).
  let confirming = $state<string | null>(null);

  // Filtre M8 : tag sélectionné ou « Non classé » virtuel (samples sans tag).
  const samples = $derived(filterSamples(app.store.samples, app.store.sampleTags, filter));

  /** Ligne dépliée (tags + assignation à la volée), ou null. */
  let expanded = $state<string | null>(null);

  function toggleExpanded(sampleId: string): void {
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

  async function onImport(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    busy = true;
    error = null;
    error = await importFile(app, file);
    busy = false;
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
  <div class="head">
    <label class="import">
      <span>{busy ? t('library.importing', locale) : t('library.import', locale)}</span>
      <input type="file" accept="audio/*" onchange={onImport} disabled={busy} />
    </label>
    {#if error}
      <span class="error">{t(`library.error.${error}`, locale)}</span>
    {/if}
  </div>

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

  {#if samples.length === 0}
    <p class="empty">{t('library.empty', locale)}</p>
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
          <button type="button" class="icon" title={t('library.preview', locale)} onclick={() => app.commands.previewSample(s.id)}>▶</button>
          <button type="button" class="icon rework" title={t('library.rework', locale)} aria-label={t('library.rework', locale)} onclick={() => rework(s.id)}>✂</button>
          <button
            type="button"
            class="icon tags-toggle"
            class:active={expanded === s.id}
            title={t('library.tags', locale)}
            aria-label={t('library.tags', locale)}
            aria-expanded={expanded === s.id}
            onclick={() => toggleExpanded(s.id)}
          >🏷</button>
          {#if confirming === s.id}
            <span class="confirm">
              {impactedPads(s.id)}
              {t('library.impacted', locale)}
              <button type="button" class="danger" onclick={() => confirmDelete(s.id)}>{t('library.confirm', locale)}</button>
              <button type="button" class="icon" onclick={() => (confirming = null)}>✕</button>
            </span>
          {:else}
            <button type="button" class="icon danger" title={t('library.delete', locale)} onclick={() => requestDelete(s.id)}>🗑</button>
          {/if}
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
            <div class="actions">
              <button class="assign-start" type="button" onclick={() => app.commands.startAssigning(s.id)}>
                {t('assign.start', locale)}
              </button>
              <button
                class="pool-add"
                type="button"
                disabled={app.store.poolSampleIds.includes(s.id)}
                onclick={() => app.commands.addToPool(s.id)}
              >
                {t('pool.add', locale)}
              </button>
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

  .head {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }

  .import {
    cursor: pointer;
  }

  .import span {
    display: inline-block;
    padding: 0.35rem 0.9rem;
    border: 1px solid var(--accent);
    border-radius: 0.5rem;
    color: var(--accent);
    font-size: 0.85rem;
  }

  .import input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .error {
    color: var(--danger);
    font-size: 0.8rem;
  }

  .empty {
    margin: 0;
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
    gap: 0.4rem;
    font-size: 0.85rem;
  }

  .cell {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
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

  .icon {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--muted);
    border-radius: 0.375rem;
    background: transparent;
    color: inherit;
    cursor: pointer;
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

  .tags-toggle.active {
    border-color: var(--accent);
    color: var(--accent);
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

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .assign-start {
    align-self: start;
    min-height: 2.25rem;
    padding: 0 0.8rem;
    border: 1px solid var(--accent);
    border-radius: 0.375rem;
    background: var(--accent);
    color: var(--accent-contrast);
    font: inherit;
    cursor: pointer;
  }

  .pool-add {
    min-height: 2.25rem;
    padding: 0 0.8rem;
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .pool-add:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
