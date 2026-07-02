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
      pageName: (rank) => (rank === 1 ? t('page.defaultName') : `${t('page.namePrefix')} ${rank}`),
      defaultTagLabels: [
        t('tag.sfx'),
        t('tag.replies'),
        t('tag.jingle'),
        t('tag.music'),
        t('tag.ambience'),
        t('tag.voice'),
        t('tag.reaction'),
        t('tag.meme'),
        t('tag.alert'),
      ],
    });
    mount(App, { target, props: { app } });
  } catch (err) {
    target.textContent = t('app.bootError');
    throw err;
  }
}

void bootstrap();
