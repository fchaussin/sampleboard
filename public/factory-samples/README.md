# Samples d'usine (#14)

Contenu embarqué dans **chaque dist** (web, Android, conteneur) : le `public/` de Vite est
copié tel quel au build. Au **premier lancement uniquement** (même garde que banque et tags
par défaut), l'app sème la bibliothèque depuis `manifest.json` et pré-assigne la sélection
`board` à la page « Principal ». Un sample supprimé par l'utilisateur ne repousse jamais.

## Règles (validées À CHAQUE BUILD — plugin `factory-samples-manifest`)

- **OGG/Opus uniquement** : le semis copie les octets sans réencodage runtime. Convertir
  les sources avant dépôt (ffmpeg dockerisé, zéro pollution hôte) :
  `docker run --rm -v "$PWD/public/factory-samples:/s" alpine sh -c 'apk add -q ffmpeg && cd /s && for f in *.mp3; do ffmpeg -i "$f" -c:a libopus -b:a 96k "${f%.mp3}.ogg" && rm "$f"; done'`
- **`manifest.json` = source de vérité** : tout fichier audio du répertoire doit y avoir son
  entrée (et réciproquement), sinon le **build échoue**. Champs par sample :
  - `file` — nom exact du fichier ;
  - `label` — libellé curaté affiché en bibliothèque (donnée utilisateur, FR par défaut) ;
  - `tags` — tokens des tags d'usine (`sfx`, `replies`, `jingle`, `music`, `ambience`,
    `voice`, `reaction`, `meme`, `alert`) ;
  - `source` / `license` — **traçabilité OBLIGATOIRE avant soumission F-Droid** (chaque
    fichier embarqué entre dans l'audit FOSS). `TODO` = avertissement à chaque build.
- **`board`** (optionnel) : sélection pré-assignée aux pads de la page « Principal », dans
  l'ordre des positions ; `playMode` optionnel (`oneShot` | `gate` | `loop`).

## ⚠️ Licences

Uniquement des licences **libres** : CC0 de préférence, sinon CC-BY (avec attribution).
Pas de CC-NC, pas de CC-ND, pas de « libre de droits » sans licence explicite — bloquant
F-Droid. Renseigner `source` + `license` dans le manifest **au moment du dépôt**.
