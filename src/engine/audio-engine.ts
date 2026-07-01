// SPDX-License-Identifier: GPL-3.0-or-later
// Moteur audio (Web Audio) — squelette M0. Implémentation réelle au jalon M1 (voir §7).
// Responsabilité unique : produire du son à faible latence et gérer les voix (FIFO).
// TS pur : ne dépend jamais de Svelte.
import type { Pad, Page } from '../domain/types';
import type { EngineState, PlayingChangedCallback } from './types';

export class AudioEngine {
  #onPlayingChanged: PlayingChangedCallback | null = null;

  /** À appeler sur le 1er geste utilisateur ; idempotent (voir §7, §12). */
  async resume(): Promise<void> {
    // TODO(M1) : créer/reprendre l'AudioContext (politique autoplay mobile).
  }

  get state(): EngineState {
    // TODO(M1) : refléter l'état réel de l'AudioContext.
    return 'suspended';
  }

  /** Décode les octets et met le buffer en cache par sampleId (voir §7). */
  async load(_sampleId: string, _bytes: ArrayBuffer): Promise<void> {
    // TODO(M1) : decodeAudioData + Map<sampleId, AudioBuffer>.
  }

  unload(_sampleId: string): void {
    // TODO(M1)
  }

  oneShot(_pad: Pad, _page: Page): void {
    // TODO(M1/M2)
  }

  press(_pad: Pad, _page: Page): void {
    // TODO(M2) — Gate : gate on.
  }

  release(_padId: string): void {
    // TODO(M2) — Gate : gate off (fade court).
  }

  toggleLoop(_pad: Pad, _page: Page): void {
    // TODO(M2) — Loop : start/stop.
  }

  stopPad(_padId: string): void {
    // TODO(M2)
  }

  stopPage(_pageId: string): void {
    // TODO(M2)
  }

  /** Abonnement au reflet minimal des voix actives (voir §9, décision B). */
  onPlayingChanged(cb: PlayingChangedCallback): void {
    this.#onPlayingChanged = cb;
  }

  /** Émet le reflet courant vers l'abonné (usage interne aux jalons audio). */
  protected notifyPlayingChanged(activePadIds: Set<string>): void {
    this.#onPlayingChanged?.(activePadIds);
  }
}
