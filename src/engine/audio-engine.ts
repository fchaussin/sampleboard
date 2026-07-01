// SPDX-License-Identifier: GPL-3.0-or-later
// Moteur audio (Web Audio) — jalon M1 (voir specifications.md §7).
// Responsabilité unique : produire du son à faible latence et gérer les voix.
// Autoritatif sur l'état de jeu éphémère : il notifie les voix actives, ne les duplique pas (§9, décision B).
// TS pur : ne dépend jamais de Svelte.
import type { Pad, Page } from '../domain/types';
import { gainDbToAmplitude, type Voice } from './voice';
import type { EngineState, PlayingChangedCallback } from './types';

/** Rampe de gain courte à l'arrêt d'une voix (anti-clic, voir §7). */
const ANTI_CLICK_FADE_S = 0.008;

export interface AudioEngineOptions {
  /** Fabrique d'AudioContext. Injectable pour les tests ; défaut : `new AudioContext()`. */
  createContext?: () => AudioContext;
}

export class AudioEngine {
  #ctx: AudioContext | null = null;
  readonly #createContext: () => AudioContext;

  /** Buffers décodés, mis en cache par sampleId (voir §7). */
  readonly #buffers = new Map<string, AudioBuffer>();
  /** Voix actives (une par lecture en cours). */
  readonly #voices = new Set<Voice>();

  #onPlayingChanged: PlayingChangedCallback | null = null;

  constructor(options: AudioEngineOptions = {}) {
    this.#createContext = options.createContext ?? (() => new AudioContext());
  }

  /** Crée l'AudioContext au besoin (politique autoplay : au 1er geste utilisateur). */
  #ensureContext(): AudioContext {
    if (!this.#ctx) {
      this.#ctx = this.#createContext();
    }
    return this.#ctx;
  }

  /** À appeler sur le 1er geste utilisateur ; idempotent (voir §7, §12). */
  async resume(): Promise<void> {
    const ctx = this.#ensureContext();
    // Reprend depuis suspended OU interrupted (interruption système mobile) ; jamais si closed.
    if (ctx.state !== 'running' && ctx.state !== 'closed') {
      await ctx.resume();
    }
  }

  get state(): EngineState {
    return this.#ctx?.state ?? 'suspended';
  }

  /** Décode les octets et met le buffer en cache par sampleId (voir §7). */
  async load(sampleId: string, bytes: ArrayBuffer): Promise<void> {
    const ctx = this.#ensureContext();
    // decodeAudioData détache l'ArrayBuffer reçu : on décode sur une copie pour
    // laisser l'appelant libre de réutiliser ses octets.
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    this.#buffers.set(sampleId, buffer);
  }

  unload(sampleId: string): void {
    this.#buffers.delete(sampleId);
  }

  /** Vrai si le buffer d'un sample est déjà décodé/en cache. */
  isLoaded(sampleId: string): boolean {
    return this.#buffers.has(sampleId);
  }

  /**
   * Mode One-Shot : joue le sample en entier. Re-tap → relance depuis 0
   * (arrête d'abord la voix du même pad, jamais deux copies simultanées — voir §7).
   * No-op silencieux si pad vide ou buffer non chargé (voir §12).
   */
  oneShot(pad: Pad, _page: Page): void {
    if (!this.#ctx || pad.sampleId === null) return;
    const buffer = this.#buffers.get(pad.sampleId);
    if (!buffer) return;

    // Re-déclenchement (self) : couper d'abord la propre voix du pad.
    this.#stopPadVoices(pad.id);

    const ctx = this.#ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.value = gainDbToAmplitude(pad.gainDb);

    source.connect(gain).connect(ctx.destination);

    const voice: Voice = { padId: pad.id, source, gain, startedAt: ctx.currentTime };
    source.onended = () => this.#removeVoice(voice);

    this.#voices.add(voice);
    source.start();
    this.#notifyPlayingChanged();
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

  /** Arrête (avec fade anti-clic) toutes les voix d'un pad et les retire du reflet. */
  #stopPadVoices(padId: string): void {
    for (const voice of this.#voices) {
      if (voice.padId === padId) {
        this.#stopVoice(voice);
      }
    }
  }

  /** Rampe le gain d'une voix vers 0 puis stoppe sa source (anti-clic, voir §7). */
  #stopVoice(voice: Voice): void {
    const ctx = this.#ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const param = voice.gain.gain;
    try {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(0, now + ANTI_CLICK_FADE_S);
      voice.source.stop(now + ANTI_CLICK_FADE_S);
    } catch {
      // Source déjà arrêtée : rien à faire, le nettoyage passe par onended.
    }
  }

  /** Retrait d'une voix terminée (onended) : libère les nœuds et rafraîchit le reflet. */
  #removeVoice(voice: Voice): void {
    if (!this.#voices.delete(voice)) return;
    try {
      voice.source.disconnect();
      voice.gain.disconnect();
    } catch {
      // Nœuds déjà déconnectés : sans conséquence.
    }
    this.#notifyPlayingChanged();
  }

  /** Émet l'ensemble courant des pads qui jouent vers l'abonné (voir §9). */
  #notifyPlayingChanged(): void {
    if (!this.#onPlayingChanged) return;
    const activePadIds = new Set<string>();
    for (const voice of this.#voices) {
      activePadIds.add(voice.padId);
    }
    this.#onPlayingChanged(activePadIds);
  }
}
