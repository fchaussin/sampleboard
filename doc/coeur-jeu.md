<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Cœur jouable (jalon M2)

Le **comment** du cœur : domaine, store, commandes, entrée pointeur et grille. Le **quoi/pourquoi**
(modèle, matrice de comportement) est dans [`specifications.md` §6–§11](../specifications.md).

## Flux (rappel §9)

`UI → intention → commande → (store + engine)`. Les composants sont **bêtes** : ils rendent l'état
et émettent des intentions via `app.commands`. **Seules les commandes mutent le store.** L'engine
est autoritatif sur les voix : il *notifie* `onPlayingChanged` → le store reflète `activePadIds`.

## Domaine (`src/domain`)

- `types.ts`, `enums.ts` — modèle pur (voir §6).
- `invariants.ts` — bornes (gain dB, grille) + `padsFitGrid` (invariant de réduction).
- `selectors.ts` — **lectures pures** de l'arbre banque : `pagesSorted`, `padsOfPage`,
  `padAtPosition`, `findPad`, `findPage`.

## Store (`src/app/store.svelte.ts`)

Runes Svelte 5. Champs : `bank`, `samples`, `settings`, `activePageId`, `editMode`, `activePadIds`.
Getters dérivés : `locale`, `activePage`. Muté uniquement par les commandes.

## Commandes (`src/app/commands.ts`)

| Commande | Effet |
|---|---|
| `hydrateBank(bank)` | Charge un arbre banque + sélectionne la 1ʳᵉ page. (Seed M2 ; hydratation SQLite au M5.) |
| `setActivePage(id)` | Change la page affichée. |
| `firePad(id)` | One-Shot. |
| `pressPad(id)` / `releasePad(id)` | Gate on / off. |
| `toggleLoopPad(id)` | Loop start/stop. |
| `stopPad(id)` / `stopPage(id)` | Arrêts. |

Chaque commande de jeu résout `pad` + `page` dans la banque et **reprend l'audio** (`resume`, geste
utilisateur) avant de déléguer au moteur. No-op silencieux si pad/page introuvable.

## Entrée pointeur (`src/ui/interaction/pad-input.ts`)

`attachPadInput(el, padId, playMode, handlers)` mappe les Pointer Events selon le Mode de lecture :

- **One-Shot** : `pointerdown` → `fire`.
- **Loop** : `pointerdown` → `toggleLoop`.
- **Gate** : `pointerdown` → `press` + `setPointerCapture` (reçoit le relâchement même doigt sorti) ;
  `pointerup`/`pointercancel` → `release`. Détachement d'un Gate encore tenu → `release` de sécurité.

Souris : bouton principal seulement. Les pads ont `touch-action: none` (pas de scroll/zoom pendant
un Gate).

## UI (`src/ui/components`)

- `PageTabs` — navigation entre pages (M2 : sélection ; ajout/renommage/grille au M3).
- `PadGrid` — grille CSS `rows`×`cols` de la page active ; pads placés par `position`, cases vides
  sinon.
- `Pad` — rend `name` + libellé de mode (i18n `mode.*`), branche `pad-input`, reflète l'état
  *actif* (via `activePadIds`) / *vide*.

## Matrice de comportement (§7) — où c'est vérifié

Gate, Loop, choke Mono, re-déclenchement self, FIFO, `stop*` sont couverts par
`tests/engine/audio-engine.m2.test.ts` ; le mappage entrée par `tests/ui/pad-input.test.ts` ; la
délégation par `tests/app/commands.test.ts`. Voir [tests](./tests.md).

## Essayer (dev, banque seed temporaire)

1. http://localhost:1420 → charger un son dans **Son A** et **Son B** (barre dev).
2. Onglets **Poly** / **Mono** ; taper les pads : One-Shot (relance), Gate (maintenir), Loop
   (re-tap = stop). Sur **Mono**, démarrer un pad coupe les autres.
