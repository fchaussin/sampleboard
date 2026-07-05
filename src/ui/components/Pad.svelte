<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Pad « bête ». En Jeu : branche pad-input (matrice §7). En Édition : tap → tiroir pad (§11). -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import type { Pad } from '../../domain/types';
  import type { PadStatus } from '../../domain/enums';
  import {
    padInputAction,
    type PadInputHandlers,
    type PadInputParams,
  } from '../interaction/pad-input';
  import { t } from '../i18n';
  import { carriesSample, droppedSampleId } from '../interaction/sample-dnd';
  import { tintStyle } from '../tint';
  import Icon from './Icon.svelte';
  import PadWaveform from './PadWaveform.svelte';

  let { app, pad }: { app: App; pad: Pad } = $props();

  const locale = $derived(app.store.locale);
  const editMode = $derived(app.store.editMode);
  const selected = $derived(app.store.selectedPadId === pad.id);
  const playing = $derived(app.store.activePadIds.has(pad.id));
  const inLibrary = $derived(
    pad.sampleId !== null && app.store.samples.some((s) => s.id === pad.sampleId),
  );
  // Buffer pas encore décodé (préchargeur #27) : le pad l'affiche au lieu d'être un
  // no-op mystérieux — il redevient « idle » dès que son tour de décodage passe.
  const loading = $derived(
    pad.sampleId !== null && app.store.pendingBufferIds.has(pad.sampleId),
  );
  // active > vide (aucun sample) > introuvable (supprimé) > loading > au repos (§12, Glossaire).
  const status = $derived<PadStatus>(
    playing
      ? 'active'
      : pad.sampleId === null
        ? 'empty'
        : !inLibrary
          ? 'missing'
          : loading
            ? 'loading'
            : 'idle',
  );

  const handlers: PadInputHandlers = {
    fire: (id) => app.commands.firePad(id),
    press: (id) => app.commands.pressPad(id),
    release: (id) => app.commands.releasePad(id),
    toggleLoop: (id) => app.commands.toggleLoopPad(id),
  };

  // Le paramètre est RÉACTIF : la grille étant clée par position, ce composant est réutilisé
  // au changement de page — l'action doit suivre le pad affiché, pas celui du montage.
  function padInput(node: HTMLElement, params: PadInputParams) {
    return padInputAction(node, params, handlers);
  }

  // Teinte de palette (M6) : sans couleur, l'accent reste la teinte par défaut.
  const tint = $derived(tintStyle(pad.color));

  // Stop du pad, en évidence pendant la lecture (One-Shot/Loop). Gate se stoppe au
  // relâchement : pas de bouton.
  const stoppable = $derived(!editMode && playing && pad.playMode !== 'gate');

  // Mode assignation à la volée (M8) : un tap assigne le sample armé, sans jouer.
  const assigning = $derived(app.store.assigningSampleId !== null);

  // Substitut de nom : un pad VIDE (sans sample) n'est pas un pad « sans nom ».
  const displayName = $derived(
    pad.name || (status === 'empty' ? t('pad.empty', locale) : t('pad.untitled', locale)),
  );

  // Cible de dépôt (#18) : en Édition, un sample glissé (pool ou bibliothèque) s'assigne au pad.
  let dropping = $state(false);

  function onDragOver(e: DragEvent): void {
    if (!editMode || !carriesSample(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    dropping = true;
  }

  function onDrop(e: DragEvent): void {
    dropping = false;
    if (!editMode) return;
    const id = droppedSampleId(e);
    if (id === null) return;
    e.preventDefault();
    app.commands.assignSample(pad.id, id);
  }
</script>

<div class="cell" style={tint}>
  {#if assigning}
    <button
      class="pad {status}"
      class:dropping
      data-mode={pad.playMode}
      type="button"
      onclick={() => app.commands.tapAssign(pad.id)}
      ondragover={onDragOver}
      ondragleave={() => (dropping = false)}
      ondrop={onDrop}
    >
      <span class="name">{displayName}</span>
      <span class="mode">{t(`mode.${pad.playMode}`, locale)}</span>
    </button>
  {:else if editMode}
    <button
      class="pad {status} editing"
      class:selected
      class:dropping
      data-mode={pad.playMode}
      type="button"
      onclick={() => app.commands.openPadDrawer(pad.id)}
      ondragover={onDragOver}
      ondragleave={() => (dropping = false)}
      ondrop={onDrop}
    >
      <span class="name">{displayName}</span>
      <span class="mode">{t(`mode.${pad.playMode}`, locale)}</span>
    </button>
  {:else}
    <button
      class="pad {status}"
      data-mode={pad.playMode}
      type="button"
      use:padInput={{ padId: pad.id, playMode: pad.playMode }}
    >
      {#if playing && pad.sampleId !== null}
        <PadWaveform {app} padId={pad.id} sampleId={pad.sampleId} />
      {/if}
      <span class="name">{displayName}</span>
      <span class="mode">{t(`mode.${pad.playMode}`, locale)}</span>
    </button>
    {#if stoppable}
      <button
        class="pad-stop"
        type="button"
        title={t('pad.stop', locale)}
        aria-label={t('pad.stop', locale)}
        onclick={() => app.commands.stopPad(pad.id)}
      >
        <Icon name="stop" size={14} />
      </button>
    {/if}
  {/if}
</div>

<style>
  /* Case de grille : porte la teinte et positionne le stop par-dessus le pad.
     Pas de ratio forcé : la case épouse sa piste de grille (full adaptatif). */
  .cell {
    position: relative;
    min-height: 0;
    min-width: 0;
  }

  /* Survol d'un glissement de sample (#18) : le pad cible se signale. */
  .pad.dropping {
    outline: 3px dashed var(--accent);
    outline-offset: 2px;
  }

  .pad {
    position: relative; /* ancre l'onde (canvas absolu) derrière le texte */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    width: 100%;
    height: 100%;
    padding: 0.4rem;
    /* Couleur du pad : contour PLEIN + fond teinté en TRANSPARENCE (décision M6). */
    border: 2px solid var(--tint, var(--border));
    border-radius: 0.75rem;
    background: color-mix(in oklab, var(--tint, transparent) 16%, transparent);
    color: inherit;
    font: inherit;
    cursor: pointer;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    /* L'opacité/intensité REFLÈTE l'état de lecture : montée instantanée au déclenchement,
       retombée douce à l'arrêt (feel de relâchement). */
    transition:
      transform 0.05s ease,
      background 0.25s ease-out,
      border-color 0.25s ease-out,
      box-shadow 0.25s ease-out,
      opacity 0.25s ease-out;
  }

  /* Nom au-dessus du Mode de lecture, toujours plus opaque que lui (décision M6). */
  .name {
    font-weight: 400;
    font-size: 0.9rem;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    position: relative; /* au-dessus de l'onde */
  }

  .mode {
    font-size: 0.7rem;
    color: var(--muted);
    opacity: 0.75;
    position: relative; /* au-dessus de l'onde */
  }

  /* Sample affecté : nom en GRAS. */
  .pad.idle .name,
  .pad.active .name,
  .pad.missing .name {
    font-weight: 700;
  }

  /* Vide : nom en italique semi-transparent. */
  .pad.empty .name {
    font-style: italic;
    opacity: 0.55;
  }

  /* Un sample est assigné : fond nettement plus opaque que les pads vides. */
  .pad.idle {
    background: color-mix(in oklab, var(--tint, var(--accent)) 45%, transparent);
  }

  /* Vide : visible et coloré (board complet), simplement en retrait. */
  .pad.empty {
    opacity: 0.7;
  }

  .pad.missing {
    border-color: var(--danger);
    border-style: dashed;
  }

  /* Buffer en cours de décodage (#27) : pad présent mais en retrait, PULSATION discrète —
     jamais un pad silencieux sans explication. Redevient « idle » une fois décodé. */
  .pad.loading {
    animation: pad-loading 1.1s ease-in-out infinite;
  }

  .pad.loading .name {
    font-weight: 700;
  }

  @keyframes pad-loading {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 0.65;
    }
  }

  /* EN LECTURE : intensité maximale — fond plein, halo, montée sans transition. */
  .pad.active {
    background: var(--tint, var(--accent));
    border-color: var(--tint, var(--accent));
    color: var(--accent-contrast);
    transform: scale(0.97);
    box-shadow: 0 0 1.125rem color-mix(in oklab, var(--tint, var(--accent)) 55%, transparent);
    transition-duration: 0.03s;
  }

  .pad.active .mode {
    color: var(--accent-contrast);
  }

  .pad.selected {
    outline: 3px solid var(--tint, var(--accent));
    outline-offset: 2px;
    opacity: 1;
  }

  /* ÉDITION : coloration franche et UNIFORME façon mode MIDI-map (Ableton) — aplats
     violets saturés identiques pour tous les pads, le mode est immanquable. */
  .pad.editing {
    background: color-mix(in oklab, var(--c-violet) 60%, var(--bg));
    border-color: var(--c-violet);
    color: var(--fg);
    opacity: 1;
  }

  .pad.editing .name {
    opacity: 1;
    font-style: normal;
  }

  .pad.editing .mode {
    color: color-mix(in oklab, var(--fg) 70%, var(--c-violet));
    opacity: 1;
  }

  /* Stop du pad EN ÉVIDENCE en bas à droite pendant la lecture (One-Shot/Loop). */
  .pad-stop {
    position: absolute;
    right: 0.375rem;
    bottom: 0.375rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.875rem;
    min-height: 1.875rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--accent-contrast);
    color: var(--fg);
    cursor: pointer;
    box-shadow: 0 2px 0.5rem rgb(0 0 0 / 45%);
  }
</style>
