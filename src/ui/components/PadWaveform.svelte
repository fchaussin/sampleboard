<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Visualiseur du pad (M6) : forme d'onde de SA voix + barre d'avancement en bas, tracées
     pendant la lecture. Monté uniquement quand le pad joue (Pad.svelte) — une seule boucle
     rAF par pad pour les deux rendus. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { WAVEFORM_SIZE } from '../../engine/audio-engine';
  import { drawWave, fitCanvas, themeColor } from '../waveform';

  let { app, padId }: { app: App; padId: string } = $props();

  let canvas: HTMLCanvasElement;
  const samples = new Float32Array(WAVEFORM_SIZE);

  $effect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = requestAnimationFrame(function render() {
      const { width, height } = fitCanvas(canvas);
      const dpr = window.devicePixelRatio || 1;
      // Sur le fond plein du pad actif, tout se trace en couleur de contraste.
      const color = themeColor('--accent-contrast');
      ctx.clearRect(0, 0, width, height);
      if (app.engine.waveform(padId, samples)) {
        drawWave(ctx, samples, color, width, height, 2 * dpr);
      }
      const progress = app.engine.progress(padId);
      if (progress !== null) {
        const barHeight = 3 * dpr;
        ctx.fillStyle = color;
        ctx.fillRect(0, height - barHeight, width * progress, barHeight);
      }
      raf = requestAnimationFrame(render);
    });
    return () => cancelAnimationFrame(raf);
  });
</script>

<canvas bind:this={canvas} class="wave" aria-hidden="true"></canvas>

<style>
  .wave {
    position: absolute;
    inset: 4px;
    width: calc(100% - 8px);
    height: calc(100% - 8px);
    pointer-events: none;
    opacity: 0.8;
  }
</style>
