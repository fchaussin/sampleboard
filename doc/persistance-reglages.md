<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Persistance & réglages (jalon M5)

Le **comment** de la persistance SQLite, de l'autosave et des réglages. Le **quoi/pourquoi**
(schéma, décisions A/B, arrière-plan) est dans [`specifications.md` §8, §9, §12](../specifications.md).

## Où vivent les données

| Donnée | Emplacement |
|---|---|
| Base SQLite | `{appConfigDir}/sampleboard.db` (résolu par tauri-plugin-sql, créé au besoin) |
| Octets audio | `{appDataDir}/audio/{sampleId}.ogg` (jamais de BLOB, §8) |

Sous Linux : `~/.config/org.sampleboard.app/` et `~/.local/share/org.sampleboard.app/audio/`
(selon l'`identifier` de `tauri.conf.json`).

## Couche `storage`

- **`db.ts`** — contrat `SqlExecutor` (`execute`/`select`) + **migrations** par `user_version`
  (`openDatabase` applique les manquantes en séquence, jamais de destruction silencieuse).
  Migration 1 = schéma §8 ; migration 2 (M6) = colonnes `color` ; migration 3 (M6) =
  bornes de grille 1×1 (reconstruction de `pages`, procédure SQLite). Aussi :
  `createWriteLock()` (voir ci-dessous).
- **`tauri.ts`** — SEUL module qui touche les plugins : exécuteur sur `Database.load` (plugin sql)
  et `AudioFileStore` sur plugin fs (`BaseDirectory.AppData`, `mkdir` paresseux de `audio/`).
  Chargé par **import dynamique** uniquement sous Tauri.
- **`bank-repository.ts`** — `load()` reconstruit l'arbre (banque → pages → pads, triés par
  `position` ; 0 page = état invalide → `null` → banque par défaut). `save()` en **transaction**,
  stratégie **upsert-puis-élagage** (`ON CONFLICT(id) DO UPDATE`, puis `DELETE … NOT IN`) : une
  sauvegarde interrompue laisse des lignes valides, jamais un « tout supprimé, rien réinséré ».
  Le `sample_id` d'un pad passe par `(SELECT id FROM samples WHERE id = ?)` : une référence
  pendante s'écrit `NULL` au lieu de violer la clé étrangère.
- **`sample-repository.ts`** — métadonnées SQLite + octets via `AudioFileStore`. `add` écrit le
  fichier **puis** la ligne (échec d'insertion → fichier retiré) ; `remove` supprime la ligne
  (**`ON DELETE SET NULL`** sur les pads, §8) puis le fichier (orphelin toléré + `console.warn`).
- **`settings-repository.ts`** — ligne unique `id = 0`, `load` → défauts si absente, `save` upsert.
- **`memory.ts`** — fallback **navigateur nu** (:1420) : mêmes contrats, en mémoire, session
  seulement. Le « mode navigateur pur » persistant reste une évolution v2 (§17).

### Verrou d'écriture partagé (`createWriteLock`)

`tauri-plugin-sql` s'appuie sur un **pool sqlx** (connexions paresseuses, jusqu'à 10) : deux
opérations concurrentes peuvent s'exécuter sur **des connexions différentes** — fatal pour la
transaction de `bank-repository` (`BEGIN`/`COMMIT` séparés) et source d'entrelacements (un
`INSERT samples` qui atterrit dans la transaction banque). La composition root crée **un**
verrou (file de promesses) partagé par les trois dépôts : chaque opération d'écriture logique
s'exécute seule, le pool ne dépasse jamais une connexion, les transactions sont sûres par
construction. Les dépôts acceptent le verrou en paramètre (`NO_LOCK` par défaut pour les tests
séquentiels).

## Autosave (`persistence.ts`, décision A §9)

- **Banque** : abonné réactif unique → **débounce 400 ms**, le dernier état gagne (un save par
  rafale). `snapshotBank` fait une copie profonde **explicite** : elle abonne le watcher à toutes
  les feuilles de l'arbre ET découple le snapshot des mutations suivantes.
- **Réglages** : deuxième abonné, écriture **immédiate** (hors debounce).
- **Bibliothèque** : n'est PAS dans l'autosave — l'import/renommage/suppression écrivent
  **immédiatement** via `sampleRepository` dans les commandes.
