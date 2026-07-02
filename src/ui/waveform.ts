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
