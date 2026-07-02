<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Audio Sample Board

**Audio Sample Board** : application de **pads** déclencheurs de sons (façon soundboard),
organisés en **pages**. Vous importez vos fichiers audio (→ **bibliothèque**) et
configurez vos pads. C'est un *audio-sample-board*, **pas un sampler** : volontairement simple
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

## Développement — via Docker (recommandé, hôte propre)

**Toute la toolchain (Node, Rust, dépendances Tauri) vit dans l'image Docker.**
Rien ne s'installe sur l'hôte : `node_modules`, `src-tauri/target` et les caches cargo/npm
sont des **volumes Docker**. Deux environnements séparés : **dev** et **prod**.

- **Rootless** : conçu pour Docker rootless ; le conteneur tourne en root‑conteneur = ton
  user hôte **non privilégié**. Le non‑privilège vient du moteur rootless.
- **Durci** : `cap_drop: ALL` + `no-new-privileges` partout ; source en lecture seule pour
  la prod (build déterministe).
- **Portable** : multi‑arch (amd64/arm64), UID/GID paramétrables, Docker rootful/rootless
  ou Podman.

```bash
cp .env.example .env    # optionnel (UID/GID) ; défaut 1000

# Dev
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml run --rm dev npm run check   # types
docker compose -f docker-compose.dev.yml up dev                       # Vite -> localhost:1420

# Fenêtre Tauri desktop (serveur X requis ; sinon `xhost +local:`)
docker compose -f docker-compose.dev.yml -f docker-compose.gui.yml run --rm dev npm run tauri dev

# Prod (build release reproductible -> ./artifacts)
mkdir -p artifacts && docker compose -f docker-compose.prod.yml run --rm prod
```

Détails complets : **[`doc/environnement-docker.md`](./doc/environnement-docker.md)**.

> Le développement se fait via `tauri dev` (frontend web dans la WebView native),
> **jamais** dans un onglet de navigateur nu (c'est ce qui donne accès à SQLite natif).

## Développement — sans Docker (hôte)

Si tu préfères outiller l'hôte : **Node.js** ≥ 20, **npm**, et **Rust** (stable) +
dépendances système Tauri (WebKitGTK sur Linux) — voir
<https://tauri.app/start/prerequisites/>. Puis `npm install` et `npm run tauri dev`.

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
