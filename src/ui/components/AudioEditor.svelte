<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Éditeur audio (M7, « découper », §16) : modale plein écran (top-layer, au-dessus de la
     modale d'import) — waveform du PCM décodé, poignées de rognage start/end (tactiles),
     undo/redo, pré-écoute de la sélection. Valider → rogne PUIS encode (commandes). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { AudioEditorState } from '../../app/store.svelte';
  import type { ImportError } from '../../app/commands';
  import { SelectionHistory, type Selection } from '../../app/selection-history';
  import { clampSelection, computePeaks, pcmDuration } from '../../engine/pcm';
  import { fitCanvas, themeColor } from '../waveform';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  let { app, editor }: { app: App; editor: AudioEditorState } = $props();

  const locale = $derived(app.store.locale);
  // svelte-ignore state_referenced_locally -- session immuable : remontée via {#key} (App.svelte)
  const duration = pcmDuration(editor.pcm);

  const history = new SelectionHistory({ start: 0, end: duration });
  let selection = $state<Selection>({ start: 0, end: duration });
  let canUndo = $state(false);
  let canRedo = $state(false);
  let busy = $state(false);
  let error = $state<ImportError | null>(null);

  let dialog: HTMLDialogElement;
  let canvas: HTMLCanvasElement;
  // Pics mis en cache par nombre de tranches (recalcul uniquement au redimensionnement).
  let peaksCache: { buckets: number; data: Float32Array } | null = null;

  $effect(() => {
    if (!dialog.open) dialog.showModal();
  });

  function peaksFor(buckets: number): Float32Array {
    if (!peaksCache || peaksCache.buckets !== buckets) {
      peaksCache = { buckets, data: computePeaks(editor.pcm.channelData, buckets) };
    }
    return peaksCache.data;
  }

  function draw(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = fitCanvas(canvas);
    const dpr = window.devicePixelRatio || 1;
    const barWidth = 2 * dpr;
    const gap = 1 * dpr;
    const peaks = peaksFor(Math.max(16, Math.floor(width / (barWidth + gap))));
    const mid = height / 2;
    const startX = duration > 0 ? (selection.start / duration) * width : 0;
    const endX = duration > 0 ? (selection.end / duration) * width : width;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = themeColor('--accent');
    for (let i = 0; i < peaks.length; i++) {
      const x = i * (barWidth + gap);
      const barHeight = Math.max(1 * dpr, peaks[i]! * height * 0.9);
      ctx.globalAlpha = x >= startX && x <= endX ? 0.95 : 0.25;
      ctx.fillRect(x, mid - barHeight / 2, barWidth, barHeight);
    }
    ctx.globalAlpha = 1;
    // Poignées start/end : traits pleins sur toute la hauteur.
    ctx.fillStyle = themeColor('--fg');
    for (const x of [startX, endX]) {
      ctx.fillRect(Math.min(width - 2 * dpr, Math.max(0, x - dpr)), 0, 2 * dpr, height);
    }
  }

  // Redessine à chaque changement de sélection (et au montage).
  $effect(() => {
    void selection;
    draw();
  });

  function timeAt(clientX: number): number {
    const rect = canvas.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    return Math.min(duration, Math.max(0, ratio * duration));
  }

  /** Poignée la plus proche du point touché — c'est elle que le geste déplace. */
  let dragging: 'start' | 'end' | null = null;

  function onPointerDown(event: PointerEvent): void {
    const time = timeAt(event.clientX);
    dragging = Math.abs(time - selection.start) <= Math.abs(time - selection.end) ? 'start' : 'end';
    canvas.setPointerCapture(event.pointerId);
    onPointerMove(event);
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging) return;
    const time = timeAt(event.clientX);
    const next =
      dragging === 'start' ? { start: time, end: selection.end } : { start: selection.start, end: time };
    selection = clampSelection(editor.pcm, next.start, next.end);
  }

  function onPointerUp(): void {
    if (!dragging) return;
    dragging = null;
    history.push(selection);
    syncHistory();
  }

  function syncHistory(): void {
    canUndo = history.canUndo;
    canRedo = history.canRedo;
  }

  function undo(): void {
    selection = history.undo();
    syncHistory();
  }

  function redo(): void {
    selection = history.redo();
    syncHistory();
  }

  const seconds = $derived(new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }));

  async function apply(): Promise<void> {
    busy = true;
    error = null;
    const result = await app.commands.applyAudioEditor(selection.start, selection.end);
    busy = false;
    if (!result.ok) error = result.reason; // succès → la session se ferme, le composant se démonte
  }
