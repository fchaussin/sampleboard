<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
  TEMP(M3) : barre dev pour alimenter la bibliothèque avant l'import réel (M4).
  « Ajouter un son » crée une entrée Sample (buffer chargé). Chaque entrée existante peut
  recevoir un fichier (charge son buffer). Lecture des octets via l'API File (Vite nu + WebView
  Tauri). Remplacé par Library.svelte + pipeline d'import (M4).
-->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { t } from '../i18n';

  let { app }: { app: App } = $props();
  const locale = $derived(app.store.locale);

  // Suivi local des samples dont le buffer est chargé cette session (l'engine n'est pas réactif).
  let loaded = $state<Set<string>>(new Set());

  function markLoaded(id: string): void {
    loaded = new Set(loaded).add(id);
  }

  async function fileBytes(event: Event): Promise<ArrayBuffer | null> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    return file ? file.arrayBuffer() : null;
  }

  async function onAdd(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const name = input.files?.[0]?.name ?? 'sample';
    const bytes = await fileBytes(event);
    if (!bytes) return;
    const id = await app.commands.devAddSample(name, bytes);
    markLoaded(id);
  }

  async function onLoadInto(sampleId: string, event: Event): Promise<void> {
    const bytes = await fileBytes(event);
    if (!bytes) return;
    await app.commands.attachSampleBuffer(sampleId, bytes);
    markLoaded(sampleId);
  }

  function stopActivePage(): void {
    const id = app.store.activePageId;
    if (id) app.commands.stopPage(id);
  }
</script>

<section class="devlib">
  <div class="head">
    <label class="add">
      <span>{t('devlib.add', locale)}</span>
      <input type="file" accept="audio/*" onchange={onAdd} />
    </label>
    <button class="stop" type="button" onclick={stopActivePage}>{t('devlib.stopPage', locale)}</button>
  </div>

  <ul class="list">
    {#each app.store.samples as s (s.id)}
      <li>
        <span class="label">{s.label}{loaded.has(s.id) ? ' ✓' : ''}</span>
        <label class="load">
          <span>{t('devlib.load', locale)}</span>
          <input type="file" accept="audio/*" onchange={(e) => onLoadInto(s.id, e)} />
        </label>
      </li>
    {/each}
  </ul>
</section>

<style>
  .devlib {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 520px;
    margin: 0 auto;
    width: 100%;
  }

  .head {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    flex-wrap: wrap;
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
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.85rem;
  }

  .add span,
  .load span,
  .stop {
    display: inline-block;
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--accent);
    border-radius: 8px;
    color: var(--accent);
    font-size: 0.8rem;
    cursor: pointer;
  }

  .stop {
    border-color: var(--muted);
    color: inherit;
    background: transparent;
    font: inherit;
  }

  .add input,
  .load input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .add,
  .load {
    cursor: pointer;
  }
</style>
