<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Moteur audio (jalon M1)

Le **comment** de l'`engine`. Le **quoi/pourquoi** (contrat, matrice de comportement) reste dans
[`specifications.md` §7](../specifications.md).

## Vue d'ensemble

`src/engine/audio-engine.ts` — TS pur (Web Audio), **aucune dépendance à Svelte**. Responsabilité
unique : produire du son à faible latence et gérer les voix. Il est **autoritatif** sur l'état de
jeu éphémère (quelles voix jouent) : il le *notifie*, il ne le duplique pas dans le store.

Ce qui est implémenté au **M1** :

| Méthode | Rôle |
|---|---|
| `resume()` | Crée/reprend l'`AudioContext` sur un geste utilisateur. **Idempotent** ; reprend aussi depuis `interrupted` (interruption système mobile). Jamais si `closed`. |
| `load(sampleId, bytes)` | `decodeAudioData` (sur une **copie** des octets, car l'API détache l'`ArrayBuffer`) → cache `Map<sampleId, AudioBuffer>`. |
| `unload(sampleId)` / `isLoaded(sampleId)` | Retrait du cache / présence. |
| `oneShot(pad, page)` | Lecture **One-Shot** : `AudioBufferSourceNode` → `GainNode` → sortie. Gain = `gainDbToAmplitude(pad.gainDb)`. Re-tap = **relance depuis 0** (coupe d'abord la propre voix du pad, fade anti-clic ~8 ms). **No-op silencieux** si pad vide (`sampleId === null`) ou buffer non chargé. |
| `onPlayingChanged(cb)` | Abonnement au reflet des voix actives (`Set<padId>`), émis à chaque démarrage/fin de voix. |
| `state` | `suspended` \| `running` \| `closed` \| `interrupted`. |

**Complété au M2** (voir [cœur jouable](./coeur-jeu.md)) : `press`/`release` (Gate),
`toggleLoop` (Loop), `stopPad`/`stopPage`, **choke Mono** (démarrer un pad arrête les autres voix
de la page), et plafond de voix en **FIFO** (`getMaxVoices`, lu depuis `Settings.maxVoices`). Une
voix porte sa `pageId` (choke + `stopPage`).

### Bus master (décision §16, 2026-07-03)

Point de passage **unique** vers la sortie : `master (GainNode) → destination`. **Tout ce
qui sonne s'y raccorde** — chaîne de voix `source → gain → analyseur (visualiseur par
pad) → master`, pré-écoutes `source → master` — jamais `ctx.destination` en direct. Créé
paresseusement au premier son (`#ensureMaster`). `masterWaveform(out)` expose la forme
d'onde temps réel du bus ; son analyseur est un **tap en dérivation** (le son ne le
traverse pas) créé **paresseusement au premier appel** — zéro coût de rendu tant que
personne ne consomme (revue 2026-07-03 : pas d'analyseur traversant sur le chemin chaud).

### Pré-écoute unifiée (décision §16)

**Un seul comportement** pour la bibliothèque, la modale de sample et l'éditeur audio :
une pré-écoute à la fois dans l'app, la nouvelle **remplace** la courante, `stopPreview()`
l'arrête (stop **et déconnexion synchrones** — on ne compte pas sur le `onended` si le
contexte se suspend juste après, arrière-plan). Cœur privé `#playPreview(buffer, onEnded)` ;
`previewSample(sampleId, onEnded)` et `previewPcm(pcm, onEnded)` ne font que résoudre leur
buffer et renvoient `false` si rien n'a pu être lancé (buffer non chargé, sélection vide).
`onEnded` n'est notifié qu'à la **fin NATURELLE** de la lecture, gardé par **identité de
source** — le `onended` tardif (asynchrone) d'une lecture remplacée ou stoppée ne notifie
jamais, sinon il effacerait le reflet d'une relecture du même sample.

Côté commandes, la règle « **toute action fait office de stop** » est appliquée
**mécaniquement** : la liste exportée `PREVIEW_STOPPING_COMMANDS` (commands.ts) énumère les
commandes d'interaction, enveloppées d'un `stopPreview()` en fin de `createCommands` —
zéro saupoudrage, et un test générique itère la liste. Les interactions **locales aux
vues** (recherche, chips locales du picker, dépliage) appellent `commands.stopPreview()`
directement — même règle, côté vue. `previewSample` (bascule ▶/■) stoppe TOUJOURS la
lecture courante avant de lancer : un échec de lancement ne laisse jamais un son orphelin.

### Gain : dB → amplitude

`src/engine/voice.ts` — `gainDbToAmplitude(dB)` : `amp = dB <= -60 ? 0 : 10^(dB/20)`.
`0 dB` = niveau d'origine (×1), `-60 dB` = muet (×0).

### Flux (rappel archi)

`UI → intention → commande → engine`. L'UI ne touche jamais l'engine directement : elle passe par
`app.commands` (`resumeAudio`, et au M1 le harnais `loadDemoSound` / `fireDemoPad`). L'engine
notifie `onPlayingChanged` → `create-app.ts` reflète dans `store.activePadIds` (décision B).

## Démo M1 (harnais **temporaire**)

`src/ui/dev/M1AudioDemo.svelte` : un **pad codé en dur** qui joue un fichier audio chargé.

- Chargement du fichier via l'**API File du navigateur** (`<input type="file">`), pas encore le
  pipeline d'import réel (dialog Tauri + ré-encodage Opus + bibliothèque → **M4**). Choix qui
  rend la démo testable **en Vite nu** (http://localhost:1420) **et** dans la WebView Tauri
  (Android).
- Le voyant « Lecture… » est piloté par `store.activePadIds` → valide la chaîne
  `onPlayingChanged`.
- Ce composant et les commandes `loadDemoSound` / `fireDemoPad` (+ pad/page codés en dur dans
  `commands.ts`) seront **retirés** quand `PadGrid` / `Library` réels arriveront (M2/M3/M4).

### Essayer

1. Env dev lancé (voir [environnement Docker](./environnement-docker.md)) → http://localhost:1420.
2. « Charger un son… » → choisir un fichier audio (wav, mp3, ogg, flac…).
3. Appuyer sur **Pad démo** → le son joue (One-Shot) ; re-tap = relance depuis 0.

> Note autoplay : le premier son n'est émis qu'après un **geste** (le choix de fichier ou l'appui
> sur le pad appelle `resume()`). C'est voulu (politique navigateur/mobile).

## Tests

Voir [tests](./tests.md). Le cœur audio est couvert par `tests/engine/*.test.ts` (Web Audio
simulé par un `AudioContext` factice injecté via l'option `createContext`).
