<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
  TEMP(M2) : barre dev pour charger des sons dans les slots référencés par la banque seed
  (dev-seed.ts), avant l'import réel (M4). Lecture des octets via l'API File (testable en
  Vite nu ET WebView Tauri). Retiré quand la bibliothèque/import (M4) arriveront.
-->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { DEV_SAMPLE_A, DEV_SAMPLE_B } from '../../app/dev-seed';
  import { t } from '../i18n';

  let { app }: { app: App } = $props();
  const locale = $derived(app.store.locale);

  let readyA = $state(false);
  let readyB = $state(false);

  async function loadInto(slot: string, event: Event): Promise<boolean> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return false;
    try {
      await app.commands.loadDevSample(slot, await file.arrayBuffer());
      return true;
    } catch {
      return false;
    } finally {
      input.value = '';
    }
  }

  async function onA(event: Event): Promise<void> {
    readyA = await loadInto(DEV_SAMPLE_A, event);
  }
  async function onB(event: Event): Promise<void> {
    readyB = await loadInto(DEV_SAMPLE_B, event);
  }

  function stopActivePage(): void {
    const id = app.store.activePageId;
    if (id) app.commands.stopPage(id);
  }
</script>

<section class="loader">
  <p class="hint">{t('m2.dev.hint', locale)}</p>
  <div class="slots">
    <label class="slot" class:ready={readyA}>
      <span>{t('m2.dev.loadA', locale)}{readyA ? ' ✓' : ''}</span>
      <input type="file" accept="audio/*" onchange={onA} />
    </label>
    <label class="slot" class:ready={readyB}>
      <span>{t('m2.dev.loadB', locale)}{readyB ? ' ✓' : ''}</span>
      <input type="file" accept="audio/*" onchange={onB} />
    </label>
    <button class="stop" type="button" onclick={stopActivePage}>
      {t('m2.dev.stopPage', locale)}
    </button>
  </div>
</section>

<style>
  .loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 0.8rem;
    text-align: center;
  }

  .slots {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .slot {
    cursor: pointer;
  }

  .slot span {
    display: inline-block;
    padding: 0.35rem 0.8rem;
    border: 1px solid var(--accent);
    border-radius: 8px;
    color: var(--accent);
    font-size: 0.85rem;
  }

  .slot.ready span {
    background: var(--accent);
    color: #101014;
  }

  .slot input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .stop {
    padding: 0.35rem 0.8rem;
    border: 1px solid var(--muted);
    border-radius: 8px;
    background: transparent;
    color: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }
</style>
