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
  Polyphonie, `rows`×`cols`). Tout tap ouvre le **tiroir page**.
- **`Bottombar`** — dans l'ordre : bascule **Jeu ↔ Édition** (crayon, accentué en Édition),
  **Stop général** (`stopAllVoices` → `engine.stopAll`), **onglets de pages** (défilables,
  « + » en Édition), **Import rapide** (input fichier direct, erreurs en snackbar),
  **Bibliothèque** (panneau plein écran), **Réglages** (tiroir).
- **`Drawer`** — panneau droit (min(340px, 88vw)) + voile ; fermeture ✕ ou tap sur le voile.
  Trois contenus : `PadSettings`, `PageSettings`, `Settings` (styles de formulaire partagés
  via `.drawer-form` dans `app.css`).
- **`LibraryPanel`** — plein écran, contenu `Library` (import, renommage, pré-écoute,
  suppression avec avertissement).
- Icônes : `Icon.svelte` (SVG inline, tracés style Material, zéro dépendance).

## État & commandes

`drawer: 'pad' | 'page' | 'settings' | null` et `libraryOpen` vivent dans le store (état UI,
§9), mutés uniquement par les commandes : `openPadDrawer` (Édition seulement — en Jeu un tap
joue), `openPageDrawer`, `openSettingsDrawer`, `closeDrawer` (désélectionne le pad),
`openLibrary` / `closeLibrary` (une surcouche à la fois), `stopAllVoices`.

Enchaînements : `addPad` (case « + ») ouvre le tiroir du pad créé ; `deletePad` du pad
sélectionné referme le tiroir ; `toggleEditMode` referme le tiroir (le contexte change).

## Remplacements (M3/M5 → M6)

| Avant | Après |
|---|---|
| `Editor.svelte` (panneau inline) | `PadSettings` + `PageSettings` dans le tiroir |
| `PageTabs.svelte` | onglets intégrés à la `Bottombar` |
| `Settings.svelte` en `<details>` | contenu du tiroir Réglages |
| `Library` au-dessus de la grille | `LibraryPanel` plein écran |

## Parcours e2e couverts

Import rapide (bottombar) → vérification au panneau Bibliothèque → Édition → « + » → tiroir
(Loop + assignation) → Jeu → pad actif → **Stop général**. Sélecteurs stables : `.bottombar`,
`.mode-toggle`, `.stop`, `.import input`, `.open-library`, `.close-library`, `.drawer`,
`.topbar`, `.cell-add`.
