// LUMEN DRIFT — the hand-in program (Node 22, standard library only).
//
// It takes this repository's game/ and screenshots/ and writes them, plus the
// dossier the judge reads, into /output (or MAKEFUN_OUTPUT_DIR when that is
// set, for local checks). The dossier is built by the kit's vendored library,
// with the scorer's own caps, so what lands in /output is exactly what the
// gate checks: at most 4 screenshots of 256 KiB, a game of at most 993 files
// and 48 MiB with no path over 1,000 bytes, and a dossier text of 160 KiB.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error(`game/index.html is missing under ${gameDir}`);
}
if (!existsSync(shotsDir)) {
  throw new Error(`screenshots/ is missing under ${shotsDir}`);
}

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

// The scorer's caps, as the kit states them: only text_max_bytes shapes the
// dossier's bytes; the rest refuse an entry the scorer would refuse.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Lumen Drift handed in to ${outDir}`);
