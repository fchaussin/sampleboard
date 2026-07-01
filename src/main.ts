// SPDX-License-Identifier: GPL-3.0-or-later
// Bootstrap : composition root + montage Svelte (voir specifications.md §5).
import { mount } from 'svelte';
import App from './App.svelte';
import { createApp } from './app/create-app';
import './app.css';

const app = createApp();

const target = document.getElementById('app');
if (!target) {
  throw new Error('Cible de montage #app introuvable dans index.html');
}

const ui = mount(App, { target, props: { app } });

export default ui;
