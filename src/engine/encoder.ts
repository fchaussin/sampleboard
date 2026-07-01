// SPDX-License-Identifier: GPL-3.0-or-later
// Ré-encodage OGG/Opus à l'import (voir specifications.md §13, décision §16).
// Socle : worker WASM d'opus-recorder (libopus 1.x compilé + conteneur ogg, MIT, embarqué).
// Le WASM est inclus dans le worker (aucun asset séparé). Reproductibilité build-from-source
// prévue au M6. WebCodecs pourra servir de chemin accéléré opportuniste plus tard.
import encoderWorkerUrl from 'opus-recorder/dist/encoderWorker.min.js?url';

/** Débit fixe retenu pour l'encodage Opus (décision verrouillée §16). */
export const OPUS_BITRATE_BPS = 96_000;
/** Fréquence native d'Opus : le worker rééchantillonne la source vers 48 kHz. */
const OPUS_ENCODER_SAMPLE_RATE = 48_000;
/** OPUS_APPLICATION_AUDIO (musique / bruitages), voir libopus. */
const OPUS_APPLICATION_AUDIO = 2049;

/** PCM non entrelacé (un Float32Array par canal) + fréquence source. */
export interface PcmData {
  channelData: Float32Array[];
  sampleRate: number;
}

/** Encode du PCM en OGG/Opus. Injectable : implémentation réelle = worker WASM. */
export type Encoder = (pcm: PcmData) => Promise<Uint8Array>;

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Encodeur OGG/Opus basé sur le worker WASM d'opus-recorder. Un worker éphémère par encodage. */
export function createOpusEncoder(): Encoder {
  return (pcm) =>
    new Promise<Uint8Array>((resolve, reject) => {
      const numberOfChannels = Math.max(1, pcm.channelData.length);
      const worker = new Worker(encoderWorkerUrl);
      const pages: Uint8Array[] = [];
      let settled = false;

      // Filet anti-blocage : si le worker ne finit jamais, on échoue proprement (pas de hang).
      const timer = setTimeout(
        () => finish(() => reject(new Error('opus encoder: timeout'))),
        60_000,
      );

      const finish = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          worker.terminate();
        } catch {
          // worker déjà terminé
        }
        fn();
      };

      worker.onerror = (e) => finish(() => reject(new Error(`opus encoder: ${e.message}`)));

      // Protocole opus-recorder : le worker poste {message:'ready'|'page'|'done'}.
      // Les pages OGG arrivent dans data.page (pas en messages bruts).
      worker.onmessage = ({ data }: MessageEvent) => {
        switch (data?.message) {
          case 'ready':
            // OpusHead + OpusTags d'abord (sinon OGG sans en-têtes = indécodable), puis l'audio.
            worker.postMessage({ command: 'getHeaderPages' });
            worker.postMessage({ command: 'encode', buffers: pcm.channelData });
            worker.postMessage({ command: 'done' });
            break;
          case 'page':
            pages.push(data.page instanceof Uint8Array ? data.page : new Uint8Array(data.page));
            break;
          case 'done':
            finish(() => resolve(concat(pages)));
            break;
        }
      };

      worker.postMessage({
        command: 'init',
        originalSampleRate: pcm.sampleRate,
        numberOfChannels,
        encoderSampleRate: OPUS_ENCODER_SAMPLE_RATE,
        encoderBitRate: OPUS_BITRATE_BPS,
        encoderApplication: OPUS_APPLICATION_AUDIO,
        encoderFrameSize: 20,
        maxFramesPerPage: 40,
        bufferLength: 4096,
        resampleQuality: 3,
        streamPages: false,
      });
    });
}
