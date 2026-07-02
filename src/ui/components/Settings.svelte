<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Réglages globaux (§11) : Arrière-plan, Nombre maximum de voix, langue. Persistés
     immédiatement (hors debounce) via l'abonné réglages de persistence.ts. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { BackgroundBehavior } from '../../domain/enums';
  import { availableLocales, t } from '../i18n';

  let { app }: { app: App } = $props();
  const locale = $derived(app.store.locale);
  const settings = $derived(app.store.settings);

  const BACKGROUND_BEHAVIORS: BackgroundBehavior[] = ['stopAll', 'stopSustained', 'keepPlaying'];
</script>

<details class="settings">
  <summary>{t('settings.title', locale)}</summary>
  <div class="rows">
    <label>
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

    <label>
      <span>{t('settings.maxVoices', locale)}</span>
      <input
        type="number"
        min="1"
        step="1"
        value={settings.maxVoices}
        onchange={(e) => app.commands.setMaxVoices(Number(e.currentTarget.value))}
      />
    </label>

    <label>
      <span>{t('settings.locale', locale)}</span>
      <select value={settings.locale} onchange={(e) => app.commands.setLocale(e.currentTarget.value)}>
        {#each availableLocales() as l (l)}
          <option value={l}>{t(`locale.${l}`, locale)}</option>
        {/each}
      </select>
    </label>
  </div>
</details>

<style>
  .settings {
    max-width: 520px;
    margin: 0 auto;
    width: 100%;
    font-size: 0.85rem;
  }

  summary {
    cursor: pointer;
    color: var(--muted);
    text-align: center;
    list-style-position: inside;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.6rem 0;
  }

  label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
  }

  select,
  input {
    padding: 0.25rem 0.5rem;
    background: transparent;
    color: inherit;
    border: 1px solid var(--muted);
    border-radius: 6px;
    font: inherit;
    max-width: 14rem;
  }

  input[type='number'] {
    width: 5rem;
  }
</style>
