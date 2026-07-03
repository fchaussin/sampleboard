<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Éditeur audio — « Découper » (jalon M7)

Le **comment** du rognage start/end. Le **quoi/pourquoi** (décision de rapatriement v2 → v1)
est dans [`specifications.md` §16](../specifications.md).

## Principe

**Tout import ouvre l'éditeur** (Import rapide, Bibliothèque, modale de choix de sample) :
le fichier est décodé en PCM, présenté en waveform, rogné à la sélection, puis **encodé en
Opus déjà rogné** (le fichier stocké ne contient que la sélection). Un sample existant se
retravaille via **✂ dans la bibliothèque** (`beginSampleRework` : relit l'OGG → re-décode →
éditeur → ré-encode, **id et fichier conservés**, pas de doublon).

## Couches

- **`engine/pcm.ts`** (pur) : `pcmDuration`, `computePeaks` (partagé avec `engine.peaks`),
  `clampSelection` (bornes + durée min 10 ms), `trimPcm` (rognage par échantillons,
  multi-canaux, source intacte).
- **Moteur** : `previewPcm` / `stopPreview` — pré-écoute du PCM rogné, via le mécanisme de
  pré-écoute UNIFIÉ du moteur (un appel remplace la lecture en cours, sample ou PCM — voir
  [moteur audio](./moteur-audio.md)).
- **Store** : `audioEditor` (`$state.raw`) — session `{ mode: 'import' | 'rework', fileName,
  pcm, sample, assignPadId }`.
- **Commandes** : `beginImport` (garde 20 Mo → décode → ouvre ; mémorise le pad à assigner
  pour le flux modale de sample), `beginSampleRework`, `previewEditorSelection`,
  `applyAudioEditor` (import : `finishImport` commun + assignation ; retravail :
  `SampleRepository.replace` + rechargement moteur, **restauration meilleur-effort** du
  buffer d'origine en cas d'échec), `cancelAudioEditor`. Échec d'application → l'éditeur
  **reste ouvert** avec le message.
- **`SelectionHistory`** (classe, OO §16) : pile undo/redo des sélections — un push par
  relâchement de poignée.
- **`AudioEditor.svelte`** : `<dialog>` plein écran (top-layer → s'empile naturellement sur
  la modale de choix de sample). Waveform en barres (pics en cache par largeur), sélection
  pleine / hors-sélection estompée, **poignées déplacées au pointeur** (la plus proche du
  toucher), temps `start – end · durée`, pré-écoute, undo/redo, Annuler / Valider.

## Durée persistée

`durationMs` est désormais **dérivée du PCM** (`pcmDuration`), donc toujours cohérente avec
le fichier réellement encodé (rogné ou non) ; la bibliothèque affiche la durée à jour après
retravail.

## Parcours e2e

`e2e/audio-editor.spec.ts` : import 1 s → drag de la poignée de fin à 50 % → undo (sélection
pleine) → re-rognage → Valider → **la bibliothèque affiche 0,5 s** ; puis retravail (✂) d'un
sample existant → re-rognage → même entrée, durée mise à jour. Les imports des autres specs
passent par `applyAudioEditor(page)` (helper).
