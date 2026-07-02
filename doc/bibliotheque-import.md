<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Bibliothèque & import (jalon M4)

Le **comment** de l'import et de la bibliothèque. Le **quoi/pourquoi** (pipeline, formats, codec)
est dans [`specifications.md` §8, §11, §13](../specifications.md).

## Encodeur Opus (WASM)

`src/engine/encoder.ts` — socle **[opus-recorder](https://github.com/chris-rudmin/opus-recorder)**
(MIT) : libopus + conteneur ogg compilés en WASM, **embarqués dans le worker** (`encoderWorker.min.js`,
aucun asset séparé). Décision §16 : WASM libopus, 96 kbps. Reproductibilité build-from-source
prévue au **M6**.

`createOpusEncoder()` renvoie un `Encoder` (`PcmData → Uint8Array` OGG/Opus) qui pilote un worker
éphémère. Protocole (aligné sur opus-recorder) :

1. `init` (originalSampleRate, numberOfChannels, encoderSampleRate 48 kHz, encoderBitRate 96 kbps,
   application audio) → le worker répond `{message:'ready'}`.
2. **`getHeaderPages`** → pages **OpusHead + OpusTags** *(indispensable : sans ces en-têtes l'OGG
   est indécodable — c'est le bug qui a motivé la couche E2E, voir [tests](./tests.md))*.
3. `encode` (buffers Float32 par canal) puis `done` → pages audio, puis `{message:'done'}`.
4. Les pages arrivent en `{message:'page', page}` ; on les concatène en un `.ogg`.

L'`Encoder` est **injecté** dans les commandes (`createCommands({ encode })`) : testable en pur
avec un faux encodeur, réel en E2E.

## Pipeline d'import (`commands.importSample`)

`fileName + bytes` →

1. **Taille** : rejet si > 20 Mo (`IMPORT_MAX_BYTES`, §16) — sur la source, avant décodage.
2. `engine.resume()` puis **`engine.decode`** (`decodeAudioData`) → PCM + `durationMs`. Échec →
   `undecodable`.
3. **Encodage** Opus (`encode`) → octets OGG/Opus. Échec → `encodeFailed`.
4. **`engine.load` du ré-encodé** : re-décode l'OGG produit → garde-fou (un encodage cassé fait
   *échouer* l'import au lieu de corrompre la bibliothèque) + rend le sample jouable/pré-écoutable.
5. **Écriture immédiate** (M5, hors autosave) : fichier `{appDataDir}/audio/{sampleId}.ogg` +
   ligne `samples` via `sampleRepository.add`. Échec → `writeFailed` (buffer déchargé, rien en
   bibliothèque).
6. Entrée `Sample` ajoutée à `store.samples` (`mime: audio/ogg`, `durationMs`, taille encodée,
   `createdAt`).

> Voir [persistance & réglages (M5)](./persistance-reglages.md). Au navigateur nu, le dépôt est
> en mémoire (session seulement) — le pipeline reste validable 100 % web.

## Bibliothèque (`Library.svelte`)

Import (bouton), **pré-écoute** (`previewSample` → voix transitoire hors pads), **renommage** du
`label`, **suppression** avec **avertissement du nombre de pads impactés** : après confirmation,
le `sampleId` de ces pads passe à **`null`** (état *vide*) — miroir en mémoire du
`ON DELETE SET NULL` du schéma (§8), appliqué depuis M5. Renommage et suppression écrivent
**immédiatement** via le dépôt.

## États de pad (§12, Glossaire)

`Pad.svelte` dérive : **actif** (dans `activePadIds`) › **vide** (`sampleId` null) › **introuvable**
(`sampleId` absent de la bibliothèque — ex. données altérées hors app) › **au repos**. Depuis M5,
un fichier audio illisible au démarrage laisse le sample en bibliothèque mais son pad joue un
no-op (§12) ; un signalement visuel dédié est au backlog.

## Essayer (dev, http://localhost:1420)

1. **Importer un son** → le sample apparaît (⇒ encodage OGG/Opus + re-décodage OK).
2. **▶** pour pré-écouter.
3. **Édition** → « + » d'une case → assigner le **Sample** → **Jeu** → jouer.

## Tags, filtres & assignation directe (jalon M8)

- **Tags** (`Tag`, n-à-n, migration 4) : personnalisables via « Gérer les tags » (créer,
  renommer, supprimer — la suppression épure affectations et filtre). Neuf tags **semés au
  premier lancement uniquement** (libellés i18n injectés par le bootstrap).
- **« Non classé »** : filtre **virtuel** = samples sans affectation (décision §16 — une
  seule représentation de l'absence ; un ensemble vidé disparaît de `sampleTags`).
- **Filtres** : chips (Tous / tags / Non classé) au-dessus de la liste ; logique pure
  partagée `app/tag-filter.ts` (`matchesFilter`, `filterSamples` avec recherche texte).
- **Ligne dépliable** (🏷) par sample : chips de tags à bascule + **assignation directe
  page→pad** (#11 — selects Page/Pad + Assigner, `assignSample` existant).
- **Modale de choix de sample** (#12) : combobox — champ de recherche + chips de tags,
  filtres locaux à la modale.
