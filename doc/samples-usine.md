<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Samples d'usine (#14)

Bibliothèque pré-remplie et board « Principal » pré-assigné au **premier lancement**.

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

## Tests

- `tests/build/factory-samples.test.ts` — validation build + intégration sur la fixture
  réelle (échoue si un fichier est ajouté sans entrée de manifest).
- `tests/app/commands.factory-seed.test.ts` — la commande ne réencode jamais (l'encodeur
  n'est pas appelé), durée du PCM, échec d'écriture → déchargement moteur.
- `tests/app/factory-seed.test.ts` — semis complet sur fakes (tags, board, meilleur effort).
- `e2e/factory-seed.spec.ts` — premier lancement réel : bibliothèque remplie + « Buzzer 1 »
  sur le premier pad.