</script>

<dialog
  class="audio-editor"
  bind:this={dialog}
  aria-label={t('audioEditor.title', locale)}
  oncancel={() => app.commands.cancelAudioEditor()}
>
  <header>
    <h2>{t('audioEditor.title', locale)} — <span class="file">{editor.fileName}</span></h2>
    <button
      class="close"
      type="button"
      aria-label={t('audioEditor.cancel', locale)}
      onclick={() => app.commands.cancelAudioEditor()}
    >
      <Icon name="close" />
    </button>
  </header>

  <canvas
    class="wave"
    bind:this={canvas}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  ></canvas>

  <p class="times">
    {seconds.format(selection.start)}
    {t('unit.seconds', locale)} – {seconds.format(selection.end)}
    {t('unit.seconds', locale)} · {seconds.format(selection.end - selection.start)}
    {t('unit.seconds', locale)}
  </p>

  {#if error}
    <p class="error" role="alert">{t(`library.error.${error}`, locale)}</p>
  {/if}

  <footer>
    <button
      class="tool undo"
      type="button"
      disabled={!canUndo}
      title={t('audioEditor.undo', locale)}
      aria-label={t('audioEditor.undo', locale)}
      onclick={undo}
    >
      <Icon name="undo" size={18} />
    </button>
    <button
      class="tool redo"
      type="button"
      disabled={!canRedo}
      title={t('audioEditor.redo', locale)}
      aria-label={t('audioEditor.redo', locale)}
      onclick={redo}
    >
      <Icon name="redo" size={18} />
    </button>
    <button
      class="tool preview"
      type="button"
      title={t('audioEditor.preview', locale)}
      aria-label={t('audioEditor.preview', locale)}
      onclick={() => app.commands.previewEditorSelection(selection.start, selection.end)}
    >
      <Icon name="play" size={18} />
    </button>
    <span class="spacer"></span>
    <button class="cancel" type="button" onclick={() => app.commands.cancelAudioEditor()}>
      {t('audioEditor.cancel', locale)}
    </button>
    <button class="apply" type="button" disabled={busy} onclick={apply}>
      {t('audioEditor.apply', locale)}
    </button>
  </footer>
</dialog>

<style>
  .audio-editor {
    width: 100vw;
    height: 100dvh;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 1rem;
    padding-top: calc(1rem + env(safe-area-inset-top));
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
    border: none;
    background: var(--bg);
    color: var(--fg);
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: 1rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file {
    color: var(--muted);
    font-weight: 400;
  }

  .close {
    display: inline-flex;
    min-width: 44px;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .wave {
    flex: 1;
    min-height: 0;
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    touch-action: none;
    cursor: ew-resize;
  }

  .times {
    margin: 0;
    text-align: center;
    color: var(--muted);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }

  .error {
    margin: 0;
    text-align: center;
    color: var(--danger);
    font-size: 0.85rem;
  }

  footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tool {
    display: inline-flex;
    min-width: 44px;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .tool:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .preview {
    color: var(--accent);
  }

  .spacer {
    flex: 1;
  }

  .cancel,
  .apply {
    min-height: 44px;
    padding: 0 1rem;
    border-radius: 10px;
    font: inherit;
    cursor: pointer;
  }

  .cancel {
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
  }

  .apply {
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 600;
  }

  .apply:disabled {
    opacity: 0.5;
    cursor: wait;
  }
</style>
