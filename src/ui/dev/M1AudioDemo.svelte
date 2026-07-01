<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!--
  TEMP(M1) : harnais de validation du moteur audio (roadmap M1).
  Un pad codé en dur qui joue un buffer importé (One-Shot). L'import réel (dialog Tauri,
  ré-encodage Opus, bibliothèque) arrive au M4 ; ici on lit les octets via l'API File du
  navigateur pour rester testable en Vite nu ET dans la WebView Tauri (Android).
  Ce composant sera retiré quand PadGrid/Library réels arriveront (M2/M3/M4).
-->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { M1_DEMO_PAD_ID } from '../../app/commands';
  import { t } from '../i18n';

  let { app }: { app: App } = $props();

  const locale = $derived(app.store.locale);
  const playing = $derived(app.store.activePadIds.has(M1_DEMO_PAD_ID));

  let loaded = $state(false);
  let loading = $state(false);
  let errored = $state(false);
  let sampleName = $state('');

  async function onFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    loading = true;
    errored = false;
    try {
      // Le choix de fichier est un geste utilisateur : on en profite pour reprendre l'audio.
      await app.commands.resumeAudio();
      const bytes = await file.arrayBuffer();
      await app.commands.loadDemoSound(bytes);
      sampleName = file.name;
      loaded = true;
    } catch {
      errored = true;
      loaded = false;
    } finally {
      loading = false;
      input.value = ''; // autorise le rechargement du même fichier
    }
  }

  async function onPad(): Promise<void> {
    await app.commands.resumeAudio();
    app.commands.fireDemoPad();
  }
</script>

<section class="demo">
  <h2>{t('m1.demo.title', locale)}</h2>
  <p class="hint">{t('m1.demo.hint', locale)}</p>

  <label class="load">
    <span>{loading ? t('m1.demo.loading', locale) : t('m1.demo.load', locale)}</span>
    <input type="file" accept="audio/*" onchange={onFile} disabled={loading} />
  </label>

  {#if errored}
    <p class="status error">{t('m1.demo.error', locale)}</p>
  {:else if loaded}
    <p class="status">{t('m1.demo.loadedPrefix', locale)} {sampleName}</p>
  {:else}
    <p class="status muted">{t('m1.demo.empty', locale)}</p>
  {/if}

  <button class="pad" class:playing onclick={onPad} disabled={!loaded}>
    {playing ? t('m1.demo.playing', locale) : t('m1.demo.pad', locale)}
  </button>
</section>

<style>
  .demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin-top: 2rem;
    padding: 1.5rem;
    border: 1px solid var(--muted);
    border-radius: 12px;
    max-width: 32ch;
  }

  h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
    text-align: center;
  }

  .load {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
  }

  .load span {
    padding: 0.4rem 0.9rem;
    border: 1px solid var(--accent);
    border-radius: 8px;
    color: var(--accent);
    font-size: 0.9rem;
  }

  .load input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .status {
    margin: 0;
    font-size: 0.85rem;
    min-height: 1.2em;
    text-align: center;
    word-break: break-all;
  }

  .status.muted {
    color: var(--muted);
  }

  .status.error {
    color: #e0574f;
  }

  .pad {
    width: 8rem;
    height: 8rem;
    border-radius: 16px;
    border: 2px solid var(--accent);
    background: transparent;
    color: var(--fg, inherit);
    font-size: 1rem;
    cursor: pointer;
    transition: transform 0.05s ease, background 0.1s ease;
  }

  .pad:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .pad.playing {
    background: var(--accent);
    color: #101014;
    transform: scale(0.97);
  }
</style>
