<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Visualiseur global de la topbar (M6/M8) : une onde PAR VOIX active, chacune à la couleur
     de son pad ; au repos, des sinusoïdes basse fréquence défilent doucement (statut idle). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { findPad } from '../../domain/selectors';
  import { WAVEFORM_SIZE } from '../../engine/audio-engine';
  import { drawWave, fitCanvas, themeColor, tintColor } from '../waveform';

  let { app }: { app: App } = $props();

  let canvas: HTMLCanvasElement;
  const samples = new Float32Array(WAVEFORM_SIZE);

  // Phase ACCUMULÉE en delta plafonné : l'animation est continue — jamais de saut, même
  // après un gel d'onglet (le rattrapage est borné à une frame).
  let idlePhase = 0;
  let lastFrame = 0;

  /** Statut idle : deux sinusoïdes lentes, décalées, en couleur discrète. */
  function drawIdle(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number): void {
    const mid = height / 2;
    ctx.strokeStyle = themeColor('--fg');
    ctx.lineWidth = 1 * dpr;
    for (let wave = 0; wave < 2; wave++) {
      const cycles = 2 + wave; // basse fréquence
      const phase = idlePhase * (wave === 0 ? 1 : -0.7); // sens opposés
      const amplitude = mid * (0.45 - wave * 0.15);
      ctx.globalAlpha = 0.22 - wave * 0.08;
      ctx.beginPath();
      const steps = 64;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * width;
        const y = mid + Math.sin((i / steps) * cycles * Math.PI * 2 + phase) * amplitude;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  $effect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = requestAnimationFrame(function render(time) {
      // Avance de phase continue : delta réel, plafonné (défilement tranquille mais vivant).
      if (lastFrame > 0) idlePhase += Math.min(time - lastFrame, 64) * 0.0007;
      lastFrame = time;
      const { width, height } = fitCanvas(canvas);
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, width, height);
      const bank = app.store.bank;
      const active = app.store.activePadIds;
      if (active.size === 0) {
        drawIdle(ctx, width, height, dpr);
      } else {
        for (const padId of active) {
          if (!app.engine.waveform(padId, samples)) continue;
          const pad = bank ? findPad(bank, padId) : undefined;
          drawWave(ctx, samples, tintColor(pad?.color ?? null), width, height, 1.5 * dpr);
        }
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
