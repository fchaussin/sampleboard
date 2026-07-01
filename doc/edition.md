<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Édition (jalon M3)

Le **comment** du mode Édition : CRUD pads/pages, réglages, redimensionnement de grille. Le
**quoi/pourquoi** (modèle, invariants) est dans [`specifications.md` §6, §11–§12](../specifications.md).

## Bascule Jeu ↔ Édition

Bouton d'en-tête → `toggleEditMode`. En Édition : taper un pad le **sélectionne**
(`selectedPadId`) au lieu de le jouer ; les cases vides affichent un **« + »** (ajout de pad à
cette position) ; les onglets gagnent un **« + »** (ajout de page). Quitter l'Édition vide la
sélection.

## Commandes (voir `src/app/commands.ts`)

**Pads** : `addPad(pageId, position?)` (1ʳᵉ case libre si `position` omis ; no-op si pleine ou
occupée), `renamePad`, `setPadPlayMode`, `setPadGainDb` (**borné** [-60, +6]), `assignSample(id |
null)` (sample de la bibliothèque, ou vider), `deletePad` (stoppe la voix d'abord), `reorderPads`
(échange avec l'occupant de la case cible).

**Pages** : `addPage`, `renamePage`, `deletePage` (**refuse la dernière** — une banque a ≥ 1 page ;
stoppe la page puis renumérote), `setPageVoiceMode`, `setPageGrid(rows, cols)`, `reorderPages`.

### Invariant de réduction (§6, §12)

`setPageGrid` **refuse** une réduction qui ferait tomber un pad hors de la nouvelle grille
(`padsFitGrid`). L'Editor désactive les boutons « − » quand la réduction n'est pas sûre — aucune
donnée perdue silencieusement.

## Bibliothèque en M3 (pont dev)

L'import réel (dialog Tauri + ré-encodage Opus + persistance) arrive au **M4**. En attendant, la
barre `DevLibrary` :

- **Ajouter un son** → `devAddSample` crée une entrée `Sample` dans `store.samples` et charge son
  buffer (API File).
- **Charger** sur une entrée existante → `attachSampleBuffer` (remplit le buffer d'un sample seed).

L'`Editor` liste `store.samples` dans son sélecteur ; `assignSample` relie pad → sample. Au M4,
seule la **source** des samples change (import réel) : commandes et UI d'assignation restent.

## Essayer (dev)

1. http://localhost:1420 → **Ajouter un son** (une ou deux fois).
2. Bouton **Édition** → « + » d'une case pour créer un pad ; le sélectionner ; régler mode / gain /
   nom / **Sample** ; redimensionner la grille ; ajouter/renommer/réordonner/supprimer des pages.
3. Bouton **Jeu** → jouer la banque configurée.

## Tests

`tests/app/commands.edit.test.ts` (CRUD, invariant de réduction, bibliothèque, sélection). Voir
[tests](./tests.md).
