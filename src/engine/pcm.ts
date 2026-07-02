// SPDX-License-Identifier: GPL-3.0-or-later
// Opérations PURES sur le PCM non entrelacé (M7 — éditeur audio, spec §16 « découper »).
// TS pur, testable isolément ; consommé par l'AudioEngine et la couche de commandes.
import type { PcmData } from './encoder';

/** Durée minimale d'une sélection de rognage (garde-fou : jamais un sample vide). */
export const TRIM_MIN_S = 0.01;

/** Durée d'un PCM en secondes (0 si vide). */
export function pcmDuration(pcm: PcmData): number {
  const length = pcm.channelData[0]?.length ?? 0;
  return pcm.sampleRate > 0 ? length / pcm.sampleRate : 0;
}

/**
 * Pics de forme d'onde : |amplitude| max par tranche, sur `buckets` tranches,
 * tous canaux confondus. Sert au tracé statique (pads, éditeur audio).
 */
export function computePeaks(channelData: readonly Float32Array[], buckets: number): Float32Array {
  const out = new Float32Array(Math.max(0, buckets));
  const length = channelData[0]?.length ?? 0;
  if (buckets < 1 || length === 0) return out;

  const bucketSize = length / buckets;
  for (const data of channelData) {
    for (let b = 0; b < buckets; b++) {
      const start = Math.floor(b * bucketSize);
      const end = Math.min(length, Math.ceil((b + 1) * bucketSize));
      let peak = out[b]!;
      for (let i = start; i < end; i++) {
        const v = Math.abs(data[i]!);
        if (v > peak) peak = v;
      }
      out[b] = peak;
    }
  }
  return out;
}

/**
 * Borne une sélection [start, end] (secondes) aux limites du PCM, en garantissant
 * l'ordre et une durée minimale TRIM_MIN_S (tant que le PCM le permet).
 */
export function clampSelection(pcm: PcmData, startS: number, endS: number): { start: number; end: number } {
  const duration = pcmDuration(pcm);
  let start = Math.min(Math.max(0, Math.min(startS, endS)), duration);
  let end = Math.max(0, Math.min(Math.max(startS, endS), duration));
  if (end - start < TRIM_MIN_S) {
    end = Math.min(duration, start + TRIM_MIN_S);
    start = Math.max(0, end - TRIM_MIN_S);
  }
  return { start, end };
}

/** Rogne le PCM à la sélection [startS, endS] (secondes, bornée via clampSelection). */
export function trimPcm(pcm: PcmData, startS: number, endS: number): PcmData {
  const { start, end } = clampSelection(pcm, startS, endS);
  const from = Math.floor(start * pcm.sampleRate);
  const to = Math.max(from + 1, Math.ceil(end * pcm.sampleRate));
  return {
    sampleRate: pcm.sampleRate,
    channelData: pcm.channelData.map((data) => data.slice(from, Math.min(data.length, to))),
  };
}