- Les écritures s'**enchaînent** (file interne) ; un échec est journalisé sans casser la file.
- `flush()` : écrit sans attendre le debounce — appelé sur `visibilitychange → hidden` (l'app
  Android peut être gelée/tuée juste après).
- **`start()` n'est appelé qu'APRÈS hydratation** : l'état par défaut n'écrase jamais la base.

La réactivité est **injectée** : `persistence.ts` reste TS pur (testable aux timers simulés) via
le contrat `Watch` ; l'implémentation runes (`$effect.root` + `$effect`, premier passage ignoré,
`untrack` sur le traitement) vit dans **`watch.svelte.ts`** — seul pont Svelte de la couche app.

## Démarrage (`create-app.ts`, asynchrone depuis M5)

1. Runtime **Tauri** ? → exécuteur sql + `openDatabase` (migrations) + fichiers ; sinon dépôts
   **mémoire**.
2. Hydratation : **réglages** → **bibliothèque** (+ chargement des buffers dans le moteur ;
   fichier illisible = `console.warn`, le pad joue un no-op, §12) → **banque** (absente → banque
   par défaut créée et sauvée : 1 page 4×4 Poly vide, `default-bank.ts`).
3. `persistence.start()` puis câblage `visibilitychange` (voir ci-dessous).

`main.ts` attend `createApp()` avant de monter l'UI (`app.bootError` affiché en cas d'échec).
La banque seed dev (`dev-seed.ts`) est **retirée** — l'app démarre sur la banque par défaut.

## Arrière-plan (`Settings.backgroundBehavior`, §12)

`visibilitychange → hidden` (WebView Android : couvre mise en arrière-plan/veille) déclenche
`commands.applyBackgroundBehavior(true)` :

| Réglage | Effet |
|---|---|
| `stopAll` (défaut) | `engine.stopAll()` + `engine.suspend()` |
| `stopSustained` | `engine.stopSustained()` — stoppe les voix **entretenues** (Gate/Loop), laisse finir les One-Shot |
| `keepPlaying` | rien — l'audio continue |

Retour au premier plan : **aucun** `resume()` automatique — il repart au prochain geste (§12).
Le moteur marque chaque voix `sustained` (Gate/Loop) à la création. `persistence.flush()` est
aussi appelé au passage en arrière-plan.

## UI `Settings.svelte`

Contenu du **tiroir Réglages** (agencement M6, voir [interface](./interface.md)) :
Arrière-plan (3 options), Nombre maximum de voix (entier ≥ 1, borné par `setMaxVoices`),
Langue (`availableLocales()`). Persisté immédiatement.

## Capabilities (src-tauri)

Ajoutées pour M5 : **`sql:allow-execute`** (écritures/DDL — le défaut du plugin ne donne que
load/select/close) et **`fs:allow-appdata-write-recursive`** (écriture/suppression/mkdir sous
`$APPDATA` — le défaut est en lecture seule).

## Tests

- `tests/storage/*` — dépôts et migrations exercés contre un **vrai SQLite en mémoire**
  (`node:sqlite`, Node ≥ 22.5 du conteneur dev ; exécuteur de test
  `node-sqlite-executor.ts`, types ambiants minimaux `node-sqlite.d.ts` — pas de dépendance
  `@types/node`). Aller-retour banque, upsert/élagage, cascades, `ON DELETE SET NULL`, CHECK,
  clés étrangères, verrou d'écriture.
- `tests/app/persistence.test.ts` — debounce, rafale → un save, flush, stop, résilience aux
  échecs (réactivité factice + timers simulés).
- `tests/app/commands.settings.test.ts` + `tests/engine/audio-engine.m5.test.ts` — réglages,
  `applyBackgroundBehavior`, `stopAll`/`stopSustained`/`suspend`.

## Valider à la main (fenêtre Tauri)

```bash
docker compose -f docker-compose.dev.yml -f docker-compose.gui.yml run --rm dev npm run tauri dev
```

1. Importer un son, créer/renommer des pads et pages, régler gain/mode, changer les Réglages.
2. Fermer la fenêtre, relancer : **tout est rechargé fidèlement** (banque, bibliothèque jouable,
   réglages).

> Au navigateur nu (http://localhost:1420), la persistance est **volontairement absente**
> (dépôts mémoire) : recharger la page repart de la banque par défaut.
