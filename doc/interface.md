<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Interface (jalon M6)

Le **comment** de l'agencement UI v1. Le **quoi/pourquoi** (décisions du tri backlog #2) est
dans [`specifications.md` §11, §16](../specifications.md).

## Agencement

```
┌──────────────────────────────┐
│ Topbar : page · badges       │ ← tap → tiroir page
├──────────────────────────────┤
│                              │
│        PadGrid (centrée)     │ ← Jeu : tap joue · Édition : tap → tiroir pad
│                              │
├──────────────────────────────┤
│ ✎  ⏹  [1][2][+]   ⤓  ♪  ⚙  │ ← Bottombar
└──────────────────────────────┘
```

- **`Topbar`** — nom (ou numéro) de la page active + badges (chip **Édition** si actif,
  Polyphonie, `rows`×`cols`). Tout tap ouvre le **tiroir page**. En **vue bibliothèque**
  (#22), le contexte de page cède la place au titre « Bibliothèque » ; visualiseur et Stop
  restent (globaux). Le **visualiseur** trace une onde par voix active (couleur du pad) et
  l'onde de la **pré-écoute** en accent (#24 — `engine.previewWaveform()`, tap en dérivation
  paresseuse) : tout ce qui sonne sur le main out s'affiche.
- **`Bottombar`** — dans l'ordre : bascule **Jeu ↔ Édition** (crayon, accentué en Édition),
  **Stop général** (`stopAllVoices` → `engine.stopAll`), **onglets de pages** (défilables,
  « + » en Édition), **Import rapide** (input fichier direct, erreurs en snackbar),
  **Bibliothèque** (bascule de VUE dans `main`, #22), **Réglages** (tiroir).
- **`Drawer`** — panneau droit (min(340px, 88vw)) + voile ; fermeture ✕ ou tap sur le voile.
  Quatre contenus : `PadSettings`, `PageSettings`, `Settings`, `TagSettings` (#20) —
  styles de formulaire partagés via `.drawer-form` dans `app.css`.
- **`LibraryPanel`** — VUE du layout (#22, supersède le plein écran M6) : rendue dans
  `<main>` à la place de la grille, topbar/bottombar restent. Contenu `Library` (import,
  renommage, pré-écoute, suppression avec avertissement).
- Icônes : `Icon.svelte` (SVG inline, tracés style Material, zéro dépendance).

## État & commandes

`drawer: 'pad' | 'page' | 'settings' | null` vit dans le store (état UI, §9), muté uniquement
par les commandes : `openPadDrawer` (Édition seulement — en Jeu un tap joue), `openPageDrawer`,
`openSettingsDrawer`, `closeDrawer` (désélectionne le pad), `stopAllVoices`. La **vue de
`<main>`** (`store.view`) suit la navigation par URL ci-dessous ; `openLibrary`/`closeLibrary`
sont des écritures d'URL, `libraryOpen` reste lisible (dérivé de `view`).

## Navigation pilotée par l'URL (#23)

La vue de `<main>` est une **projection de l'URL** — jamais une variable indépendante :

- **Encodage fragment** : `#/board` (défaut), `#/library`, `#/library?tag=<id|untagged>`
  (le filtre de bibliothèque voyage en paramètre). URL vide/inconnue → normalisée vers
  `#/board` par `location.replace` (aucune entrée d'historique parasite).
- **Modules** : `app/navigation.ts` (pur — `parseHash`/`formatHash`, `DEFAULT_ROUTE`) ;
  `app/router.ts` — `createHashRouter(window)` branché par `create-app.ts`,
  `createLoopbackRouter()` par défaut hors navigateur (tests : application synchrone, pile
  minimale). La table `vue → composant` et le rendu dynamique (`<View {app} />`) sont dans
  `App.svelte`.
- **Sens unique** : UI → commande → `router.push/replace/pop` (écriture d'URL) → `hashchange`
  → `applyRoute` (**seul écrivain** de `store.view`, pose aussi le filtre). `applyRoute` est
  exclu de `PREVIEW_STOPPING_COMMANDS` (sync, pas une intention).
- **Historique délibéré** : `push` à l'ouverture de la bibliothèque (entrée marquée d'une
  profondeur dans `history.state`) ; `replace` pour les ajustements (normalisation, changement
  de filtre — pas d'entrée) ; `pop` à la fermeture — **le ✕ et le geste retour Android
  dépilent la même entrée** ; sur une URL d'arrivée directe (rechargement sur `#/library`),
  `pop` se replie en `replace` vers le board.
- **Filtre périmé** : un `?tag=` dont l'id n'existe plus (tag supprimé hors session, ids
  re-générés à chaque chargement en dev mémoire) **retombe sur « Tous »** — assaini par
  `hydrateTags` (boot) et `applyRoute` (retour/avance), URL corrigée par `replace`. Sans ça,
  recharger un onglet resté sur un vieux `?tag=` filtrait sur un tag fantôme : bibliothèque
  « vide » alors que les 78 samples d'usine sont bien là.

Tests : `tests/app/navigation.test.ts`, `tests/app/router.test.ts` (fenêtre factice — pas de
jsdom), e2e « navigation pilotée par l'URL » (`e2e/library-tags.spec.ts`).

Enchaînements : `addPad` (case « + ») ouvre le tiroir du pad créé ; `deletePad` du pad
sélectionné referme le tiroir ; `toggleEditMode` referme le tiroir (le contexte change).

## Remplacements (M3/M5 → M6)

| Avant | Après |
|---|---|
| `Editor.svelte` (panneau inline) | `PadSettings` + `PageSettings` dans le tiroir |
| `PageTabs.svelte` | onglets intégrés à la `Bottombar` |
| `Settings.svelte` en `<details>` | contenu du tiroir Réglages |
| `Library` au-dessus de la grille | `LibraryPanel` (vue de `main` depuis #22) |

## Couleurs (palette OKLCH)

Pages et pads portent un **token** de palette (`color`, domaine `COLORS`, persisté —
migrations 2). Les valeurs visuelles vivent dans `app.css` : thème entier en **oklch()** et
8 teintes `--c-<token>` à L/C constants (contrastes homogènes, maintenance par rotation de
teinte). `ui/tint.ts` produit le style `--tint`, consommé en CSS via `var(--tint, var(--accent))`
(pads : bordure idle / fond actif ; onglets : bordure, fond quand actif). `ColorPicker`
(pastilles + « neutre ») est partagé par les tiroirs pad et page. Token inconnu relu en base →
neutralisé (`sanitizeColor`).

## Modale de choix de sample & empilement

`SamplePicker` (`<dialog>` natif, `showModal`) : liste de la bibliothèque + pré-écoute +
« aucun » + **import direct** (le sample importé est assigné dans la foulée). Empilement des
surcouches : **couche 0** app → **couche 1** tiroir (`--z-drawer`) et panneau (`--z-panel`),
snackbar au-dessus (`--z-snackbar`) → **modales** dans le *top-layer* natif du navigateur,
toujours au-dessus et empilées dans l'ordre d'ouverture (la future modale de crop — backlog
#4 — se posera naturellement sur celle d'import).

## Board complet dès l'init (`BankFactory`)

Décision §16 : **jamais de page vierge ni de pad sans couleur**. La classe `BankFactory`
(app, injectée dans les commandes et la composition root — style OO §16) porte tous les
défauts de création : banque du premier lancement (page « Principal » colorée, grille 4×4
**remplie**), `addPage` (page complète), `setPageGrid` (cases exposées comblées), `addPad`.
Couleurs : cycle de palette par position (pads) et par rang (pages). Style pad : **contour
plein + fond teinté en transparence** ; nom au-dessus du mode — gras si sample affecté,
italique semi-transparent si vide.

## Noms par défaut

Page initiale « Principal », pages ajoutées « Page N » : générateurs **injectés** depuis
`main.ts` (`CreateAppOptions`) car la couche app ne peut pas importer `ui/i18n` (§4) — ce sont
des données utilisateur localisées à la création, éditables ensuite. Un pad **sans nom**
prend le label du sample qu'on lui assigne (`defaultPadName` : extension retirée, 12 caractères
max) ; un nom choisi n'est jamais écrasé.

## Parcours e2e couverts

Import rapide (bottombar) → vérification au panneau Bibliothèque → Édition → « + » → tiroir
(Loop + assignation) → Jeu → pad actif → **Stop général**. Sélecteurs stables : `.bottombar`,
`.mode-toggle`, `.stop`, `.import input`, `.open-library`, `.close-library`, `.drawer`,
`.topbar`, `.cell-add`.
