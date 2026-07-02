<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Bannière du mode assignation à la volée (M8) : sample armé + Terminer. Visible tant que
     le mode est actif — on change librement de page, chaque pad touché reçoit le sample. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { t } from '../i18n';

  let { app }: { app: App } = $props();
  const locale = $derived(app.store.locale);
  const sample = $derived(
    app.store.samples.find((s) => s.id === app.store.assigningSampleId) ?? null,
  );
</script>

<div class="banner" role="status">
  <span class="text">
    <strong>{sample?.label}</strong>
    — {t('assign.banner', locale)}
  </span>
  <button type="button" onclick={() => app.commands.stopAssigning()}>
    {t('assign.done', locale)}
  </button>
</div>

<style>
  .banner {
    position: fixed;
    left: 50%;
    bottom: calc(4.75rem + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: calc(100vw - 1.5rem);
    padding: 0.5rem 0.9rem;
    border: 1px solid var(--accent);
    border-radius: 0.625rem;
    background: var(--panel);
    font-size: 0.85rem;
    z-index: var(--z-snackbar);
  }

  .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button {
    min-height: 2.25rem;
    padding: 0 0.8rem;
    border: 1px solid var(--accent);
    border-radius: 0.375rem;
    background: var(--accent);
    color: var(--accent-contrast);
    font: inherit;
    cursor: pointer;
    flex-shrink: 0;
  }
</style>
