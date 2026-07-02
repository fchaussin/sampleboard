// SPDX-License-Identifier: GPL-3.0-or-later
// Bootstrap : composition root (asynchrone depuis M5 — hydratation) + montage Svelte (§5).
import { mount } from 'svelte';
import App from './App.svelte';
import { createApp } from './app/create-app';
import { t } from './ui/i18n';
import './app.css';

async function bootstrap(): Promise<void> {
  const target = document.getElementById('app');
  if (!target) {
    throw new Error('Cible de montage #app introuvable dans index.html');
  }
  try {
    // Noms par défaut localisés (données créées, pas des libellés d'UI — voir CreateAppOptions).
    const app = await createApp({
      defaultPageName: t('page.defaultName'),
      newPageName: (n) => `${t('page.namePrefix')} ${n}`,
    });
    mount(App, { target, props: { app } });
  } catch (err) {
    target.textContent = t('app.bootError');
    throw err;
  }
}

void bootstrap();
