<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Modale d'import (M8) : état « choix des fichiers » (bouton bottombar), puis progression
     du lot au même endroit — barre globale, statut par fichier (les entrées d'archives
     s'ajoutent au fil de l'expansion), interruption pendant le lot, fermeture une fois
     terminé. UN fichier audio → l'éditeur audio prend le relais (flux M7) et la modale se
     referme. Montée tant que store.importOpen ou store.batchImport (voir App.svelte). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { ImportError } from '../../app/commands';
  import { IMPORT_ACCEPT, importFiles } from '../import-file';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  let { app }: { app: App } = $props();

  const locale = $derived(app.store.locale);
  const batch = $derived(app.store.batchImport);
  /** Pad à assigner à l'issue du flux (modale ouverte depuis le choix de sample), ou null. */
  const assignPadId = $derived(app.store.importAssignPadId);
  const total = $derived(batch?.items.length ?? 0);
  const settled = $derived(batch?.settled ?? 0);
  const failed = $derived(batch?.items.filter((i) => i.status === 'failed').length ?? 0);

  let busy = $state(false);
  let error = $state<ImportError | null>(null);
  /** Option : chaque sample importé rejoint le pool (lot ET fichier unique via l'éditeur). */
  let addToPool = $state(false);

  let dialog: HTMLDialogElement;

  $effect(() => {
    if (!dialog.open) dialog.showModal();
  });

  async function onPick(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;
    busy = true;
    error = null;
    error = await importFiles(app, files, assignPadId, addToPool);
    busy = false;
    // Fichier audio unique : l'éditeur (top-layer) prend le relais, la modale n'a plus d'objet.
    if (error === null && app.store.audioEditor) app.commands.closeImport();
  }

  function close(): void {
    if (batch) app.commands.closeBatchImport();
    else app.commands.closeImport();
  }

  /** Échap : ignoré tant qu'un lot tourne (l'interruption est un bouton explicite). */
  function onCancelKey(event: Event): void {
    event.preventDefault();
    if (!batch || batch.finished) close();
  }
</script>

<dialog bind:this={dialog} class="import-modal" oncancel={onCancelKey}>
  <header>
    <h2>{t('importBatch.title', locale)}</h2>
    {#if batch}
      <span class="count">{settled}/{total}</span>
    {/if}
  </header>

  {#if batch}
    <progress max={total} value={settled}></progress>

    {#if batch.finished}
      <p class="outcome" class:cancelled={batch.cancelled}>
        {batch.cancelled ? t('importBatch.cancelled', locale) : t('importBatch.done', locale)}
        {#if failed > 0}
          — {failed} {t('importBatch.failures', locale)}
        {/if}
      </p>
    {/if}

    <ul class="items">
      {#each batch.items as item, i (i)}
        <li class={item.status}>
          <span class="status" aria-hidden="true">
            {#if item.status === 'done'}✓{:else if item.status === 'failed'}✕
            {:else if item.status === 'working'}<span class="spinner"></span>{:else}·{/if}
          </span>
          <span class="name">{item.name}</span>
          {#if item.status === 'failed' && item.reason}
            <span class="reason">{t(`library.error.${item.reason}`, locale)}</span>
          {:else if item.status === 'skipped'}
            <span class="reason">{t('importBatch.skipped', locale)}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="hint">
      {t(assignPadId !== null ? 'importBatch.hintAssign' : 'importBatch.hint', locale)}
    </p>
    {#if error}
      <p class="error">{t(`library.error.${error}`, locale)}</p>
    {/if}
    <!-- Assignation à un pad : UN fichier audio (pas de lot ni d'archive pour un seul pad). -->
    <label class="pick" class:busy>
      <span>{busy ? t('library.importing', locale) : t('importBatch.pick', locale)}</span>
      <input
        type="file"
        accept={assignPadId !== null ? 'audio/*' : IMPORT_ACCEPT}
        multiple={assignPadId === null}
        onchange={onPick}
        disabled={busy}
      />
    </label>
    <label class="option">
      <input type="checkbox" bind:checked={addToPool} disabled={busy} />
      {t('importBatch.addToPool', locale)}
    </label>
  {/if}

  <footer>
    {#if batch && !batch.finished}
      <button type="button" class="danger" onclick={() => app.commands.cancelBatchImport()}>
        <Icon name="close" size={14} />
        {t('importBatch.cancel', locale)}
      </button>
    {:else}
      <button type="button" class="primary" onclick={close} disabled={busy}>
        {t('importBatch.close', locale)}
      </button>
    {/if}
  </footer>
</dialog>

<style>
  .import-modal {
    width: min(28rem, calc(100vw - 2rem));
    max-height: min(34rem, calc(100dvh - 2rem));
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--panel);
    color: var(--fg);
  }

  .import-modal::backdrop {
    background: rgb(0 0 0 / 55%);
  }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  h2 {
    margin: 0;
    font-size: 1rem;
  }

  .count {
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    font-size: 0.85rem;
  }

  progress {
    width: 100%;
    height: 0.5rem;
    appearance: none;
  }

  progress::-webkit-progress-bar {
    background: var(--border);
    border-radius: 999rem;
  }

  progress::-webkit-progress-value {
    background: var(--accent);
    border-radius: 999rem;
    transition: width 0.2s ease;
  }

  .outcome {
    margin: 0;
    font-size: 0.85rem;
    color: var(--accent);
  }

  .outcome.cancelled {
    color: var(--danger);
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .error {
    margin: 0;
    font-size: 0.85rem;
    color: var(--danger);
  }

  /* Bouton de sélection : un label recouvrant l'input file (même patron que la bibliothèque). */
  .pick {
    align-self: center;
    cursor: pointer;
    margin: 0.5rem 0;
  }

  .pick span {
    display: inline-block;
    padding: 0.6rem 1.4rem;
    border: 1px solid var(--accent);
    border-radius: 0.625rem;
    color: var(--accent);
    font-size: 0.95rem;
  }

  .pick input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .pick.busy {
    opacity: 0.5;
    pointer-events: none;
  }

  .option {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    font-size: 0.85rem;
    color: var(--muted);
    cursor: pointer;
  }

  .option input {
    accent-color: var(--accent);
  }

  .items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    overflow-y: auto;
    min-height: 0;
    flex: 1;
    font-size: 0.82rem;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
  }

  li.skipped,
  li.pending {
    color: var(--muted);
  }

  li.failed {
    color: var(--danger);
  }

  .status {
    width: 1rem;
    text-align: center;
    flex-shrink: 0;
  }

  li.done .status {
    color: var(--accent);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reason {
    flex-shrink: 0;
    font-size: 0.75rem;
  }

  .spinner {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  footer {
    display: flex;
    justify-content: flex-end;
  }

  footer button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.9rem;
    border: 1px solid var(--muted);
    border-radius: 0.5rem;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  footer .primary {
    border-color: var(--accent);
    color: var(--accent);
  }

  footer .danger {
    border-color: var(--danger);
    color: var(--danger);
  }
</style>
