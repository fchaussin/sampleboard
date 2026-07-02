<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Pad « bête ». En Jeu : branche pad-input (matrice §7). En Édition : tap → tiroir pad (§11). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { Pad } from '../../domain/types';
  import { attachPadInput, type PadInputHandlers } from '../interaction/pad-input';
  import { t } from '../i18n';
  import { tintStyle } from '../tint';

  let { app, pad }: { app: App; pad: Pad } = $props();

  const locale = $derived(app.store.locale);
  const editMode = $derived(app.store.editMode);
  const selected = $derived(app.store.selectedPadId === pad.id);
  const playing = $derived(app.store.activePadIds.has(pad.id));
  const inLibrary = $derived(
    pad.sampleId !== null && app.store.samples.some((s) => s.id === pad.sampleId),
  );
  // active > vide (aucun sample) > introuvable (sample supprimé) > au repos (§12, Glossaire).
  const status = $derived(
    playing ? 'active' : pad.sampleId === null ? 'empty' : inLibrary ? 'idle' : 'missing',
  );

  const handlers: PadInputHandlers = {
    fire: (id) => app.commands.firePad(id),
    press: (id) => app.commands.pressPad(id),
    release: (id) => app.commands.releasePad(id),
    toggleLoop: (id) => app.commands.toggleLoopPad(id),
  };

  function padInput(node: HTMLElement) {
    return { destroy: attachPadInput(node, pad.id, pad.playMode, handlers) };
  }

  // Teinte de palette (M6) : sans couleur, l'accent reste la teinte par défaut.
  const tint = $derived(tintStyle(pad.color));
</script>

{#if editMode}
  <button
    class="pad {status}"
    class:selected
    data-mode={pad.playMode}
    type="button"
    style={tint}
    onclick={() => app.commands.openPadDrawer(pad.id)}
  >
    <span class="name">{pad.name || t('pad.untitled', locale)}</span>
    <span class="mode">{t(`mode.${pad.playMode}`, locale)}</span>
  </button>
{:else}
  <button class="pad {status}" data-mode={pad.playMode} type="button" style={tint} use:padInput>
    <span class="name">{pad.name}</span>
    <span class="mode">{t(`mode.${pad.playMode}`, locale)}</span>
  </button>
{/if}

<style>
  .pad {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    aspect-ratio: 1;
    padding: 0.4rem;
    border: 2px solid var(--muted);
    border-radius: 12px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    transition: transform 0.05s ease, background 0.08s ease, border-color 0.08s ease;
  }

  .name {
    font-weight: 600;
    font-size: 0.9rem;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .mode {
    font-size: 0.7rem;
    color: var(--muted);
  }

  .pad.idle {
    border-color: var(--tint, var(--accent));
  }

  .pad.empty {
    opacity: 0.4;
  }

  .pad.missing {
    border-color: #e0574f;
    border-style: dashed;
  }

  .pad.active {
    background: var(--tint, var(--accent));
    border-color: var(--tint, var(--accent));
    color: var(--accent-contrast);
    transform: scale(0.97);
  }

  .pad.active .mode {
    color: var(--accent-contrast);
  }

  .pad.selected {
    outline: 3px solid var(--tint, var(--accent));
    outline-offset: 2px;
    opacity: 1;
  }
</style>
