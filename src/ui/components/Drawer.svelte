<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Tiroir contextuel (§11) : panneau à droite + voile. Contenus : pad / page / réglages. -->
<script lang="ts">
  import type { App } from '../../app/create-app';
  import { t } from '../i18n';
  import Icon from './Icon.svelte';
  import PadSettings from './PadSettings.svelte';
  import PageSettings from './PageSettings.svelte';
  import Settings from './Settings.svelte';

  let { app }: { app: App } = $props();

  const locale = $derived(app.store.locale);
  const drawer = $derived(app.store.drawer);
  const title = $derived(
    drawer === 'pad'
      ? t('editor.pad.title', locale)
      : drawer === 'page'
        ? t('editor.page.title', locale)
        : t('settings.title', locale),
  );
</script>

{#if drawer}
  <div
    class="backdrop"
    role="presentation"
    onclick={() => app.commands.closeDrawer()}
  ></div>
  <div class="drawer" role="dialog" aria-label={title}>
    <header>
      <h2>{title}</h2>
      <button
        class="close"
        type="button"
        aria-label={t('drawer.close', locale)}
        onclick={() => app.commands.closeDrawer()}
      >
        <Icon name="close" />
      </button>
    </header>
    <div class="content drawer-form">
      {#if drawer === 'pad'}
        <PadSettings {app} />
      {:else if drawer === 'page'}
        <PageSettings {app} />
      {:else}
        <Settings {app} />
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 45%);
    z-index: var(--z-drawer);
  }

  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(340px, 88vw);
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border-left: 1px solid var(--border);
    box-shadow: -12px 0 32px rgb(0 0 0 / 35%);
    z-index: calc(var(--z-drawer) + 1);
    animation: slide-in 0.16s ease-out;
  }

  @keyframes slide-in {
    from {
      transform: translateX(30%);
      opacity: 0.4;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    padding-top: calc(0.75rem + env(safe-area-inset-top));
    border-bottom: 1px solid var(--border);
  }

  h2 {
    margin: 0;
    font-size: 1rem;
  }

  .close {
    display: inline-flex;
    min-width: 40px;
    min-height: 40px;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  }
</style>
