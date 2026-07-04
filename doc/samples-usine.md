<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Samples d'usine (#14)

Bibliothèque pré-remplie et board « Principal » pré-assigné au **premier lancement**.

## Provenance (depuis le 2026-07-04, décision §16)

**Banque de référence de 25 classiques de soundboard, exclusivement CC0 Freesound**
(supersède le lot initial de 78 sons à provenance non tracée). Chaque entrée du manifest
porte `source` (URL Freesound, titre, auteur, id) et `license: CC0-1.0`. Renouvellement /
remplacement à l'unité : éditer `scripts/freesound-worklist.json` (label FR, tags, requête
EN, bornes de durée, slot board) puis `FREESOUND_TOKEN=<clé> node scripts/freesound-rebank.mjs`
(`--dry` pour prévisualiser les choix) — sélection automatique par réputation parmi les
résultats CC0, previews HQ OGG à convertir en Opus 96k (ffmpeg dockerisé, voir le README du
répertoire).

## Chaîne complète

1. **Dépôt** — `public/factory-samples/` : fichiers **OGG/Opus uniquement** + `manifest.json`
   (source de vérité : `file`, `label` curaté, `tags` en tokens d'usine, `source`/`license`).
   Section `board` optionnelle : sélection pré-assignée aux pads de la première page, dans
   l'ordre des positions (`playMode` optionnel). Voir le README du répertoire (conversion
   ffmpeg dockerisée, règles de licence).
2. **Build** — plugin Vite `factory-samples-manifest` (`vite-plugin-factory-samples.ts`),
   exécuté à chaque build ET au démarrage dev : cohérence manifest ↔ fichiers (1:1), format
   OGG, tags admis, board cohérent → **build en échec** sinon ; `source`/`license` à `TODO`
   → avertissement (bloquant à lever avant soumission F-Droid). Le `public/` de Vite étant
   copié tel quel, la fixture part dans **chaque dist** (web, Android, conteneur).
3. **Premier lancement** — `create-app.ts` détecte la base vierge (même garde que banque et
   tags par défaut : un sample d'usine supprimé ne repousse **jamais**) et lance
   `seedFactoryContent` (`src/app/factory-seed.ts`), **non bloquant** (l'app est jouable
   pendant le remplissage) : fetch du manifest → `commands.seedFactorySample` par fichier
   (décodage pour durée/jouabilité puis **copie des octets sans réencodage** — d'où
   l'exigence OGG) → tags par token (`defaultTags` du bootstrap : `{ token, label }`) →
   assignation `board` + `playMode`.

## Erreurs

Meilleur effort à tous les étages : fichier introuvable/indécodable → journalisé, ignoré,
le reste continue ; manifest absent (cas des e2e, qui le bloquent via `gotoApp`) → no-op.

## Piège corrigé (2026-07-04) : gel du semis sous politique autoplay

Le semis semblait « perdre » les samples de façon inopinée entre les rechargements :
`decodeSource` (commands) faisait `await engine.resume()` avant chaque décodage, or
`AudioContext.resume()` **ne se résout jamais** tant que la politique autoplay du navigateur
attend un geste utilisateur — au boot (aucun geste), le semis gelait silencieusement sur son
premier sample, et repartait dès qu'on touchait un pad (d'où l'aspect aléatoire, selon le
Media Engagement du profil). Correctif : **aucun `resume()` dans le chemin de décodage**
(`decodeAudioData` travaille contexte suspendu) — la reprise reste l'affaire des gestes
(`resumeAudio`, `void engine.resume()` des commandes de jeu/pré-écoute). Régression couverte :
`commands.factory-seed.test.ts` (« sème même si resume() ne se résout jamais »).

## Tests

- `tests/build/factory-samples.test.ts` — validation build + intégration sur la fixture
  réelle (échoue si un fichier est ajouté sans entrée de manifest).
- `tests/app/commands.factory-seed.test.ts` — la commande ne réencode jamais (l'encodeur
  n'est pas appelé), durée du PCM, échec d'écriture → déchargement moteur.
- `tests/app/factory-seed.test.ts` — semis complet sur fakes (tags, board, meilleur effort).
- `e2e/factory-seed.spec.ts` — premier lancement réel : bibliothèque remplie + « Buzzer 1 »
  sur le premier pad.
