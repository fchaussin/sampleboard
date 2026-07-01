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

`press` / `release` / `toggleLoop` / `stopPad` / `stopPage` sont des **stubs (M2)** : Gate, Loop,
Polyphonie Mono/Poly et plafond de voix FIFO arrivent au jalon suivant.

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
