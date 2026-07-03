<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Progression du pad EN FORME D'ONDE DU FICHIER (M6) : les pics statiques du sample
     remplissent le pad ; la partie déjà jouée est pleine, le reste estompé. Monté uniquement
     pendant la lecture (Pad.svelte) — une seule boucle rAF par pad. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { drawPeakBars, fitCanvas, peakBuckets, themeColor } from '../waveform';

  let { app, padId, sampleId }: { app: App; padId: string; sampleId: string } = $props();

  let canvas: HTMLCanvasElement;

  $effect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = requestAnimationFrame(function render() {
      const { width, height } = fitCanvas(canvas);
      const dpr = window.devicePixelRatio || 1;
      // Sur le fond plein du pad actif, tout se dessine en couleur de contraste.
      const peaks = app.engine.peaks(sampleId, peakBuckets(width, dpr));
      const progress = app.engine.progress(padId);

      if (peaks && progress !== null) {
        drawPeakBars(ctx, peaks, themeColor('--accent-contrast'), width, height, dpr, progress);
      } else {
        ctx.clearRect(0, 0, width, height);
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
    inset: 0.25rem;
    width: calc(100% - 0.5rem);
    height: calc(100% - 0.5rem);
    pointer-events: none;
  }
</style>
