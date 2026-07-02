<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Bibliothèque (§11) : import, renommage, pré-écoute, suppression (avertit des pads impactés). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { ImportError } from '../../app/commands';
  import { importFile } from '../import-file';
  import { t } from '../i18n';

  let { app }: { app: App } = $props();
  const locale = $derived(app.store.locale);

  let busy = $state(false);
  let error = $state<ImportError | null>(null);
  // Sample en attente de confirmation de suppression (impacte des pads).
  let confirming = $state<string | null>(null);

  const samples = $derived(app.store.samples);

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
    error = await app.commands.beginSampleRework(sampleId);
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
      {/each}
    </ul>
  {/if}
</section>

<style>
  .library {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 520px;
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
    border-radius: 8px;
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
    border-radius: 6px;
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
    border-radius: 6px;
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
</style>
