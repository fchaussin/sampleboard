// SPDX-License-Identifier: GPL-3.0-or-later
// Ré-encodage OGG/Opus à l'import (WASM libopus embarqué) — voir specifications.md §13.
// Squelette M0 : l'intégration WASM libopus arrive au jalon M4.

/** Débit fixe retenu pour l'encodage Opus (voir §13, décision verrouillée §16). */
export const OPUS_BITRATE_BPS = 96_000;

/**
 * Ré-encode du PCM décodé en conteneur OGG/Opus.
 * TODO(M4) : intégrer le WASM libopus + conteneur ogg ; WebCodecs en accélération opportuniste.
 */
export async function encodeToOpus(_pcm: AudioBuffer): Promise<Uint8Array> {
  throw new Error('encoder: non implémenté (jalon M4)');
}
