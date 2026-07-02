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
############################################
FROM base AS prod
CMD ["npm", "run", "tauri", "build", "--", "--no-bundle"]

############################################
# android — toolchain d'empaquetage APK (M6). Versions ÉPINGLÉES (build reproductible §15).
# JDK 17 + Android SDK (cmdline-tools/platform/build-tools) + NDK + cibles Rust Android.
# Tout vit dans l'image / les volumes ; l'hôte reste propre.
############################################
FROM base AS android

# Versions épinglées — les faire évoluer explicitement, jamais de « latest » implicite.
ARG ANDROID_CMDLINE_TOOLS=11076708
ARG ANDROID_PLATFORM=34
ARG ANDROID_BUILD_TOOLS=34.0.0
ARG ANDROID_NDK=26.1.10909125

RUN apt-get update && apt-get install -y --no-install-recommends \
      openjdk-17-jdk-headless \
      unzip \
      zip \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/lib/jvm/java-17-openjdk-* /opt/java

ENV JAVA_HOME=/opt/java \
    ANDROID_HOME=/opt/android-sdk \
    PATH=/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:$PATH

# SDK : cmdline-tools puis paquets épinglés (licences acceptées dans l'image de build).
RUN mkdir -p "$ANDROID_HOME/cmdline-tools" \
    && curl -fsSL -o /tmp/clt.zip \
       "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS}_latest.zip" \
    && unzip -q /tmp/clt.zip -d "$ANDROID_HOME/cmdline-tools" \
    && mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest" \
    && rm /tmp/clt.zip \
    && yes | sdkmanager --licenses > /dev/null \
    && sdkmanager \
         "platform-tools" \
         "platforms;android-${ANDROID_PLATFORM}" \
         "build-tools;${ANDROID_BUILD_TOOLS}" \
         "ndk;${ANDROID_NDK}"

ENV NDK_HOME=$ANDROID_HOME/ndk/${ANDROID_NDK}

# Cibles Rust Android (arm64 = cible F-Droid principale ; les 4 pour couverture émulateur).
RUN rustup target add \
      aarch64-linux-android \
      armv7-linux-androideabi \
      i686-linux-android \
      x86_64-linux-android

CMD ["bash"]
