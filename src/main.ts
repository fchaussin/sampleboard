// SPDX-License-Identifier: GPL-3.0-or-later
// Bootstrap : composition root (asynchrone depuis M5 — hydratation) + montage Svelte (§5).
import { isTauri } from '@tauri-apps/api/core';
import { mount } from 'svelte';
import App from './App.svelte';
import { createApp } from './app/create-app';
import { t } from './ui/i18n';
import './app.css';

// PWA (M10, §16) : service worker offline — distribution WEB uniquement (jamais dans la
// WebView Tauri, qui a son propre empaquetage), et en build de prod seulement (le dev
// Vite + un SW qui cache seraient un enfer de fraîcheur).
if (import.meta.env.PROD && !isTauri() && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('pwa: enregistrement du service worker refusé', err);
  });
}

async function bootstrap(): Promise<void> {
  const target = document.getElementById('app');
  if (!target) {
    throw new Error('Cible de montage #app introuvable dans index.html');
  }
  try {
    // Noms par défaut localisés (données créées, pas des libellés d'UI — voir CreateAppOptions).
    const app = await createApp({
      pageName: (rank) => (rank === 1 ? t('page.defaultName') : `${t('page.namePrefix')} ${rank}`),
      // Le token est la clé stable référencée par le manifest des samples d'usine (#14).
      defaultTags: [
        { token: 'sfx', label: t('tag.sfx') },
        { token: 'replies', label: t('tag.replies') },
        { token: 'jingle', label: t('tag.jingle') },
        { token: 'music', label: t('tag.music') },
        { token: 'ambience', label: t('tag.ambience') },
        { token: 'voice', label: t('tag.voice') },
        { token: 'reaction', label: t('tag.reaction') },
        { token: 'meme', label: t('tag.meme') },
        { token: 'alert', label: t('tag.alert') },
      ],
    });
    mount(App, { target, props: { app } });
  } catch (err) {
    target.textContent = t('app.bootError');
    throw err;
  }
}

void bootstrap();
