# CLAUDE.md — Sampleboard

Contexte projet chargé à chaque session. **Lire aussi** [`specifications.md`](./specifications.md) (spec technique + glossaire) et [`roadmap.md`](./roadmap.md) (jalons, tâches, versionnage) avant de coder.

## Le produit
**Sampleboard** : application de **pads** déclencheurs de sons (façon soundboard), organisés en **pages**. L'utilisateur importe ses fichiers audio (→ **bibliothèque**) et configure ses pads. Cible : **F-Droid** (Android). C'est un *sampleboard*, **pas un sampler** : volontairement simple (pas de DSP, pas d'édition audio poussée).

## État actuel
- **M0 → M8 livrés** (`v0.9.0` : éditeur audio « découper », bibliothèque avancée — tags,
  recherche, pool, import multiple/archives, samples d'usine, pré-écoute + bus master).
  Projet renommé **sampleboard** (répertoire local inchangé).
- En cours : **M9 — Empaquetage** (`0.10.0`) presque bouclé : APK debug+release, audit FOSS,
  fastlane (descriptions, changelogs, captures validées), banque d'usine **25 sons CC0
  Freesound** (licences tracées), **WASM opus + libarchive from-source** (toolchains
  épinglées, `src/vendor/`). Reste : déterminisme APK, soumission F-Droid. Ensuite :
  **M10 — Distribution web** (PWA IndexedDB, livrée par hébergement et/ou image Docker).
- Dépôt hébergé sur **GitHub : `fchaussin/sampleboard` (public)** — historique purgé des
  78 anciens samples non tracés avant publication (2026-07-04).
- Points ouverts : son muet fenêtre `tauri dev` WSLg (env dev — backlog #3).

## Stack (voir spec §3)
Svelte 5 (runes) + Vite en **SPA** (`adapter-static`, SSR off) · TypeScript **strict** · **Tauri v2** · SQLite natif (`tauri-plugin-sql`) · `tauri-plugin-fs` + `tauri-plugin-dialog` · **Web Audio API** · encodage **Opus via WASM libopus** embarqué. Dev via `tauri dev` (jamais navigateur nu). Aucune logique métier en Rust.

## Architecture (voir spec §4-§5)
Dépendance à sens unique : `domain ← engine, storage ← app ← ui`. Le cœur (`domain`/`engine`/`storage`) ne dépend jamais de Svelte. Flux unidirectionnel `UI → intention → commande → (store + engine + persistance)`. Mutation d'état **uniquement** dans `commands.ts`. Composition root explicite (`create-app.ts`), pas de singletons.

## Conventions NON négociables
- **i18n** : app multilingue. **Zéro texte en dur** dans le code — uniquement des **clés (tokens)**. Traductions en **JSON par langue** (`src/ui/i18n/*.json`), **`fr.json` = défaut & fallback**.
- **Code & schéma SQLite en anglais neutre.** Les libellés FR sont dans `fr.json`.
- **Vocabulaire** : le **Glossaire en tête de `specifications.md` est la source de vérité** (concept ↔ code/clé ↔ libellé FR). S'y tenir strictement.
- **Mot banni : « couper »** (réservé à la future feature « découper », rognage v2) → dire **« stopper » / « arrêter »**.
- Termes de comportement en terminologie **contrôleur MIDI** : Mode de lecture = One-Shot / Gate / Loop ; Polyphonie = Mono / Poly.

## Versionnage (voir roadmap §1)
SemVer depuis **`0.1.0`**. `major=0` jusqu'à stabilité. `minor` = un jalon livré. `patch` = correctifs. **`1.0.0` = critère** (stable + complète), pas une échéance. Fin de jalon → cocher tâches + `CHANGELOG.md` + tag `vX.Y.Z`.

## Workflow
- Une tâche ↔ un jalon ↔ une version `minor`. Suivi dans `roadmap.md` §3.
- **Nouvelle feature en cours de dev** → l'ajouter au **Backlog › Entrantes** de `roadmap.md` (statut *À trier*), **jamais** l'insérer dans un jalon en cours.
- Décisions structurantes → les figer dans `specifications.md` §16.

## Git
- Messages de commit terminés par :
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Commit/push uniquement sur demande.
