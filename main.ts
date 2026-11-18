// Token Radar's entrypoint: snapshot in, ranked board and dashboard out (Node 22, stdlib only).
//
// It reads the sealed snapshot (from /input/snapshot.json, or --input <file|dir>), scores every
// pre-token protocol with the model in lib/model.ts, writes the ranked board to /output/board.json,
// writes the dashboard's data beside the page as data.js, and copies this repository's dashboard/
// and screenshots/ to /output. Last, it writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library. The dashboard is a static page with no framework and no
// network, and the gate's shape is kept: the board, the data, the page, the shots, the dossier.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import { buildRadar, boardIssue, dataScript, parseSnapshot } from './lib/model.ts';
import * as makefunBoard from './vendor/makefun-board.ts';

const here = path.dirname(url.fileURLToPath(import.meta.url));

// The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse.
const TEXT_CAP = 65536;
const SHOT_CAP = { max: 4, max_bytes: 524288 };
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Stop with a message on stderr and an exit code. */
function fail(message: string, code: number): never {
  process.stderr.write(message);
  process.exit(code);
}

/** A `--name <value>` argument, or the fallback when it is absent. */
function flag(name: string, fallback: string): string {
  const argv = process.argv;
  const at = argv.indexOf('--' + name);
  if (at >= 0 && at + 1 < argv.length) return argv[at + 1]!;
  const joined = argv.find((a) => a.startsWith('--' + name + '='));
  return joined === undefined ? fallback : joined.slice(name.length + 3);
}

const inputArg = flag('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : path.join(inputArg, 'snapshot.json');
if (!fs.existsSync(inputFile)) {
  fail('token radar: no snapshot at ' + inputFile + ': pass --input <snapshot.json|directory> or mount the sealed /input\n', 2);
}
const out = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(fs.readFileSync(inputFile, 'utf8'));
const built = buildRadar(snapshot);
const issue = boardIssue(built.board, snapshot);
if (issue) fail('token radar: the model wrote a board the gate refuses: ' + issue + '\n', 1);
const board = built.board;
const radar = built.radar;

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'board.json'), JSON.stringify({ rows: board }) + '\n');
fs.writeFileSync(path.join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFlat(from: string, to: string): string[] {
  if (!fs.existsSync(from)) return [];
  fs.mkdirSync(to, { recursive: true });
  return fs.readdirSync(from).filter((name) => {
    if (name[0] === '.') return false;
    const src = path.join(from, name);
    if (!fs.statSync(src).isFile()) return false;
    fs.copyFileSync(src, path.join(to, name));
    return true;
  });
}

copyFlat(path.join(here, 'dashboard'), path.join(out, 'dashboard'));
const shots = copyFlat(path.join(here, 'screenshots'), path.join(out, 'screenshots'));
if (shots.length <= 2) {
  fail('token radar: screenshots/ holds ' + shots.length + ' image' + (shots.length === 1 ? '' : 's') + ': hand in 3, the board, a detail view and a filtered view\n', 1);
}
for (const shot of shots) {
  if (!SHOT_NAME.test(shot)) {
    fail('token radar: screenshots/' + shot + ': a name is letters, digits and . _ -, 1 to 128 characters\n', 1);
  }
}

// The dossier comes last: the scorer rebuilds it from this /output and compares the bytes.
const dossier = makefunBoard.buildDossier(out, { text_max_bytes: TEXT_CAP, screenshots: SHOT_CAP, dashboard: { max_files: 400, max_bytes: 4194304 } });
fs.writeFileSync(path.join(out, 'dossier.json'), dossier);

process.stdout.write('token radar: ' + snapshot.protocols.length + ' protocols, ' + snapshot.watchlist.length + ' on the watchlist, ' + board.length + ' rows scored (' + radar.early_size + ' early, ' + radar.live_size + ' live set aside)\n');
process.stdout.write('token radar: wrote ' + path.join(out, 'board.json') + ', ' + path.join(out, 'data.js') + ', ' + path.join(out, 'dashboard') + ' (3 files), ' + path.join(out, 'screenshots') + ' (' + shots.length + ' images) and ' + path.join(out, 'dossier.json') + '\n');
