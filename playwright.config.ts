// SPDX-License-Identifier: GPL-3.0-or-later
// Tests E2E (Playwright, Chromium) — exercent le VRAI navigateur : Web Audio, Worker WASM
// (encodeur Opus), import réel. Complètent les tests unitaires Vitest (logique pure, mocks).
// Exécution en Docker via l'image officielle Playwright (voir docker-compose.e2e.yml).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'retain-on-failure',
    // Chromium tourne en root dans le conteneur : sandbox off + /dev/shm évité.
    launchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Le serveur Vite est démarré par Playwright lui-même (réutilise s'il tourne déjà).
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
