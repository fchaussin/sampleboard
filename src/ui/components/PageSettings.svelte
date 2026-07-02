<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Contenu du tiroir « Page » (§11) : renommage, Polyphonie, grille (invariant de réduction),
     ordre, suppression. Styles de formulaire partagés : .drawer-form (app.css). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { VoiceMode } from '../../domain/enums';
  import { padsOfPage, pagesSorted } from '../../domain/selectors';
  import { padsFitGrid, ROWS_MIN, ROWS_MAX, COLS_MIN, COLS_MAX } from '../../domain/invariants';
  import { t } from '../i18n';

  let { app }: { app: App } = $props();

  const locale = $derived(app.store.locale);
  const bank = $derived(app.store.bank);
  const page = $derived(app.store.activePage);
  const pageIndex = $derived(page && bank ? pagesSorted(bank).findIndex((p) => p.id === page.id) : -1);
  const pageCount = $derived(bank ? bank.pages.length : 0);
  const pagePads = $derived(page && bank ? padsOfPage(bank, page.id) : []);

  const VOICES: VoiceMode[] = ['poly', 'mono'];

  // Garde de l'invariant de réduction : peut-on passer à ces dimensions sans orpheliner un pad ?
  function fits(rows: number, cols: number): boolean {
    return padsFitGrid(pagePads, { rows, cols });
  }
</script>

{#if page}
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
    <div class="stepper">
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
{/if}
