// SPDX-License-Identifier: GPL-3.0-or-later
// Moteur audio (Web Audio) — jalons M1 (One-Shot) + M2 (Gate, Loop, Polyphonie, FIFO).
// Responsabilité unique : produire du son à faible latence et gérer les voix (voir §7).
// Autoritatif sur l'état de jeu éphémère : il notifie les voix actives, ne les duplique pas (§9).
// TS pur : ne dépend jamais de Svelte.
import type { Pad, Page } from '../domain/types';
import { DEFAULT_MAX_VOICES } from '../domain/invariants';
import { gainDbToAmplitude, type Voice } from './voice';
import { computePeaks, pcmDuration } from './pcm';
import { parseOggSampleCount } from './ogg';
import type { PcmData } from './encoder';
import type { DecodedAudio, EngineState, PlayingChangedCallback } from './types';

/** Rampe de gain courte à l'arrêt d'une voix (anti-clic, voir §7). */
const ANTI_CLICK_FADE_S = 0.008;

/** Taille de fenêtre des analyseurs : les visualiseurs lisent `WAVEFORM_SIZE` échantillons. */
export const WAVEFORM_SIZE = 512;

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
  /** Pics de forme d'onde par `${sampleId}:${buckets}` (visualiseurs M6, calcul paresseux). */
  readonly #peaks = new Map<string, Float32Array>();
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

  // --- Bus master ----------------------------------------------------------------------------
  // Point de passage UNIQUE vers la sortie : `master (Gain) → destination`. TOUT ce qui sonne
  // (voix des pads, pré-écoutes) s'y raccorde — jamais à `destination` directement. C'est là
  // que se brancheront gain master / limiteur / visualiseur global.

  #master: GainNode | null = null;
  #masterAnalyser: AnalyserNode | null = null;

  /** Crée le bus master au besoin et renvoie son entrée. */
  #ensureMaster(ctx: AudioContext): AudioNode {
    if (!this.#master) {
      this.#master = ctx.createGain();
      this.#master.connect(ctx.destination);
    }
    return this.#master;
  }

  /**
   * Forme d'onde temps réel du bus master — tout ce qui sonne, voix ET pré-écoutes
   * (visualiseur global). Remplit `out` et renvoie true ; false si rien n'a encore joué.
   * L'analyseur est un tap en DÉRIVATION (le son ne le traverse pas), créé paresseusement
   * au premier appel : zéro coût de rendu tant que personne ne consomme la forme d'onde.
   */
  masterWaveform(out: Float32Array<ArrayBuffer>): boolean {
    const ctx = this.#ctx;
    if (!ctx || !this.#master) return false;
    if (!this.#masterAnalyser) {
      this.#masterAnalyser = ctx.createAnalyser();
      this.#masterAnalyser.fftSize = WAVEFORM_SIZE;
      this.#master.connect(this.#masterAnalyser);
    }
    this.#masterAnalyser.getFloatTimeDomainData(out);
    return true;
  }

  // --- Nettoyage Web Audio tolérant (les nœuds jettent s'ils sont déjà arrêtés/détachés) ----

  #safeStop(source: AudioBufferSourceNode): void {
    try {
      source.stop();
    } catch {
      // déjà arrêtée
    }
  }

  #safeDisconnect(...nodes: AudioNode[]): void {
    for (const node of nodes) {
      try {
        node.disconnect();
      } catch {
        // déjà déconnecté
      }
    }
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
    this.#buffers.set(sampleId, this.#trimToDeclaredLength(ctx, buffer, new Uint8Array(bytes)));
  }

  /** Durée (s) du buffer chargé d'un sample, ou null s'il n'est pas en cache. */
  duration(sampleId: string): number | null {
    return this.#buffers.get(sampleId)?.duration ?? null;
  }

  /**
   * Rogne le buffer décodé à la durée ANNONCÉE par le flux Ogg-Opus (granule finale) :
   * Chromium ignore la fin de flux et restitue le padding de silence de l'encodeur (~100 ms
   * — gap audible en Loop). No-op pour un flux non-Ogg ou déjà fidèle.
   */
  #trimToDeclaredLength(ctx: AudioContext, buffer: AudioBuffer, bytes: Uint8Array): AudioBuffer {
    const declared48k = parseOggSampleCount(bytes);
    if (declared48k === null || declared48k <= 0) return buffer;
    const expected = Math.round((declared48k * buffer.sampleRate) / 48_000);
    if (buffer.length <= expected) return buffer;
    const trimmed = ctx.createBuffer(buffer.numberOfChannels, expected, buffer.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      trimmed.copyToChannel(buffer.getChannelData(channel).slice(0, expected), channel);
    }
    return trimmed;
  }

  unload(sampleId: string): void {
    this.#buffers.delete(sampleId);
    for (const key of this.#peaks.keys()) {
      if (key.startsWith(`${sampleId}:`)) this.#peaks.delete(key);
    }
  }

  /** Vrai si le buffer d'un sample est déjà décodé/en cache. */
  isLoaded(sampleId: string): boolean {
    return this.#buffers.has(sampleId);
  }

  /** Décode des octets audio en PCM (canaux copiés) + durée — sert au pipeline d'import (§13). */
  async decode(bytes: ArrayBuffer): Promise<DecodedAudio> {
    const ctx = this.#ensureContext();
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    const channelData: Float32Array<ArrayBuffer>[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      // Copie : on ne veut pas exposer/détacher le stockage interne de l'AudioBuffer.
      channelData.push(new Float32Array(buffer.getChannelData(c)));
    }
    return { channelData, sampleRate: buffer.sampleRate, durationMs: buffer.duration * 1000 };
  }

  // --- Pré-écoute (bibliothèque, modale de sample, éditeur audio) ---------------------------
  // UN comportement métier, partagé : une seule pré-écoute à la fois dans l'app, jouée une
  // fois sur le bus master (hors pads, hors reflet), REMPLACÉE par la suivante, stoppable.

  #preview: AudioBufferSourceNode | null = null;

  /** Cœur commun : joue un buffer comme pré-écoute courante ; remplace la précédente. */
  #playPreview(ctx: AudioContext, buffer: AudioBuffer, onEnded?: () => void): void {
    this.stopPreview();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.#ensureMaster(ctx));
    source.onended = () => {
      // Garde par IDENTITÉ : le onended (asynchrone) d'une lecture remplacée ou stoppée ne
      // notifie PAS — sinon il effacerait le reflet de la lecture suivante du même sample.
      const isCurrent = this.#preview === source;
      if (isCurrent) this.#preview = null;
      this.#safeDisconnect(source);
      if (isCurrent) onEnded?.();
    };
    this.#preview = source;
    source.start();
  }

  /**
   * Pré-écoute du buffer en cache d'un sample. Renvoie false (no-op) si le buffer n'est pas
   * chargé — la pré-écoute courante n'est alors PAS touchée (l'appelant décide). `onEnded`
   * n'est notifié qu'à la fin NATURELLE de cette lecture (jamais si remplacée ou stoppée).
   */
  previewSample(sampleId: string, onEnded?: () => void): boolean {
    const ctx = this.#ctx;
    if (!ctx) return false;
    const buffer = this.#buffers.get(sampleId);
    if (!buffer) return false;
    this.#playPreview(ctx, buffer, onEnded);
    return true;
  }

  /**
   * Pré-écoute d'un PCM (sélection de l'éditeur M7) — même contrat que previewSample :
   * renvoie false sans lancer si la sélection est vide (mais stoppe la lecture courante,
   * une sélection vide fait office de stop).
   */
  previewPcm(pcm: PcmData, onEnded?: () => void): boolean {
    const ctx = this.#ensureContext();
    const length = pcm.channelData[0]?.length ?? 0;
    if (length === 0 || pcmDuration(pcm) === 0) {
      this.stopPreview();
      return false;
    }

    const buffer = ctx.createBuffer(Math.max(1, pcm.channelData.length), length, pcm.sampleRate);
    pcm.channelData.forEach((data, channel) => buffer.copyToChannel(data, channel));
    this.#playPreview(ctx, buffer, onEnded);
    return true;
  }

  /**
   * Arrête la pré-écoute en cours (no-op sinon). Déconnexion SYNCHRONE : le onended ne tire
   * pas si le contexte se suspend juste après (arrière-plan) — on ne compte pas dessus.
   */
  stopPreview(): void {
    const source = this.#preview;
    this.#preview = null;
    if (!source) return;
    this.#safeStop(source);
    this.#safeDisconnect(source);
  }

  // --- Déclenchements (voir la matrice §7) --------------------------------------------------

  /** One-Shot : joue le sample en entier ; re-tap → relance depuis 0. */
  oneShot(pad: Pad, page: Page): void {
    this.#startVoice(pad, page, { loop: false, sustained: false });
  }

  /** Gate — début (gate on) : joue tant que tenu ; l'arrêt viendra de `release`. */
  press(pad: Pad, page: Page): void {
    this.#startVoice(pad, page, { loop: false, sustained: true });
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
    this.#startVoice(pad, page, { loop: true, sustained: true });
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

  /** Arrête toutes les voix (Arrière-plan 'stopAll', voir §12). */
  stopAll(): void {
    if (this.#stopVoices(() => true)) {
      this.#notifyPlayingChanged();
    }
  }

  /** Arrête les voix entretenues (Gate/Loop) ; laisse finir les One-Shot ('stopSustained'). */
  stopSustained(): void {
    if (this.#stopVoices((v) => v.sustained)) {
      this.#notifyPlayingChanged();
    }
  }

  /** Suspend l'AudioContext (Arrière-plan 'stopAll') ; la reprise passe par `resume()` au geste suivant. */
  async suspend(): Promise<void> {
    const ctx = this.#ctx;
    if (ctx && ctx.state === 'running') {
      await ctx.suspend();
    }
  }

  /** Abonnement au reflet minimal des voix actives (voir §9, décision B). */
  onPlayingChanged(cb: PlayingChangedCallback): void {
    this.#onPlayingChanged = cb;
  }

  /**
   * Forme d'onde temps réel de la voix d'un pad (visualiseurs M6). Remplit `out`
   * (longueur ≤ WAVEFORM_SIZE) et renvoie true, ou false si le pad ne joue pas.
   * Un pad n'a jamais deux voix simultanées (re-déclenchement self, §7).
   */
  waveform(padId: string, out: Float32Array<ArrayBuffer>): boolean {
    for (const voice of this.#voices) {
      if (voice.padId === padId) {
        voice.analyser.getFloatTimeDomainData(out);
        return true;
      }
    }
    return false;
  }

  /**
   * Forme d'onde STATIQUE d'un sample : pic (|amplitude| max, [0,1]) par tranche, sur
   * `buckets` tranches. Calculée au premier appel puis mise en cache ; null si le buffer
   * n'est pas chargé. Sert de fond de barre de progression aux pads (M6).
   */
  peaks(sampleId: string, buckets: number): Float32Array | null {
    const buffer = this.#buffers.get(sampleId);
    if (!buffer || buckets < 1) return null;
    const key = `${sampleId}:${buckets}`;
    const cached = this.#peaks.get(key);
    if (cached) return cached;

    const channels: Float32Array[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
    const out = computePeaks(channels, buckets);
    this.#peaks.set(key, out);
    return out;
  }

  /**
   * Avancement de lecture [0, 1] de la voix d'un pad (barre de progression M6), ou null
   * si le pad ne joue pas. Loop : position dans le cycle courant ; One-Shot/Gate : borné à 1.
   */
  progress(padId: string): number | null {
    const ctx = this.#ctx;
    if (!ctx) return null;
    for (const voice of this.#voices) {
      if (voice.padId !== padId) continue;
      const duration = voice.source.buffer?.duration ?? 0;
      if (duration <= 0) return 0;
      const elapsed = ctx.currentTime - voice.startedAt;
      return voice.source.loop ? (elapsed % duration) / duration : Math.min(1, elapsed / duration);
    }
    return null;
  }

  // --- Interne -----------------------------------------------------------------------------

  /**
   * Démarre une voix pour `pad` (loop ou non). No-op silencieux si pad vide ou buffer non
   * chargé (§12). Applique le choke Mono (§7), le re-déclenchement self, puis le plafond FIFO.
   */
  #startVoice(pad: Pad, page: Page, { loop, sustained }: { loop: boolean; sustained: boolean }): void {
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

    // Analyseur par voix (visualiseurs M6) : transparent pour l'audio, lu à la demande.
    const analyser = ctx.createAnalyser();
    analyser.fftSize = WAVEFORM_SIZE;

    source.connect(gain).connect(analyser).connect(this.#ensureMaster(ctx));

    const voice: Voice = {
      padId: pad.id,
      pageId: page.id,
      source,
      gain,
      analyser,
      startedAt: ctx.currentTime,
      sustained,
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
    this.#safeDisconnect(voice.source, voice.gain, voice.analyser);
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
