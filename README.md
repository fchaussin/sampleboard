<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Sampleboard

**Sampleboard** : application de **pads** déclencheurs de sons (façon soundboard),
organisés en **pages**. Vous importez vos fichiers audio (→ **bibliothèque**) et
configurez vos pads. C'est un *sampleboard*, **pas un sampler** : volontairement simple
(pas de DSP, pas d'édition audio poussée). Cible de distribution : **F-Droid** (Android).

## Stack

Svelte 5 (runes) + Vite en **SPA** (pas de SSR, pas de routeur) · TypeScript **strict** ·
**Tauri v2** (WebView système + noyau Rust minimal) · SQLite natif (`tauri-plugin-sql`) ·
`tauri-plugin-fs` + `tauri-plugin-dialog` · **Web Audio API** · encodage **Opus via WASM
libopus** embarqué. Aucune logique métier en Rust.

Voir [`specifications.md`](./specifications.md) (spec technique + glossaire) et
[`roadmap.md`](./roadmap.md) (jalons, versionnage).

## Architecture

Dépendance à sens unique : `domain ← engine, storage ← app ← ui`. Le cœur
(`domain`/`engine`/`storage`) ne dépend jamais de Svelte. Flux unidirectionnel
`UI → intention → commande → (store + engine + persistance)`. La mutation d'état vit
**uniquement** dans `src/app/commands.ts`. Composition root explicite
(`src/app/create-app.ts`), pas de singletons.

```
src/
├─ domain/   # TS pur : types, enums, invariants
├─ engine/   # Web Audio : moteur, voix, encodeur Opus
├─ storage/  # accès données : db + repositories
├─ app/      # orchestration : store (runes), commandes, persistance, composition root
└─ ui/       # i18n, interactions pad, composants Svelte
src-tauri/   # coquille Tauri v2 (Rust minimal + plugins)
```

## Prérequis

- **Node.js** ≥ 20 et **npm**.
- **Rust** (stable) + cibles Tauri — voir <https://tauri.app/start/prerequisites/>.
  Sur Linux : dépendances système WebKitGTK. Pour Android : SDK/NDK Android.

## Développement

Le développement se fait via `tauri dev` (frontend web dans la WebView native),
**jamais** dans un onglet de navigateur nu (c'est ce qui donne accès à SQLite natif).

```bash
npm install
npm run tauri dev     # lance la fenêtre Tauri (nécessite Rust)
```

Scripts front seuls (sans Rust) :

```bash
npm run dev           # serveur Vite (front uniquement)
npm run build         # build statique dans dist/
npm run check         # svelte-check (types)
```

## i18n

Application multilingue. **Zéro texte en dur** dans le code : uniquement des **clés**
(`t('clé')`). Traductions en JSON par langue dans `src/ui/i18n/` ; **`fr.json` = défaut
et fallback**. Le code et le schéma SQLite sont en anglais neutre.

## Icônes

Les icônes de `src-tauri/icons/` sont des **placeholders**. Les régénérer à partir d'un
vrai logo avec `npm run tauri icon <source.png>`.

## Licence

[GPL-3.0-or-later](./LICENSE). En-têtes `SPDX-License-Identifier: GPL-3.0-or-later`
dans les fichiers source.
