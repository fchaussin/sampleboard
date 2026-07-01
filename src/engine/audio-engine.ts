// SPDX-License-Identifier: GPL-3.0-or-later
// Moteur audio (Web Audio) — jalons M1 (One-Shot) + M2 (Gate, Loop, Polyphonie, FIFO).
// Responsabilité unique : produire du son à faible latence et gérer les voix (voir §7).
// Autoritatif sur l'état de jeu éphémère : il notifie les voix actives, ne les duplique pas (§9).
// TS pur : ne dépend jamais de Svelte.
import type { Pad, Page } from '../domain/types';
import { DEFAULT_MAX_VOICES } from '../domain/invariants';
import { gainDbToAmplitude, type Voice } from './voice';
import type { DecodedAudio, EngineState, PlayingChangedCallback } from './types';

/** Rampe de gain courte à l'arrêt d'une voix (anti-clic, voir §7). */
const ANTI_CLICK_FADE_S = 0.008;

export interface AudioEngineOptions {
  /** Fabrique d'AudioContext. Injectable pour les tests ; défaut : `new AudioContext()`. */
  createContext?: () => AudioContext;
  /** Plafond global de voix, lu à chaque déclenchement (voir §7). Défaut : 8. */
  getMaxVoices?: () => number;
}

export class AudioEngine {
  #ctx: AudioContext | null = null;
  readonly #createContext: () => AudioContext;
  readonly #getMaxVoices: () => number;

  /** Buffers décodés, mis en cache par sampleId (voir §7). */
  readonly #buffers = new Map<string, AudioBuffer>();
  /** Voix actives (une par lecture en cours), dans l'ordre d'insertion (FIFO). */
  readonly #voices = new Set<Voice>();

  #onPlayingChanged: PlayingChangedCallback | null = null;

