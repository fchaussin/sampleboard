# SPDX-License-Identifier: GPL-3.0-or-later
# syntax=docker/dockerfile:1
#
# Image Sampleboard multi-étages, exécutée en NON-ROOT.
# Toolchain (Node + Rust + deps système Tauri v2) dans l'image ; les dossiers lourds
# (node_modules, src-tauri/target, caches cargo/npm) vivent dans des volumes Docker.
# L'hôte n'est jamais pollué et le conteneur tourne sans privilèges (voir docker-compose.yml).

############################################
# base — toolchain commune, utilisateur non-root
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

# Utilisateur non-root. On réutilise l'UID s'il existe déjà (ex. user 'node' = 1000),
# sinon on le crée. HOME dédié + points de montage possédés par l'UID cible pour que
# les volumes Docker (créés vides) héritent des bonnes permissions d'écriture.
RUN set -eux; \
    if ! getent passwd "$UID" >/dev/null 2>&1; then \
      if ! getent group "$GID" >/dev/null 2>&1; then groupadd -g "$GID" app; fi; \
      useradd -M -u "$UID" -g "$GID" -d "$HOME" -s /bin/bash app; \
    fi; \
    mkdir -p /app /app/node_modules /app/src-tauri/target \
             /usr/local/cargo/registry "$NPM_CONFIG_CACHE"; \
    chown -R "$UID:$GID" /app /usr/local/cargo /usr/local/rustup "$HOME"

WORKDIR /app

COPY --chown=$UID:$GID docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 0755 /usr/local/bin/entrypoint.sh

# Bascule non-root (numérique : valable que l'utilisateur soit nommé ou non).
USER $UID:$GID
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

############################################
# dev — itération à chaud (bind-mount + volumes)
############################################
FROM base AS dev
EXPOSE 1420 1421
CMD ["npm", "run", "dev"]

############################################
# builder — build de production reproductible
# Source fournie en lecture seule au runtime (voir service `build`).
############################################
FROM base AS builder
CMD ["npm", "run", "build"]
