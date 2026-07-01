<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Panneau d'Édition (§11) : réglages de la page active et du pad sélectionné. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { PlayMode, VoiceMode } from '../../domain/enums';
  import { findPad, padsOfPage, pagesSorted } from '../../domain/selectors';
  import {
    padsFitGrid,
    ROWS_MIN,
    ROWS_MAX,
    COLS_MIN,
    COLS_MAX,
    GAIN_DB_MIN,
    GAIN_DB_MAX,
  } from '../../domain/invariants';
  import { t } from '../i18n';

  let { app }: { app: App } = $props();

  const locale = $derived(app.store.locale);
  const bank = $derived(app.store.bank);
  const page = $derived(app.store.activePage);
  const pageIndex = $derived(page && bank ? pagesSorted(bank).findIndex((p) => p.id === page.id) : -1);
  const pageCount = $derived(bank ? bank.pages.length : 0);
  const pagePads = $derived(page && bank ? padsOfPage(bank, page.id) : []);
  const selectedPad = $derived(
    bank && app.store.selectedPadId ? (findPad(bank, app.store.selectedPadId) ?? null) : null,
  );

  const MODES: PlayMode[] = ['oneShot', 'gate', 'loop'];
  const VOICES: VoiceMode[] = ['poly', 'mono'];

  // Garde de l'invariant de réduction : peut-on passer à ces dimensions sans orpheliner un pad ?
  function fits(rows: number, cols: number): boolean {
    return padsFitGrid(pagePads, { rows, cols });
  }
</script>

{#if page}
  <section class="editor">
    <h2>{t('editor.page.title', locale)}</h2>

    <label class="row">
      <span>{t('editor.page.name', locale)}</span>
      <input
        type="text"
        value={page.name}
        oninput={(e) => app.commands.renamePage(page.id, e.currentTarget.value)}
      />
    </label>

    <div class="row">
      <span>{t('editor.page.voiceMode', locale)}</span>
      <div class="toggle">
        {#each VOICES as v (v)}
          <button
            class:active={page.voiceMode === v}
            type="button"
            onclick={() => app.commands.setPageVoiceMode(page.id, v)}
          >
            {t(`voice.${v}`, locale)}
          </button>
        {/each}
      </div>
    </div>

    <div class="row">
      <span>{t('editor.page.rows', locale)}</span>
      <div class="stepper">
        <button
          type="button"
          disabled={page.rows <= ROWS_MIN || !fits(page.rows - 1, page.cols)}
          onclick={() => app.commands.setPageGrid(page.id, page.rows - 1, page.cols)}>−</button
        >
        <span>{page.rows}</span>
        <button
          type="button"
          disabled={page.rows >= ROWS_MAX}
          onclick={() => app.commands.setPageGrid(page.id, page.rows + 1, page.cols)}>+</button
        >
      </div>
    </div>

    <div class="row">
      <span>{t('editor.page.cols', locale)}</span>
      <div class="stepper">
        <button
          type="button"
          disabled={page.cols <= COLS_MIN || !fits(page.rows, page.cols - 1)}
          onclick={() => app.commands.setPageGrid(page.id, page.rows, page.cols - 1)}>−</button
        >
        <span>{page.cols}</span>
        <button
          type="button"
          disabled={page.cols >= COLS_MAX}
          onclick={() => app.commands.setPageGrid(page.id, page.rows, page.cols + 1)}>+</button
        >
      </div>
    </div>

    <div class="row">
      <span>{t('editor.page.order', locale)}</span>
      <div class="toggle">
        <button
          type="button"
          disabled={pageIndex <= 0}
          onclick={() => app.commands.reorderPages(page.id, pageIndex - 1)}>◀</button
        >
        <button
          type="button"
          disabled={pageIndex < 0 || pageIndex >= pageCount - 1}
          onclick={() => app.commands.reorderPages(page.id, pageIndex + 1)}>▶</button
        >
      </div>
    </div>

    <button
      class="danger"
      type="button"
      disabled={pageCount <= 1}
      onclick={() => app.commands.deletePage(page.id)}
    >
      {t('editor.page.delete', locale)}
    </button>

    <hr />

    <h2>{t('editor.pad.title', locale)}</h2>
    {#if selectedPad}
      {@const pad = selectedPad}
      <label class="row">
        <span>{t('editor.pad.name', locale)}</span>
        <input
          type="text"
          value={pad.name}
          oninput={(e) => app.commands.renamePad(pad.id, e.currentTarget.value)}
        />
      </label>

      <div class="row">
        <span>{t('editor.pad.playMode', locale)}</span>
        <div class="toggle">
          {#each MODES as m (m)}
            <button
              class:active={pad.playMode === m}
              type="button"
              onclick={() => app.commands.setPadPlayMode(pad.id, m)}
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
            value={pad.gainDb}
            oninput={(e) => app.commands.setPadGainDb(pad.id, Number(e.currentTarget.value))}
          />
          <span class="gain-value">{pad.gainDb} dB</span>
        </span>
      </label>

      <label class="row">
        <span>{t('editor.pad.sample', locale)}</span>
        <select
          value={pad.sampleId ?? ''}
          onchange={(e) => app.commands.assignSample(pad.id, e.currentTarget.value || null)}
        >
          <option value="">{t('editor.pad.sampleNone', locale)}</option>
          {#each app.store.samples as s (s.id)}
            <option value={s.id}>{s.label}</option>
          {/each}
        </select>
      </label>

      <button class="danger" type="button" onclick={() => app.commands.deletePad(pad.id)}>
        {t('editor.pad.delete', locale)}
      </button>
    {:else}
      <p class="hint">{t('editor.pad.none', locale)}</p>
    {/if}
  </section>
{/if}

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    max-width: 520px;
    margin: 0 auto;
    padding: 1rem;
    border: 1px solid var(--muted);
    border-radius: 12px;
  }

  h2 {
    margin: 0;
    font-size: 1rem;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
  }

  .row > span:first-child {
    color: var(--muted);
    font-size: 0.85rem;
  }

  input[type='text'],
  select {
    flex: 1;
    max-width: 60%;
    padding: 0.3rem 0.5rem;
    background: transparent;
    color: inherit;
    border: 1px solid var(--muted);
    border-radius: 6px;
    font: inherit;
  }

  .toggle,
  .stepper {
    display: flex;
    gap: 0.3rem;
    align-items: center;
  }

  .toggle button,
  .stepper button {
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--muted);
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .toggle button.active {
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }

  button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .gain {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .gain-value {
    min-width: 4ch;
    text-align: right;
    font-size: 0.8rem;
    color: var(--muted);
  }

  .danger {
    align-self: flex-start;
    padding: 0.3rem 0.7rem;
    border: 1px solid #e0574f;
    border-radius: 6px;
    background: transparent;
    color: #e0574f;
    font: inherit;
    cursor: pointer;
  }

  hr {
    border: none;
    border-top: 1px solid var(--muted);
    opacity: 0.4;
    width: 100%;
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