  constructor(options: AudioEngineOptions = {}) {
    this.#createContext = options.createContext ?? (() => new AudioContext());
    this.#getMaxVoices = options.getMaxVoices ?? (() => DEFAULT_MAX_VOICES);
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

  /** Décode des octets audio en PCM (canaux copiés) + durée — sert au pipeline d'import (§13). */
  async decode(bytes: ArrayBuffer): Promise<DecodedAudio> {
    const ctx = this.#ensureContext();
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    const channelData: Float32Array[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      // Copie : on ne veut pas exposer/détacher le stockage interne de l'AudioBuffer.
      channelData.push(new Float32Array(buffer.getChannelData(c)));
    }
    return { channelData, sampleRate: buffer.sampleRate, durationMs: buffer.duration * 1000 };
  }

  /** Pré-écoute : joue une fois le buffer d'un sample (hors pads, hors reflet). No-op si absent. */
  previewSample(sampleId: string): void {
    const ctx = this.#ctx;
    if (!ctx) return;
    const buffer = this.#buffers.get(sampleId);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      try {
        source.disconnect();
      } catch {
        // déjà déconnecté
      }
    };
    source.start();
  }

  // --- Déclenchements (voir la matrice §7) --------------------------------------------------

  /** One-Shot : joue le sample en entier ; re-tap → relance depuis 0. */
  oneShot(pad: Pad, page: Page): void {
    this.#startVoice(pad, page, false);
  }

  /** Gate — début (gate on) : joue tant que tenu ; l'arrêt viendra de `release`. */
  press(pad: Pad, page: Page): void {
    this.#startVoice(pad, page, false);
  }

  /** Gate — fin (gate off) : arrête la voix du pad (fade court). */
  release(padId: string): void {
    if (this.#stopVoices((v) => v.padId === padId)) {
      this.#notifyPlayingChanged();
    }
  }

  /** Loop — tap → boucle ; re-tap → stop. */
  toggleLoop(pad: Pad, page: Page): void {
    if (!this.#ctx) return;
    const playing = this.#some((v) => v.padId === pad.id);
    if (playing) {
      if (this.#stopVoices((v) => v.padId === pad.id)) this.#notifyPlayingChanged();
      return;
    }
    this.#startVoice(pad, page, true);
  }

  stopPad(padId: string): void {
    if (this.#stopVoices((v) => v.padId === padId)) {
      this.#notifyPlayingChanged();
    }
  }

  stopPage(pageId: string): void {
    if (this.#stopVoices((v) => v.pageId === pageId)) {
      this.#notifyPlayingChanged();
    }
  }

  /** Abonnement au reflet minimal des voix actives (voir §9, décision B). */
  onPlayingChanged(cb: PlayingChangedCallback): void {
    this.#onPlayingChanged = cb;
  }

  // --- Interne -----------------------------------------------------------------------------

  /**
   * Démarre une voix pour `pad` (loop ou non). No-op silencieux si pad vide ou buffer non
   * chargé (§12). Applique le choke Mono (§7), le re-déclenchement self, puis le plafond FIFO.
   */
  #startVoice(pad: Pad, page: Page, loop: boolean): void {
    const ctx = this.#ctx;
    if (!ctx || pad.sampleId === null) return;
    const buffer = this.#buffers.get(pad.sampleId);
    if (!buffer) return;

    // Choke Mono : démarrer un pad arrête les autres voix de CETTE page.
    if (page.voiceMode === 'mono') {
      this.#stopVoices((v) => v.pageId === page.id && v.padId !== pad.id);
    }
    // Re-déclenchement (self) : jamais deux copies simultanées du même pad.
    this.#stopVoices((v) => v.padId === pad.id);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;

    const gain = ctx.createGain();
    gain.gain.value = gainDbToAmplitude(pad.gainDb);

    source.connect(gain).connect(ctx.destination);

    const voice: Voice = {
      padId: pad.id,
      pageId: page.id,
      source,
      gain,
      startedAt: ctx.currentTime,
    };
    source.onended = () => this.#removeVoice(voice);

    this.#voices.add(voice);
    source.start();

    this.#enforceMaxVoices();
    this.#notifyPlayingChanged();
  }

  /** Plafond global : au dépassement, retire la voix la plus ancienne (FIFO, fade court). */
  #enforceMaxVoices(): void {
    const max = Math.max(1, Math.trunc(this.#getMaxVoices()));
    while (this.#voices.size > max) {
      // Set conserve l'ordre d'insertion : le premier élément est le plus ancien.
      const oldest = this.#voices.values().next().value;
      if (!oldest) break;
      this.#stopVoice(oldest);
    }
  }

  #some(predicate: (voice: Voice) => boolean): boolean {
    for (const voice of this.#voices) {
      if (predicate(voice)) return true;
    }
    return false;
  }

  /** Arrête (fade anti-clic) toutes les voix satisfaisant `predicate`. Renvoie le nb arrêté. */
  #stopVoices(predicate: (voice: Voice) => boolean): number {
    let count = 0;
    for (const voice of [...this.#voices]) {
      if (predicate(voice)) {
        this.#stopVoice(voice);
        count++;
      }
    }
    return count;
  }

  /**
   * Rampe le gain d'une voix vers 0 puis stoppe sa source (anti-clic, voir §7).
   * Retire immédiatement la voix du reflet (le fade audio, lui, dure ~8 ms) ; ne notifie pas
   * (les appelants notifient une fois par lot).
   */
  #stopVoice(voice: Voice): void {
    if (!this.#voices.delete(voice)) return;
    const ctx = this.#ctx;
    // Après suppression, la fin naturelle ne doit plus re-notifier : nettoyage seul.
    voice.source.onended = () => this.#disconnect(voice);
    if (!ctx) {
      this.#disconnect(voice);
      return;
    }
    const now = ctx.currentTime;
    const param = voice.gain.gain;
    try {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(0, now + ANTI_CLICK_FADE_S);
      voice.source.stop(now + ANTI_CLICK_FADE_S);
    } catch {
      // Source déjà arrêtée : le nettoyage passe par onended.
    }
  }

  /** Retrait d'une voix terminée naturellement (onended) : nettoie et rafraîchit le reflet. */
  #removeVoice(voice: Voice): void {
    if (!this.#voices.delete(voice)) return;
    this.#disconnect(voice);
    this.#notifyPlayingChanged();
  }

  #disconnect(voice: Voice): void {
    try {
      voice.source.disconnect();
      voice.gain.disconnect();
    } catch {
      // Nœuds déjà déconnectés : sans conséquence.
    }
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
