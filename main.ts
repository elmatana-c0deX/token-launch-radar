// Token Launch Radar — entrypoint (Node 22, standard library only).
//
// What a run does, in order:
//   1. loads the sealed snapshot (default /input/snapshot.json, or --input <file|dir>)
//   2. scores it with the model in lib/model.ts and refuses a board the gate would refuse
//   3. writes board.json and the dashboard's data.js into the output directory
//      (default /output, or --output <dir>, or $MAKEFUN_OUTPUT_DIR outside the grader)
//   4. copies this repository's dashboard/ and screenshots/ beside them
//   5. writes dossier.json last, with the vendored make.fun library, so the dossier is
//      built from exactly the files the scorer will rebuild it from.
//
// Run locally:  MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
// The board's shape is guarded twice on purpose: once here, by boardIssue, and once by the
// scorer's own gate — a run that would hand in a refused board fails loudly instead.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));

/** Read `--name value` or `--name=value` from argv; `fallback` when the flag is absent. */
function flagValue(name: string, fallback: string): string {
  const args = process.argv.slice(2);
  const at = args.indexOf(`--${name}`);
  if (at !== -1 && args[at + 1] !== undefined) return args[at + 1]!;
  const glued = args.find((a) => a.startsWith(`--${name}=`));
  return glued === undefined ? fallback : glued.slice(name.length + 3);
}

function die(message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(2);
}

// --- locate the snapshot -----------------------------------------------------

const inputArg = flagValue('input', '/input');
const snapshotPath = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(snapshotPath)) {
  die(`no snapshot at ${snapshotPath}: pass --input <snapshot.json|directory> or mount the sealed /input`);
}
const outputDir = flagValue('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// --- score -------------------------------------------------------------------

const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const problem = boardIssue(board, snapshot);
if (problem !== null) die(`the model wrote a board the gate refuses: ${problem}`);

// --- write the board and the dashboard's data --------------------------------

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outputDir, 'data.js'), dataScript(radar));

// --- copy the page and its screenshots ----------------------------------------

/** Copy the regular files of one flat directory, skipping dotfiles; returns the names copied. */
function copyFlat(fromDir: string, toDir: string): string[] {
  if (!existsSync(fromDir)) return [];
  mkdirSync(toDir, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(fromDir)) {
    if (name.startsWith('.')) continue;
    const from = join(fromDir, name);
    if (!statSync(from).isFile()) continue;
    copyFileSync(from, join(toDir, name));
    names.push(name);
  }
  return names;
}

copyFlat(join(repoDir, 'dashboard'), join(outputDir, 'dashboard'));
const shotNames = copyFlat(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'));
if (shotNames.length < 3) {
  die(`screenshots/ holds ${shotNames.length} image(s): hand in 3 — the board, a detail view and a filtered view`);
}
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
for (const name of shotNames) {
  if (!IMAGE_NAME.test(name)) die(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
}

// --- the dossier, always last -------------------------------------------------

writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 65_536,
    screenshots: { max: 4, max_bytes: 524_288 },
    dashboard: { max_files: 400, max_bytes: 4_194_304 },
  }),
);

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols read, ${snapshot.watchlist.length} on the watchlist, ` +
    `${board.length} rows ranked (${radar.early_size} early finds, ${radar.live_size} live-token protocols set aside)\n` +
    `token radar: wrote board.json, data.js, dashboard/, screenshots/ (${shotNames.length} images) and dossier.json under ${outputDir}\n`,
);
