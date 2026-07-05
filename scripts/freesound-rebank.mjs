// SPDX-License-Identifier: GPL-3.0-or-later
// Rebanque d'usine depuis Freesound (M9/M10, décisions §16) : pour chaque entrée de
// scripts/freesound-worklist.json, cherche un son EXCLUSIVEMENT CC0 (durée bornée), prend le
// meilleur candidat (note moyenne pondérée puis téléchargements), télécharge la preview HQ
// OGG (Vorbis ~192k — la conversion Opus 96k se fait ensuite via ffmpeg dockerisé, voir
// public/factory-samples/README.md) et régénère manifest.json (source + license + boards).
//
// INCRÉMENTAL : un son dont le fichier est déjà déposé dans public/factory-samples/ est
// RÉUTILISÉ tel quel (entrée du manifest déposé conservée, aucun appel API) — les picks
// validés à l'écoute ne bougent jamais. Forcer un re-tirage : --only=<slug[,slug]>.
//
// Usage (dans le conteneur dev) :
//   FREESOUND_TOKEN=xxx node scripts/freesound-rebank.mjs --dry           # montre les choix
//   FREESOUND_TOKEN=xxx node scripts/freesound-rebank.mjs                 # staging + manifest
//   FREESOUND_TOKEN=xxx node scripts/freesound-rebank.mjs --only=grillons # re-tirage ciblé
//
// Sortie : scripts/freesound-staging/fs-<slug>.src.ogg (nouveaux sons uniquement, à convertir)
// + scripts/freesound-staging/manifest.json (COMPLET, prêt à déposer).

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const STAGING = join(here, 'freesound-staging');
const DEPOSITED_DIR = join(here, '..', 'public', 'factory-samples');
const API = 'https://freesound.org/apiv2';
const FIELDS = 'id,name,url,license,duration,avg_rating,num_ratings,num_downloads,username,previews';

const dry = process.argv.includes('--dry');
const only = process.argv
  .filter((a) => a.startsWith('--only='))
  .flatMap((a) => a.slice('--only='.length).split(','));

/** Recherche CC0 bornée en durée, triée par pertinence — renvoie les candidats bruts. */
async function search(query, [minS, maxS]) {
  const token = process.env.FREESOUND_TOKEN;
  if (!token) {
    console.error('FREESOUND_TOKEN manquant (clé API : https://freesound.org/apiv2/apply)');
    process.exit(1);
  }
  const filter = `license:"Creative Commons 0" duration:[${minS} TO ${maxS}]`;
  const url = `${API}/search/text/?query=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}&fields=${FIELDS}&page_size=15&token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`recherche « ${query} » : HTTP ${res.status} ${await res.text()}`);
  return (await res.json()).results ?? [];
}

/**
 * Meilleur candidat : note moyenne PONDÉRÉE (≥ 3 votes, sinon 0) puis téléchargements —
 * la pertinence texte de l'API a déjà ordonné, on départage par la réputation.
 */
function pick(results) {
  const scored = results.map((r, rank) => ({
    r,
    score:
      (r.num_ratings >= 3 ? r.avg_rating : 0) * 1000 +
      Math.min(r.num_downloads ?? 0, 5000) / 5 -
      rank, // à réputation égale, la pertinence texte garde la main
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.r ?? null;
}

const worklist = JSON.parse(readFileSync(join(here, 'freesound-worklist.json'), 'utf8'));
const deposited = existsSync(join(DEPOSITED_DIR, 'manifest.json'))
  ? JSON.parse(readFileSync(join(DEPOSITED_DIR, 'manifest.json'), 'utf8'))
  : { samples: [] };
const depositedByFile = new Map((deposited.samples ?? []).map((s) => [s.file, s]));

if (!dry) mkdirSync(STAGING, { recursive: true });

const manifest = { samples: [], boards: [] };
const boardsByPage = new Map(); // page → { page, rows?, cols?, slots: sparse[] }
const misses = [];
let reused = 0;

for (const entry of worklist.sounds) {
  const file = `fs-${entry.slug}.ogg`;

  const keepDeposited =
    !only.includes(entry.slug) &&
    existsSync(join(DEPOSITED_DIR, file)) &&
    depositedByFile.has(file);

  let sampleEntry;
  if (keepDeposited) {
    // Pick déjà validé à l'écoute : entrée déposée conservée, AUCUN re-tirage.
    const kept = depositedByFile.get(file);
    sampleEntry = { ...kept, label: entry.label, tags: entry.tags };
    reused += 1;
  } else {
    const best = pick(await search(entry.query, entry.durationS));
    if (!best) {
      misses.push(entry.slug);
      console.log(`✗ ${entry.slug} — AUCUN résultat CC0 pour « ${entry.query} »`);
      continue;
    }
    console.log(
      `✓ ${entry.slug} ← #${best.id} « ${best.name} » (${best.duration.toFixed(1)}s, ` +
        `note ${best.avg_rating?.toFixed(1)}/${best.num_ratings}, ${best.num_downloads} dl, par ${best.username})`,
    );
    if (!dry) {
      const preview = best.previews?.['preview-hq-ogg'];
      if (!preview) throw new Error(`${entry.slug} : pas de preview HQ OGG`);
      const audio = await fetch(preview);
      if (!audio.ok) throw new Error(`${entry.slug} : téléchargement HTTP ${audio.status}`);
      writeFileSync(join(STAGING, `fs-${entry.slug}.src.ogg`), Buffer.from(await audio.arrayBuffer()));
    }
    sampleEntry = {
      file,
      label: entry.label,
      tags: entry.tags,
      source: `${best.url} (« ${best.name} » par ${best.username}, Freesound #${best.id}, preview HQ)`,
      license: 'CC0-1.0',
    };
  }

  manifest.samples.push(sampleEntry);
  if (entry.board) {
    const page = entry.board.page ?? 1;
    if (!boardsByPage.has(page)) {
      const grid = (worklist.boards ?? {})[String(page)] ?? {};
      boardsByPage.set(page, { page, ...grid, slots: [] });
    }
    boardsByPage.get(page).slots[entry.board.position] = {
      file,
      ...(entry.board.playMode ? { playMode: entry.board.playMode } : {}),
    };
  }
}

manifest.boards = [...boardsByPage.values()]
  .sort((a, b) => a.page - b.page)
  .map((b) => ({ ...b, slots: b.slots.filter(Boolean) }));

if (!dry) {
  writeFileSync(join(STAGING, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `\nmanifest COMPLET (${manifest.samples.length} sons, ${reused} réutilisés tels quels, ` +
      `${manifest.samples.length - reused} nouveaux) dans ${STAGING}`,
  );
  console.log('Conversion Opus 96k des nouveaux : voir public/factory-samples/README.md.');
} else if (reused > 0) {
  console.log(`(+ ${reused} sons déjà déposés, réutilisés tels quels — non listés)`);
}
if (misses.length) console.log(`\nSans équivalent CC0 : ${misses.join(', ')} — requêtes à ajuster.`);
