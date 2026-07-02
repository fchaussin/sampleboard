<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Sélecteur de couleur de palette (M6) : pastilles des tokens COLORS + « neutre ».
     Utilisé par PadSettings et PageSettings. -->
<script lang="ts">
  import { COLORS, type Color } from '../../domain/enums';
  import { t } from '../i18n';

  let {
    value,
    locale,
    onchange,
  }: {
    value: Color | null | undefined;
    locale: string;
    onchange: (color: Color | null) => void;
  } = $props();
</script>

<div class="swatches" role="radiogroup" aria-label={t('editor.color', locale)}>
  <button
    class="swatch none"
    class:selected={!value}
    type="button"
    role="radio"
    aria-checked={!value}
    title={t('color.none', locale)}
    aria-label={t('color.none', locale)}
    onclick={() => onchange(null)}
  ></button>
  {#each COLORS as color (color)}
    <button
      class="swatch"
      class:selected={value === color}
      type="button"
      role="radio"
      aria-checked={value === color}
      title={t(`color.${color}`, locale)}
      aria-label={t(`color.${color}`, locale)}
      style="--swatch: var(--c-{color})"
      onclick={() => onchange(color)}
    ></button>
  {/each}
</div>

<style>
  .swatches {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .swatch {
    width: 1.625rem;
    height: 1.625rem;
    border-radius: 50%;
    border: 2px solid transparent;
    background: var(--swatch);
    cursor: pointer;
    padding: 0;
  }

  .swatch.none {
    background: transparent;
    border-color: var(--border);
    position: relative;
  }

  /* Barre oblique du « neutre » (aucune couleur). */
  .swatch.none::after {
    content: '';
    position: absolute;
    inset: 0.25rem;
    border-radius: 50%;
    background: linear-gradient(135deg, transparent 44%, var(--muted) 46%, var(--muted) 54%, transparent 56%);
  }

  .swatch.selected {
    outline: 2px solid var(--fg);
    outline-offset: 2px;
  }
</style>
