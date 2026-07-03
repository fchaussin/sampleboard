<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Bouton de pré-écoute PARTAGÉ (bibliothèque, modale de sample) : ▶ bascule en ■ pendant
     la lecture. L'état vient du store (previewingSampleId), la logique de `previewSample`
     (bascule, remplacement, stop par toute autre action) vit dans commands.ts. Style :
     classe globale .icon-action (app.css), commune aux autres boutons d'action de ligne. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  let { app, sampleId, size = 16 }: { app: App; sampleId: string; size?: number } = $props();
  const locale = $derived(app.store.locale);
  const playing = $derived(app.store.previewingSampleId === sampleId);
  const label = $derived(t(playing ? 'library.stopPreview' : 'library.preview', locale));
</script>

<button
  type="button"
  class="icon-action preview"
  class:active={playing}
  title={label}
  aria-label={label}
  aria-pressed={playing}
  onclick={() => app.commands.previewSample(sampleId)}
>
  <Icon name={playing ? 'stop' : 'play'} {size} />
</button>
