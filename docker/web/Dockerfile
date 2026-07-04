# syntax=docker/dockerfile:1
# SPDX-License-Identifier: GPL-3.0-or-later
# Livraison Docker de la web/PWA (M10, décision §16) — PAS une distribution à part :
# le MÊME build statique que l'hébergement public, servi par nginx non privilégié.
# Publication prévue sur Docker Hub (fchaussin/sampleboard).
#
#   docker build -f docker/web/Dockerfile -t sampleboard-web .
#   docker run -d -p 8080:8080 sampleboard-web    # → http://localhost:8080

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Image non privilégiée (uid 101, écoute 8080) : cap_drop ALL possible, pas de root.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
