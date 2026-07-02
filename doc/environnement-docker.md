<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Environnement Docker (dev / prod)

Toute la toolchain (Node, Rust, dépendances Tauri) vit dans des images Docker. **Rien ne
s'installe sur l'hôte** : `node_modules`, `src-tauri/target` et les caches cargo/npm sont
des **volumes Docker**. Deux environnements séparés : **dev** et **prod**.

## Principes

- **Rootless** : conçu pour Docker rootless. Le conteneur tourne en *root du conteneur*,
  qui correspond à ton utilisateur hôte **non privilégié** (mapping rootless). C'est le
  moteur rootless qui garantit le non-privilège, pas l'uid interne — ce qui évite aussi les
  conflits de permissions sur les fichiers bind-montés.
- **Durci** : `cap_drop: ALL` + `no-new-privileges` partout, `tmpfs /tmp`, et **source en
  lecture seule** pour la prod (build déterministe).
- **Portable** : image multi-arch (amd64/arm64), UID/GID paramétrables (`.env`), compatible
  Docker rootful/rootless et Podman.
- **Hôte rootful** : décommenter `user:` dans `docker-compose.dev.yml` pour ne pas être
  vraiment root.

## Fichiers

| Fichier | Rôle |
|---|---|
| `docker/Dockerfile` | Multi-étages : `base` (toolchain) → `dev`, `prod`. |
| `docker/entrypoint.sh` | Installe les deps npm (`npm ci`) dans le volume au 1er lancement. |
| `docker-compose.dev.yml` | Service **dev** (Vite HMR, `tauri dev`). |
| `docker-compose.prod.yml` | Service **prod** (build release → `./artifacts`). |
| `docker-compose.gui.yml` | Overlay X11 pour ouvrir la fenêtre `tauri dev`. |
| `.env.example` | UID/GID (portabilité) — `cp .env.example .env`. |

## Développement

```bash
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml run --rm dev npm run check   # types
docker compose -f docker-compose.dev.yml up dev                       # Vite -> localhost:1420
docker compose -f docker-compose.dev.yml run --rm dev bash            # shell
```

Fenêtre **Tauri desktop** (serveur X requis ; WSLg ou Linux+X, sinon `xhost +local:`) :

```bash
docker compose -f docker-compose.dev.yml -f docker-compose.gui.yml run --rm dev npm run tauri dev
```

Depuis M5 :

- **Données de l'app persistées** : le volume **`app-home`** (`/home/app`) porte la base SQLite
  (`~/.config/org.sampleboard.app/sampleboard.db`) et les fichiers audio
  (`~/.local/share/org.sampleboard.app/audio/`) — banque, bibliothèque et réglages survivent
  aux `run --rm`. Repartir de zéro : `docker volume rm ambianceur_app-home`.
- **Audio** : l'overlay GUI exporte `PULSE_SERVER` vers le socket PulseAudio de WSLg
  (`/mnt/wslg/PulseServer`, déjà bind-monté) — sans lui, WebKitGTK n'a aucune sortie et les
  pads restent muets. Linux natif : `PULSE_SERVER=unix:$XDG_RUNTIME_DIR/pulse/native` dans
  l'environnement avant `docker compose`.

## Production (build d'artefacts)

Sampleboard est une app **cliente** : « prod » ne fait pas tourner un serveur, il **produit
l'artefact** puis s'arrête.

```bash
mkdir -p artifacts
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm prod
# -> front prod dans ./artifacts/ ; binaire release dans le volume prod-target.
```

Le bundling complet F-Droid/APK (Android SDK/NDK) sera branché au jalon **M6**.

## Prérequis (une fois, hôte)

Docker rootless. Prérequis système : `uidmap`, `slirp4netns`, `dbus-user-session` (seuls
paquets root, génériques à tout conteneur rootless), puis Docker rootless installé dans
`$HOME` (`get.docker.com/rootless`). Voir aussi le `README.md` racine.

## Nettoyage

```bash
docker compose -f docker-compose.dev.yml down -v    # + volumes dev
docker image rm sampleboard-dev sampleboard-prod
```
