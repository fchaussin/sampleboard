<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Contenu du tiroir « Pad » (§11) : renommage, Mode de lecture, gain dB, assignation,
     suppression. Styles de formulaire partagés : .drawer-form (app.css). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { PlayMode } from '../../domain/enums';
  import { findPad } from '../../domain/selectors';
  import { GAIN_DB_MIN, GAIN_DB_MAX } from '../../domain/invariants';
  import { t } from '../i18n';

  let { app }: { app: App } = $props();

  const locale = $derived(app.store.locale);
  const pad = $derived(
    app.store.bank && app.store.selectedPadId
      ? (findPad(app.store.bank, app.store.selectedPadId) ?? null)
      : null,
  );

  const MODES: PlayMode[] = ['oneShot', 'gate', 'loop'];
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

  <label class="row">
    <span>{t('editor.pad.sample', locale)}</span>
    <select
      value={p.sampleId ?? ''}
      onchange={(e) => app.commands.assignSample(p.id, e.currentTarget.value || null)}
    >
      <option value="">{t('editor.pad.sampleNone', locale)}</option>
      {#each app.store.samples as s (s.id)}
        <option value={s.id}>{s.label}</option>
      {/each}
    </select>
  </label>

  <button class="danger" type="button" onclick={() => app.commands.deletePad(p.id)}>
    {t('editor.pad.delete', locale)}
  </button>
{:else}
  <p class="hint">{t('editor.pad.none', locale)}</p>
{/if}
