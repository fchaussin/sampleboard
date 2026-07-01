<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import type { App } from './app/create-app';
  import { t } from './ui/i18n';
  import PageTabs from './ui/components/PageTabs.svelte';
  import PadGrid from './ui/components/PadGrid.svelte';
  import M2SampleLoader from './ui/dev/M2SampleLoader.svelte';

  let { app }: { app: App } = $props();

  // Langue réactive : lue depuis le store (rune settings.locale).
  const locale = $derived(app.store.locale);
</script>

<main>
  <header>
    <h1>{t('app.name', locale)}</h1>
    <p class="tagline">{t('app.tagline', locale)}</p>
  </header>

  <M2SampleLoader {app} />
  <PageTabs {app} />
  <PadGrid {app} />
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 100vh;
    padding: 1.5rem;
    box-sizing: border-box;
  }

  header {
    text-align: center;
  }

  h1 {
    margin: 0;
    font-size: 1.8rem;
    letter-spacing: 0.02em;
  }

  .tagline {
    margin: 0.2rem 0 0;
    color: var(--accent);
    font-size: 0.9rem;
  }
</style>
