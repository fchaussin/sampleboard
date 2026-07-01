# SPDX-License-Identifier: GPL-3.0-or-later
# syntax=docker/dockerfile:1
#
# Image de développement Sampleboard : Node + Rust + dépendances système Tauri v2 (Linux).
# Objectif : TOUT compiler/exécuter ici, rien sur l'hôte. Les dossiers lourds
# (node_modules, src-tauri/target, cache cargo) vivent dans des volumes Docker
# déclarés par docker-compose.yml — l'hôte n'est jamais pollué.

FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

# Dépendances système Tauri v2 (WebKitGTK + build) — voir https://tauri.app/start/prerequisites/
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
      wget \
    && rm -rf /var/lib/apt/lists/*

# Toolchain Rust stable (compilation de la coquille src-tauri).
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
      | sh -s -- -y --profile minimal --default-toolchain stable \
    && chmod -R a+w "$CARGO_HOME" "$RUSTUP_HOME"

WORKDIR /app

# Installe les deps npm dans le volume au premier lancement, puis exécute la commande.
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Vite (1420) + HMR (1421).
EXPOSE 1420 1421

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bash"]
