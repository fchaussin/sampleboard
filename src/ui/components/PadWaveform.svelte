<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Progression du pad EN FORME D'ONDE DU FICHIER (M6) : les pics statiques du sample
     remplissent le pad ; la partie déjà jouée est pleine, le reste estompé. Monté uniquement
     pendant la lecture (Pad.svelte) — une seule boucle rAF par pad. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { fitCanvas, themeColor } from '../waveform';

  let { app, padId, sampleId }: { app: App; padId: string; sampleId: string } = $props();

  let canvas: HTMLCanvasElement;

  $effect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = requestAnimationFrame(function render() {
      const { width, height } = fitCanvas(canvas);
      const dpr = window.devicePixelRatio || 1;
      const barWidth = 2 * dpr;
      const gap = 1 * dpr;
      const buckets = Math.max(8, Math.floor(width / (barWidth + gap)));
      // Sur le fond plein du pad actif, tout se dessine en couleur de contraste.
      const color = themeColor('--accent-contrast');
      const peaks = app.engine.peaks(sampleId, buckets);
      const progress = app.engine.progress(padId);

      ctx.clearRect(0, 0, width, height);
      if (peaks && progress !== null) {
        const mid = height / 2;
        const playedX = progress * width;
        ctx.fillStyle = color;
        for (let i = 0; i < peaks.length; i++) {
          const x = i * (barWidth + gap);
          const barHeight = Math.max(1 * dpr, peaks[i]! * height * 0.86);
          ctx.globalAlpha = x <= playedX ? 0.95 : 0.3;
          ctx.fillRect(x, mid - barHeight / 2, barWidth, barHeight);
        }
        ctx.globalAlpha = 1;
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
