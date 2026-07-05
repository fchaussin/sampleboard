<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Contenu du tiroir « Pad » (§11) : renommage, Mode de lecture, gain dB, assignation,
     suppression. Styles de formulaire partagés : .drawer-form (app.css). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { PlayMode } from '../../domain/enums';
  import { findPad } from '../../domain/selectors';
  import { GAIN_DB_MIN, GAIN_DB_MAX } from '../../domain/invariants';
  import { t } from '../i18n';
  import ColorPicker from './ColorPicker.svelte';
  import Icon from './Icon.svelte';
  import SamplePicker from './SamplePicker.svelte';

  let { app }: { app: App } = $props();

  const locale = $derived(app.store.locale);
  const pad = $derived(
    app.store.bank && app.store.selectedPadId
      ? (findPad(app.store.bank, app.store.selectedPadId) ?? null)
      : null,
  );

  const MODES: PlayMode[] = ['oneShot', 'gate', 'loop'];

  // Modale de choix de sample (<dialog>), voir SamplePicker.
  let pickerOpen = $state(false);
  const currentSampleLabel = $derived(
    pad?.sampleId ? (app.store.samples.find((s) => s.id === pad.sampleId)?.label ?? '?') : null,
  );
  // Sample déjà dans le pool d'assignation : le bouton d'ajout devient inactif (feedback).
  const inPool = $derived(!!pad?.sampleId && app.store.poolSampleIds.includes(pad.sampleId));
</script>

{#if pad}
  {@const p = pad}
  <label class="row">
    <span>{t('editor.pad.name', locale)}</span>
    <input
      type="text"
      value={p.name}
      oninput={(e) => app.commands.renamePad(p.id, e.currentTarget.value)}
    />
  </label>

  <div class="row">
    <span>{t('editor.pad.playMode', locale)}</span>
    <div class="toggle">
      {#each MODES as m (m)}
        <button
          class:active={p.playMode === m}
          type="button"
          onclick={() => app.commands.setPadPlayMode(p.id, m)}
        >
          {t(`mode.${m}`, locale)}
        </button>
      {/each}
    </div>
  </div>

  <label class="row">
    <span>{t('editor.pad.gain', locale)}</span>
    <span class="gain">
      <input
        type="range"
        min={GAIN_DB_MIN}
        max={GAIN_DB_MAX}
        step="1"
        value={p.gainDb}
        oninput={(e) => app.commands.setPadGainDb(p.id, Number(e.currentTarget.value))}
      />
      <span class="gain-value">{p.gainDb} dB</span>
    </span>
  </label>

  <div class="row">
    <span>{t('editor.color', locale)}</span>
    <ColorPicker value={p.color} {locale} onchange={(color) => app.commands.setPadColor(p.id, color)} />
  </div>

  <div class="row">
    <span>{t('editor.pad.sample', locale)}</span>
    <button class="sample-select" type="button" onclick={() => (pickerOpen = true)}>
      {currentSampleLabel ?? t('editor.pad.sampleNone', locale)}
    </button>
  </div>
  <SamplePicker {app} padId={p.id} open={pickerOpen} onclose={() => (pickerOpen = false)} />

  <!-- Ajout du sample du pad au POOL d'assignation (#33) : seulement s'il en a un ;
       inactif s'il y est déjà. Le pool est un outil d'Édition, comme ce tiroir. -->
  {#if p.sampleId}
    <button
      class="pool-add"
      type="button"
      disabled={inPool}
      onclick={() => {
        if (p.sampleId) app.commands.addToPool(p.sampleId);
      }}
    >
      <Icon name="pool" size={16} />
      <span>{inPool ? t('pool.added', locale) : t('pool.add', locale)}</span>
    </button>
  {/if}

  <button class="danger" type="button" onclick={() => app.commands.deletePad(p.id)}>
    {t('editor.pad.delete', locale)}
  </button>
{:else}
  <p class="hint">{t('editor.pad.none', locale)}</p>
{/if}

<style>
  .pool-add {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    min-height: 2.5rem;
    padding: 0 0.9rem;
    border: 1px solid var(--accent);
    border-radius: 0.5rem;
    background: transparent;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
  }

  .pool-add:disabled {
    border-color: var(--border);
    color: var(--muted);
    cursor: default;
  }
</style>
