<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Waveform de carte de bibliothèque (#19) : pics statiques du sample toujours visibles ;
     pendant la pré-écoute, la partie jouée se remplit (progression). La boucle rAF ne
     tourne QUE pendant la pré-écoute de CE sample — sinon un seul tracé statique. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { drawPeakBars, fitCanvas, peakBuckets, themeColor } from '../waveform';

  let { app, sampleId }: { app: App; sampleId: string } = $props();

  let canvas: HTMLCanvasElement;
  const previewing = $derived(app.store.previewingSampleId === sampleId);

  function draw(progress: number | null): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = fitCanvas(canvas);
    const dpr = window.devicePixelRatio || 1;
    const peaks = app.engine.peaks(sampleId, peakBuckets(width, dpr));
    if (peaks) drawPeakBars(ctx, peaks, themeColor('--accent'), width, height, dpr, progress);
    else ctx.clearRect(0, 0, width, height);
  }

  $effect(() => {
    if (!previewing) {
      // Tracé statique (après layout) — pas de boucle d'animation au repos.
      const raf = requestAnimationFrame(() => draw(null));
      return () => cancelAnimationFrame(raf);
    }
    let raf = requestAnimationFrame(function render() {
      draw(app.engine.previewProgress());
      raf = requestAnimationFrame(render);
    });
    return () => cancelAnimationFrame(raf);
  });
</script>

<canvas bind:this={canvas} class="wave" aria-hidden="true"></canvas>

<style>
  /* Remplit son conteneur : la taille est fixée par l'hôte (bande de carte, fond
     d'élément du pool…). */
  .wave {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
