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

Import (bouton), **pré-écoute** (bouton ▶ **bascule en ■** pendant la lecture — re-tap ou
**toute autre action** stoppe ; composant partagé `PreviewButton`, routage via le bus master,
voir [moteur audio](./moteur-audio.md)), **renommage** du
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
  premier lancement uniquement** (libellés i18n injectés par le bootstrap). La gestion vit
  dans le **tiroir droit** (#20, `TagSettings` dans `Drawer`, vue `tags`,
  `openTagsDrawer`) : ouvert depuis la barre d'outils de la bibliothèque — la liste et
  les filtres se mettent à jour derrière, en direct.
- **« Non classé »** : filtre **virtuel** = samples sans affectation (décision §16 — une
  seule représentation de l'absence ; un ensemble vidé disparaît de `sampleTags`).
- **Filtres** : chips (Tous / tags / Non classé) au-dessus de la liste ; logique pure
  partagée `app/tag-filter.ts` (`matchesFilter`, `filterSamples` avec recherche texte).
- **Recherche dans le panneau** : champ texte (sur le label, insensible casse/espaces)
  combiné (ET) aux chips, dans une **barre d'outils sticky** (import + recherche + filtres
  restent visibles au défilement). Sans correspondance : message « Aucun son ne
  correspond » + bouton **Tout afficher** (efface recherche et filtre). Style `.search`
  mutualisé dans `app.css` (partagé avec la modale de choix de sample).
- **Layout adaptatif** (media queries, styles de `Library.svelte`) : en **écran large**
  (`≥ 48rem` — tablette/paysage/desktop) la liste devient une **grille de cartes**
  (`auto-fill minmax(20rem, 1fr)`, ligne dépliée sur toute la largeur) ; en **étroit**,
  les actions groupées (`.actions`) passent **sous le nom** (wrap piloté par le contenu,
  base mini du nom `10rem`) ; en **tactile** (`pointer: coarse`), cibles ≥ 44 px (règle M6).
- **Ligne dépliable** (🏷) par sample : chips de tags à bascule + **assignation directe
  page→pad** (#11 — selects Page/Pad + Assigner, `assignSample` existant).
- **Waveform par carte** (#19, `SampleWaveform.svelte`) : pics statiques du sample
  toujours visibles sous le nom (`engine.peaks`, tracé partagé `drawPeakBars` avec le
  pad) ; pendant la **pré-écoute**, la partie jouée se remplit (`engine.previewProgress`).
  La boucle rAF ne tourne que pendant la pré-écoute de la carte concernée — au repos, un
  seul tracé statique.
- **Modale de choix de sample** (#12) : combobox — champ de recherche + chips de tags,
  filtres locaux à la modale.

## Pool d'assignation (M8, revu #18)

Liste de travail de samples **de session** (`store.poolSampleIds`, non persistée), outil
d'**Édition exclusivement** :

- **Écran large (≥ 48 rem)** : **sidebar systématique** en flux (`App.svelte` : `.body` =
  sidebar + grille, détection `matchMedia`) — ni bouton d'ouverture, ni fermeture.
- **Écran étroit** : **tiroir gauche** flottant (`overlay`), ouvert/fermé par le bouton
  pool de la bottombar (`poolOpen`). En large, la sidebar reste en place à côté de la
  **vue bibliothèque** (#22) — le glisser ligne → pool se fait en flux.
- **Alimentation** : bouton par ligne de bibliothèque, option d'import (#13), bouton
  **« + »** de l'en-tête (ouvre la bibliothèque), ou **glisser-déposer** d'une ligne de
  bibliothèque sur le pool. **« 🗑 Vider »** (`clearPool`) vide d'un coup (désarme si
  l'armé venait du pool).
- **Vers les pads** : toucher un élément l'**ARME** (assignation à la volée, M8), ou le
  **glisser directement sur un pad** (assignation immédiate, `assignSample`).
- **Aperçu rapide** (#21) : `PreviewButton` (▶/■) en tête de chaque élément + waveform de
  progression (`SampleWaveform`) derrière le libellé — même pré-écoute unifiée que la
  bibliothèque (#16, toute autre action stoppe).

Le DnD HTML5 (`ui/interaction/sample-dnd.ts` : type MIME partagé
`application/x-sampleboard-sample`) est un raccourci **pointeur** ; le flux tactile
« armer puis toucher » reste le chemin principal sur mobile.

## Import multiple & archives (jalon M8, #13)

Le bouton d'import de la **bottombar ouvre la MODALE d'import** (`ImportModal.svelte`,
`openImport`/`closeImport`) : état « choix des fichiers » (bouton + rappel des formats +
option **« Ajouter les sons importés au pool »** — chaque sample réussi rejoint le pool,
sur le lot comme sur le fichier unique validé dans l'éditeur), puis **progression au même
endroit** quand un lot démarre. L'input de la bibliothèque
reste un accès direct au sélecteur ; les deux sont `multiple` et acceptent
`audio/* + .zip + .rar` (`IMPORT_ACCEPT`, `ui/import-file.ts`). Aiguillage dans
`importFiles` :

- **UN fichier audio** → `beginImport` : l'**éditeur audio s'ouvre** (flux M7 inchangé,
  y compris l'assignation à un pad depuis la modale de choix) et la modale d'import se
  referme.
- **Plusieurs fichiers ou une archive** → `commands.importBatch` : **lot direct** sans
  éditeur (rognage possible après coup via « Découper »), progression dans
  `store.batchImport` ($state.raw, remplacé en bloc) — barre globale, statut par fichier,
  **Interrompre** (l'élément en cours se termine, les restants passent à « ignoré »).
  « Fermer » en fin de lot referme modale et état d'un coup (`closeBatchImport`).

### Archives (zip/rar) — `engine/archive.ts`

Extraction via **libarchive compilé en WASM** dans un worker éphémère par archive :
`libarchive.js` (MIT) enrobe libarchive (BSD, lecteurs zip + rar4/rar5 **clean-room**) —
le unrar officiel est **refusé** (licence non libre, décision §16). Le worker résout
`libarchive.wasm` **relativement à sa propre URL** : le plugin `libarchive-assets`
(`vite.config.ts`) sert les deux fichiers côte à côte en dev et les copie en
`dist/libarchive/` au build (noms stables, pas de hash).

Dans le lot, une archive est **dépliée en place** : ses entrées à extension audio
(`AUDIO_EXTENSIONS`, le décodage reste l'arbitre final §12) s'ajoutent à la file et à la
modale ; `__MACOSX/` et les fichiers cachés sont écartés. Gardes : archive ≤ 200 Mo
(`ARCHIVE_MAX_BYTES`) → `tooLarge` ; extraction impossible → `archiveFailed` ; aucune
entrée audio → `archiveEmpty`. Chaque entrée repasse ensuite par le pipeline d'import
standard (20 Mo, décodage, Opus, écriture immédiate).

L'extracteur est **injecté** dans les commandes (`createCommands({ extractArchive })`) :
factice dans les tests (`tests/app/commands.batch-import.test.ts` — lot, isolation des
échecs par fichier, expansion, interruption), réel câblé par `create-app.ts`.
