// SPDX-License-Identifier: GPL-3.0-or-later
// Visualiseurs (M6) — utilitaires partagés : résolution des couleurs CSS (token de palette
// → valeur calculée, mise en cache) et tracé d'une forme d'onde sur un canvas.
// Un seul chemin de rendu pour le pad et la topbar (DRY, §4).
import type { Color } from '../domain/enums';

const cssCache = new Map<string, string>();

function cssValue(variable: string): string {
  let value = cssCache.get(variable);
  if (value === undefined) {
    value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    cssCache.set(variable, value);
  }
  return value;
}

/** Couleur CSS effective d'un token de palette (accent si neutre). */
export function tintColor(color: Color | null): string {
  return cssValue(color ? `--c-${color}` : '--accent');
}

/** Couleur CSS effective d'une variable du thème. */
export function themeColor(variable: '--fg' | '--accent' | '--accent-contrast'): string {
  return cssValue(variable);
}

/** Ajuste le canvas à sa taille CSS × devicePixelRatio ; renvoie ses dimensions internes. */
export function fitCanvas(canvas: HTMLCanvasElement): { width: number; height: number } {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return { width, height };
}

/** Trace une forme d'onde (échantillons [-1, 1]) sur toute la surface donnée. */
export function drawWave(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  color: string,
  width: number,
  height: number,
  lineWidth: number,
): void {
  const mid = height / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * width;
    const y = mid - (data[i] ?? 0) * mid * 0.9;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/**
 * Trace des pics en barres verticales (waveform de sample) avec progression : la partie
 * déjà jouée est pleine, le reste estompé. `progress` null = tracé statique (tout estompé
 * au même niveau). Un seul chemin de rendu pad / carte de bibliothèque (DRY, §4).
 */
export function drawPeakBars(
  ctx: CanvasRenderingContext2D,
  peaks: Float32Array,
  color: string,
  width: number,
  height: number,
  dpr: number,
  progress: number | null,
): void {
  const barWidth = 2 * dpr;
  const gap = 1 * dpr;
  const mid = height / 2;
  const playedX = progress === null ? -1 : progress * width;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = color;
  for (let i = 0; i < peaks.length; i++) {
    const x = i * (barWidth + gap);
    const barHeight = Math.max(1 * dpr, peaks[i]! * height * 0.86);
    ctx.globalAlpha = progress === null ? 0.45 : x <= playedX ? 0.95 : 0.3;
    ctx.fillRect(x, mid - barHeight / 2, barWidth, barHeight);
  }
  ctx.globalAlpha = 1;
}

/** Nombre de tranches de pics pour une largeur de tracé donnée (barres 2px + espace 1px). */
export function peakBuckets(width: number, dpr: number): number {
  return Math.max(8, Math.floor(width / (3 * dpr)));
}
