<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Contenu du tiroir « Réglages » (§11) : Arrière-plan, Nombre maximum de voix, langue.
     Persistés immédiatement (hors debounce) via l'abonné réglages de persistence.ts.
     Styles de formulaire partagés : .drawer-form (app.css). -->
<script lang="ts">
  import { isTauri } from '@tauri-apps/api/core';
  import type { App } from '../../app/create-app';
  import type { BackgroundBehavior } from '../../domain/enums';
  import { reloadForUpdate, requestFactoryReset } from '../../app/maintenance';
  import { availableLocales, t } from '../i18n';

  let { app }: { app: App } = $props();
  const locale = $derived(app.store.locale);
  const settings = $derived(app.store.settings);

  const BACKGROUND_BEHAVIORS: BackgroundBehavior[] = ['stopAll', 'stopSustained', 'keepPlaying'];

  // Section Application (#31) — gestes WEB/PWA (Tauri a son canal de mise à jour : F-Droid).
  const web = !isTauri();
  let resetDialog: HTMLDialogElement;
</script>

<label class="row">
  <span>{t('settings.backgroundBehavior', locale)}</span>
  <select
    value={settings.backgroundBehavior}
    onchange={(e) => app.commands.setBackgroundBehavior(e.currentTarget.value as BackgroundBehavior)}
  >
    {#each BACKGROUND_BEHAVIORS as behavior (behavior)}
      <option value={behavior}>{t(`settings.background.${behavior}`, locale)}</option>
    {/each}
  </select>
</label>

<label class="row">
  <span>{t('settings.maxVoices', locale)}</span>
  <input
    class="number"
    type="number"
    min="1"
    step="1"
    value={settings.maxVoices}
    onchange={(e) => app.commands.setMaxVoices(Number(e.currentTarget.value))}
  />
</label>

<label class="row">
  <span>{t('settings.locale', locale)}</span>
  <select value={settings.locale} onchange={(e) => app.commands.setLocale(e.currentTarget.value)}>
    {#each availableLocales() as l (l)}
      <option value={l}>{t(`locale.${l}`, locale)}</option>
    {/each}
  </select>
</label>

<!-- Application (#31) : version, mise à jour (non destructive), réinitialisation d'usine.
     Deux gestes séparés — se mettre à jour ne coûte jamais ses données. -->
<section class="app-section" aria-label={t('settings.app.title', locale)}>
  <h3>{t('settings.app.title', locale)}</h3>
  <div class="row">
    <span>{t('settings.app.version', locale)}</span>
    <span class="version">{__APP_VERSION__}</span>
  </div>
  {#if web}
    <button class="wide update" type="button" onclick={() => void reloadForUpdate()}>
      {t('settings.app.update', locale)}
    </button>
    <button class="wide danger" type="button" onclick={() => resetDialog.showModal()}>
      {t('settings.app.reset', locale)}
    </button>
  {/if}
</section>

<dialog class="reset-dialog" bind:this={resetDialog}>
  <h2>{t('settings.app.reset.title', locale)}</h2>
  <p>{t('settings.app.reset.body', locale)}</p>
  <div class="dialog-actions">
    <button type="button" onclick={() => resetDialog.close()}>
      {t('settings.app.reset.cancel', locale)}
    </button>
    <button class="danger confirm-reset" type="button" onclick={() => void requestFactoryReset()}>
      {t('settings.app.reset.confirm', locale)}
    </button>
  </div>
</dialog>

<style>
  .app-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
  }

  .app-section h3 {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .version {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .wide {
    min-height: 2.75rem;
    padding: 0 0.9rem;
    border: 1px solid var(--border);
    border-radius: 0.625rem;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    text-align: left;
  }

  .wide.danger {
    border-color: var(--danger);
    color: var(--danger);
  }

  .reset-dialog {
    max-width: 22rem;
    padding: 1.25rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--panel);
    color: inherit;
  }

  .reset-dialog::backdrop {
    background: rgb(0 0 0 / 55%);
  }

  .reset-dialog h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }

  .reset-dialog p {
    margin: 0 0 1rem;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .dialog-actions button {
    min-height: 2.5rem;
    padding: 0 0.9rem;
    border: 1px solid var(--border);
    border-radius: 0.625rem;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .dialog-actions .danger {
    border-color: var(--danger);
    background: var(--danger);
    color: var(--accent-contrast);
  }
</style>
