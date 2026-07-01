<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import type { App } from './app/create-app';
  import { t } from './ui/i18n';

  let { app }: { app: App } = $props();

  // Langue réactive : lue depuis le store (rune settings.locale).
  const locale = $derived(app.store.locale);
</script>

<main>
  <h1>{t('app.name', locale)}</h1>
  <p class="tagline">{t('app.tagline', locale)}</p>
  <p class="greeting">{t('m0.greeting', locale)}</p>
  <p class="hint">{t('m0.hint', locale)}</p>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 100vh;
    padding: 2rem;
    text-align: center;
  }

  h1 {
    margin: 0;
    font-size: 2.4rem;
    letter-spacing: 0.02em;
  }

  .tagline {
    margin: 0;
    color: var(--accent);
  }

  .greeting {
    margin-top: 1.5rem;
    font-weight: 600;
  }

  .hint {
    margin: 0;
    max-width: 32ch;
    color: var(--muted);
    font-size: 0.9rem;
  }
</style>
