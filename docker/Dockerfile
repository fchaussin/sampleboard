# SPDX-License-Identifier: GPL-3.0-or-later
# syntax=docker/dockerfile:1
#
# Image Sampleboard multi-étages, pensée pour Docker ROOTLESS.
# Toolchain (Node + Rust + deps système Tauri v2) dans l'image ; les dossiers lourds
# (node_modules, src-tauri/target, caches cargo/npm) vivent dans des volumes Docker.
# L'hôte n'est jamais pollué ; le non-privilège vient du moteur rootless (voir docker-compose.yml).

############################################
# base — toolchain commune (exécution en root du conteneur = user hôte en rootless)
############################################
FROM node:22-bookworm-slim AS base

# UID/GID alignés sur l'hôte pour des fichiers de bind-mount à ton nom.
ARG UID=1000
ARG GID=1000

ENV DEBIAN_FRONTEND=noninteractive \
    HOME=/home/app \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    NPM_CONFIG_CACHE=/home/app/.npm \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    PATH=/usr/local/cargo/bin:$PATH

# Dépendances système Tauri v2 (WebKitGTK + build). Cache apt purgé -> image propre.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      curl \
      file \
      git \
      libayatana-appindicator3-dev \
      librsvg2-dev \
      libssl-dev \
      libwebkit2gtk-4.1-dev \
      libxdo-dev \
      pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Toolchain Rust stable (profil minimal).
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
      | sh -s -- -y --profile minimal --default-toolchain stable

# Modèle rootless : le conteneur tourne en root, qui correspond à ton utilisateur
# NON privilégié côté hôte (mapping rootless). Répertoires et volumes appartiennent donc
# à root -> écriture des bind-mounts hôte ET des volumes sans conflit d'uid, tout en gardant
# cap_drop:ALL + no-new-privileges (le non-privilège vient du rootless, pas de l'uid interne).
# (Hôte rootful : surcharger `user:` dans docker-compose.yml pour ne pas être vraiment root.)
RUN mkdir -p /app /app/node_modules /app/src-tauri/target \
             /usr/local/cargo/registry "$NPM_CONFIG_CACHE"

WORKDIR /app

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 0755 /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

############################################
# dev — itération à chaud (bind-mount + volumes)
############################################
FROM base AS dev
EXPOSE 1420 1421
CMD ["npm", "run", "dev"]

############################################
# prod — build de production reproductible (coquille Tauri en release)
# Source montée en LECTURE SEULE au runtime (voir docker-compose.prod.yml).
# Le bundling F-Droid/APK complet est branché au jalon M6.
############################################
FROM base AS prod
CMD ["npm", "run", "tauri", "build", "--", "--no-bundle"]
