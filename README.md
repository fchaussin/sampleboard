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

## Développement — via Docker (recommandé, hôte propre)

**Toute la toolchain (Node, Rust, dépendances Tauri) vit dans l'image Docker.**
Rien ne s'installe sur l'hôte : `node_modules`, `src-tauri/target` et les caches cargo/npm
sont des **volumes Docker** montés par-dessus le code (voir `docker-compose.yml`).

Propriétés de l'environnement :

- **Non-root** : le conteneur tourne sous un UID/GID non privilégié, aligné sur l'hôte.
- **Capabilities minimales** : `cap_drop: ALL` + `no-new-privileges` (dev et build n'en
  ont besoin d'aucune) ; le service `build` va jusqu'au rootfs en lecture seule.
- **Portable** : image multi-arch (amd64/arm64), UID/GID paramétrables, compatible Docker
  (rootful/rootless) et Podman, sans chemin spécifique à l'hôte.

Prérequis : **Docker** (+ Compose v2) ou Podman. Sous Windows/WSL2 : activer l'intégration
WSL dans Docker Desktop.

```bash
# Portabilité : aligne l'utilisateur du conteneur sur ton hôte
cp .env.example .env            # puis, au besoin : UID=$(id -u)  GID=$(id -g)

docker compose build                          # construit l'image
docker compose run --rm dev npm run check     # types (svelte-check)
docker compose up dev                         # serveur Vite -> http://localhost:1420
docker compose run --rm dev bash              # shell non-root interactif

# Build de production reproductible -> artefacts dans ./artifacts/
docker compose run --rm build
```

Fenêtre **Tauri desktop** (`npm run tauri dev`) : nécessite un serveur X. Utilise
l'overlay GUI `docker-compose.gui.yml` (WSLg ou Linux + X ; sur Linux natif : `xhost +local:`) :

```bash
docker compose -f docker-compose.yml -f docker-compose.gui.yml run --rm dev npm run tauri dev
```

> Le développement se fait via `tauri dev` (frontend web dans la WebView native),
> **jamais** dans un onglet de navigateur nu (c'est ce qui donne accès à SQLite natif).
> Le serveur Vite seul (`npm run dev`) sert à l'itération front uniquement.

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
