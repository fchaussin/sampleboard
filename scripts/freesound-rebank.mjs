// SPDX-License-Identifier: GPL-3.0-or-later
// Rebanque d'usine depuis Freesound (M9, décision 2026-07-04) : pour chaque entrée de
// scripts/freesound-worklist.json, cherche un son EXCLUSIVEMENT CC0 (durée bornée), prend le
// meilleur candidat (note moyenne pondérée puis téléchargements), télécharge la preview HQ
// OGG (Vorbis ~192k — la conversion Opus 96k se fait ensuite via ffmpeg dockerisé, voir
// public/factory-samples/README.md) et régénère manifest.json (source + license renseignés).
//
// Usage (dans le conteneur dev) :
//   FREESOUND_TOKEN=xxx node scripts/freesound-rebank.mjs --dry           # montre les choix, ne télécharge rien
//   FREESOUND_TOKEN=xxx node scripts/freesound-rebank.mjs                 # écrit staging/ + manifest.json
//   FREESOUND_TOKEN=xxx node scripts/freesound-rebank.mjs --only=grillons # remplacement à l'unité
//     (--only : le manifest de staging ne contient QUE ces slugs — à fusionner dans le
//      manifest déposé, les autres entrées validées ne sont jamais re-tirées)
//
// Sortie : scripts/freesound-staging/fs-<slug>.src.ogg (Vorbis, à convertir) +
// scripts/freesound-staging/manifest.json (prêt à déposer dans public/factory-samples/).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const STAGING = join(here, 'freesound-staging');
const API = 'https://freesound.org/apiv2';
const FIELDS = 'id,name,url,license,duration,avg_rating,num_ratings,num_downloads,username,previews';

const token = process.env.FREESOUND_TOKEN;
if (!token) {
  console.error('FREESOUND_TOKEN manquant (clé API : https://freesound.org/apiv2/apply)');
  process.exit(1);
}
const dry = process.argv.includes('--dry');
const only = process.argv
  .filter((a) => a.startsWith('--only='))
  .flatMap((a) => a.slice('--only='.length).split(','));

/** Recherche CC0 bornée en durée, triée par pertinence — renvoie les candidats bruts. */
async function search(query, [minS, maxS]) {
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
if (only.length) worklist.sounds = worklist.sounds.filter((s) => only.includes(s.slug));
if (!dry) mkdirSync(STAGING, { recursive: true });

const manifest = { samples: [], board: [] };
const misses = [];

for (const entry of worklist.sounds) {
  const results = await search(entry.query, entry.durationS);
  const best = pick(results);
  if (!best) {
    misses.push(entry.slug);
    console.log(`✗ ${entry.slug} — AUCUN résultat CC0 pour « ${entry.query} »`);
    continue;
  }
  const file = `fs-${entry.slug}.ogg`;
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
  manifest.samples.push({
    file,
    label: entry.label,
    tags: entry.tags,
    source: `${best.url} (« ${best.name} » par ${best.username}, Freesound #${best.id}, preview HQ)`,
    license: 'CC0-1.0',
  });
  if (entry.board) {
    manifest.board[entry.board.position] = {
      file,
      ...(entry.board.playMode ? { playMode: entry.board.playMode } : {}),
    };
  }
}

manifest.board = manifest.board.filter(Boolean);
if (!dry) {
  writeFileSync(join(STAGING, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nmanifest + ${manifest.samples.length} previews dans ${STAGING}`);
  console.log('Conversion Opus 96k : voir public/factory-samples/README.md (ffmpeg dockerisé).');
}
if (misses.length) console.log(`\nSans équivalent CC0 : ${misses.join(', ')} — requêtes à ajuster.`);
