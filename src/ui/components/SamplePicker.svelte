<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Modale de choix de sample (<dialog>, M6) : liste de la bibliothèque (méta + pré-écoute),
     option « aucun », et import direct — le sample importé est assigné dans la foulée. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { ImportError } from '../../app/commands';
  import { importFile } from '../import-file';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

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
  const samples = $derived(app.store.samples);
  const current = $derived(
    app.store.bank?.pads.find((p) => p.id === padId)?.sampleId ?? null,
  );

  let dialog: HTMLDialogElement;
  let busy = $state(false);
  let error = $state<ImportError | null>(null);

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function choose(sampleId: string | null): void {
    app.commands.assignSample(padId, sampleId);
    onclose();
  }

  async function onImport(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    busy = true;
    error = null;
    // M7 : l'import ouvre l'ÉDITEUR AUDIO (rognage) ; le pad sera assigné à la validation.
    const failure = await importFile(app, file, padId);
    busy = false;
    if (failure) {
      error = failure;
      return;
    }
    onclose(); // l'éditeur (top-layer) prend le relais
  }
</script>

<dialog class="picker" bind:this={dialog} onclose={() => onclose()} aria-label={t('picker.title', locale)}>
  <header>
    <h2>{t('picker.title', locale)}</h2>
    <button class="close" type="button" aria-label={t('drawer.close', locale)} onclick={() => onclose()}>
      <Icon name="close" size={18} />
    </button>
  </header>

  <label class="import" class:busy>
    <span>{busy ? t('library.importing', locale) : t('library.import', locale)}</span>
    <input type="file" accept="audio/*" onchange={onImport} disabled={busy} />
  </label>
  {#if error}
    <p class="error" role="alert">{t(`library.error.${error}`, locale)}</p>
  {/if}

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
        <button
          class="preview"
          type="button"
          title={t('library.preview', locale)}
          aria-label={t('library.preview', locale)}
          onclick={() => app.commands.previewSample(s.id)}
        >
          <Icon name="play" size={16} />
        </button>
      </li>
    {/each}
  </ul>
</dialog>

<style>
  .picker {
    width: min(420px, 92vw);
    max-height: 80dvh;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 14px;
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
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .import {
    display: block;
    text-align: center;
    padding: 0.5rem;
    border: 1px dashed var(--accent);
    border-radius: 10px;
    color: var(--accent);
    font-size: 0.85rem;
    cursor: pointer;
    margin-bottom: 0.75rem;
  }

  .import input {
    display: none;
  }

  .import.busy {
    opacity: 0.4;
    pointer-events: none;
  }

  .error {
    margin: 0 0 0.6rem;
    color: var(--danger);
    font-size: 0.8rem;
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
    min-height: 42px;
    padding: 0.4rem 0.7rem;
    text-align: left;
    border: 1px solid var(--border);
    border-radius: 10px;
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

  .preview {
    display: inline-flex;
    min-width: 40px;
    min-height: 40px;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
</style>
