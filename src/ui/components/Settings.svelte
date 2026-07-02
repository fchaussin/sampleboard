<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Contenu du tiroir « Réglages » (§11) : Arrière-plan, Nombre maximum de voix, langue.
     Persistés immédiatement (hors debounce) via l'abonné réglages de persistence.ts.
     Styles de formulaire partagés : .drawer-form (app.css). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { BackgroundBehavior } from '../../domain/enums';
  import { availableLocales, t } from '../i18n';

  let { app }: { app: App } = $props();
  const locale = $derived(app.store.locale);
  const settings = $derived(app.store.settings);

  const BACKGROUND_BEHAVIORS: BackgroundBehavior[] = ['stopAll', 'stopSustained', 'keepPlaying'];
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
