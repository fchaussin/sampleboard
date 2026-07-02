<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Visualiseur global de la topbar (M6) : une onde PAR VOIX active, chacune à la couleur
     de son pad. La boucle rAF ne tourne que lorsqu'au moins une voix joue. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { findPad } from '../../domain/selectors';
  import { WAVEFORM_SIZE } from '../../engine/audio-engine';
  import { drawWave, fitCanvas, tintColor } from '../waveform';

  let { app }: { app: App } = $props();

  // Seul déclencheur de la boucle : y a-t-il des voix ? (le contenu est lu à chaque frame)
  const playing = $derived(app.store.activePadIds.size > 0);

  let canvas: HTMLCanvasElement;
  const samples = new Float32Array(WAVEFORM_SIZE);

  $effect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!playing) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    let raf = requestAnimationFrame(function render() {
      const { width, height } = fitCanvas(canvas);
      ctx.clearRect(0, 0, width, height);
      const bank = app.store.bank;
      const dpr = window.devicePixelRatio || 1;
      for (const padId of app.store.activePadIds) {
        if (!app.engine.waveform(padId, samples)) continue;
        const pad = bank ? findPad(bank, padId) : undefined;
        drawWave(ctx, samples, tintColor(pad?.color ?? null), width, height, 1.5 * dpr);
      }
      raf = requestAnimationFrame(render);
    });
    return () => cancelAnimationFrame(raf);
  });
</script>

<canvas bind:this={canvas} class="viz" aria-hidden="true"></canvas>

<style>
  .viz {
    flex: 1;
    min-width: 0;
    height: 1.875rem;
    align-self: center;
    pointer-events: none;
  }
</style>
