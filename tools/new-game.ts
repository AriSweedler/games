// The game scaffolder (AGENT.md "A new game"; docs/design/new-game.md): one command writes the
// skeleton of a shell game and registers it everywhere the harness enumerates games, so the
// scaffolded game passes `npm run typecheck`, its own suite and the conformance suite before a rule
// is written, and the agent that takes it on writes rules, not wiring. The owner, 2026-10-02: "Rely
// on the shell as much as possible … Make it take minimal effort to produce a new game."
//   npm run new-game -- --name tally --title "Tally" --seats 2-2 --hidden-hands no
//   node --experimental-strip-types tools/new-game.ts --name <slug> --title <Title> --seats <min>-<max> --hidden-hands yes|no [--root <dir>]
// The skeleton is tools/new-game/templates.ts (Hive's shape with the game cut out), the registry
// rows tools/new-game/registry.ts (anchored on Hive's rows). After the files: the composed
// index.html (tools/shell-markup.ts --write), the placeholder splash PNG (Hive's, until
// tools/splash.ts renders the game's SVG), Prettier over everything it touched. tools/new-game.test.ts
// scaffolds a throwaway game into a copy of the repo and runs the gates on it.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { REPO_ROOT, isMain } from './legacy/extract.ts';
import { registryEdits } from './new-game/registry.ts';
import { USAGE, namesOf, parseArgs, type NewGameSpec } from './new-game/spec.ts';
import { generatedFiles } from './new-game/templates.ts';

export type ScaffoldResult = Readonly<{
  /** Every file written or edited, repo-relative. */
  touched: ReadonlyArray<string>;
  /** What the agent does next, one line each. */
  next: ReadonlyArray<string>;
}>;

/** The placeholder Open Graph PNG: the newest game's, until `tools/splash.ts` renders this game's SVG. */
const PLACEHOLDER_SPLASH = 'web/public/games/hive/splash.png';

const run = (root: string, args: ReadonlyArray<string>): void => {
  const result = spawnSync(process.execPath, [...args], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0)
    throw new Error(`${args.join(' ')} failed with status ${String(result.status)}`);
};

/**
 * Scaffold `spec` into the repo at `root`: refuse a folder or a registry row that exists, write
 * the skeleton, apply the registry edits, copy the splash placeholder, compose index.html and
 * format what was touched.
 */
export const scaffold = (spec: NewGameSpec, root: string = REPO_ROOT): ScaffoldResult => {
  const n = namesOf(spec);
  const folder = resolve(root, 'web', 'games', n.slug);
  if (existsSync(folder)) throw new Error(`web/games/${n.slug} exists already`);
  const registry = readFileSync(resolve(root, 'tools', 'games.ts'), 'utf8');
  if (new RegExp(`['"]${n.slug}['"]`).test(registry))
    throw new Error(`tools/games.ts already names '${n.slug}'`);

  const files = generatedFiles(spec);
  files.forEach(({ path, content }) => {
    const abs = resolve(root, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  });

  const edits = registryEdits(spec);
  edits.forEach(({ path, apply }) => {
    const abs = resolve(root, path);
    writeFileSync(abs, apply(readFileSync(abs, 'utf8')));
  });

  const png = `web/public/games/${n.slug}/splash.png`;
  mkdirSync(dirname(resolve(root, png)), { recursive: true });
  copyFileSync(resolve(root, PLACEHOLDER_SPLASH), resolve(root, png));

  // The composer reads the committed page before it writes: an empty one stands in for the first run.
  writeFileSync(resolve(folder, 'index.html'), '');
  run(root, ['--experimental-strip-types', 'tools/shell-markup.ts', '--write']);
  const touched = [...files.map((f) => f.path), ...edits.map((e) => e.path)];
  run(root, [
    'node_modules/prettier/bin/prettier.cjs',
    '--log-level',
    'warn',
    '--write',
    ...touched.filter((p) => /\.(ts|css|json)$/.test(p)),
  ]);

  return {
    touched: [...touched, png, `web/games/${n.slug}/index.html`],
    next: [
      `docs/design/${n.slug}.md: the sources and the rules (every TODO row)`,
      `web/games/${n.slug}/src/engine/engine.ts: the real engine and its bot game (engine.test.ts)`,
      `web/games/${n.slug}/src/ui/rules.ts: the one-screen Rules items; ui/sound.ts: a cue per key moment; ui/state.ts: a pause per consequential event`,
      `web/games/${n.slug}/src/ui/render.ts and page.ts: the table; then node --experimental-strip-types tools/shell-markup.ts --write`,
      `web/games/${n.slug}/assets/splash.svg, then node --experimental-strip-types tools/splash.ts (the PNG is Hive's until then)`,
      `tools/games.ts CONFORMANCE.${n.slug}: raise cssFloor and REGISTRY contractFloors after the first build; tools/ci/suites.ts: the coverage rows`,
      `web/index.html: the card's glyph; tools/parity/computed-styles.ts: the game's selectors, then record the two goldens`,
      ...(spec.seats.min < spec.seats.max
        ? [
            `the stepper (${String(spec.seats.min)}-${String(spec.seats.max)} seats): Flip 7's shape (docs/design/flip7.md §8), then delete the two gaps in CONFORMANCE.${n.slug}`,
          ]
        : []),
      `gate: npm run typecheck; eslint and prettier on the touched files; npm run test:${n.slug}; npm run test:harness; npm run test:site`,
    ],
  };
};

const main = (): void => {
  const argv = process.argv.slice(2);
  const rootAt = argv.indexOf('--root');
  const root = rootAt >= 0 ? resolve(argv[rootAt + 1] ?? '') : REPO_ROOT;
  const rest = rootAt >= 0 ? [...argv.slice(0, rootAt), ...argv.slice(rootAt + 2)] : argv;
  const parsed = parseArgs(rest);
  if (!parsed.ok) {
    console.error(`new-game: ${parsed.error}\n${USAGE}`);
    process.exit(2);
  }
  const result = scaffold(parsed.value, root);
  console.log(`new-game: ${parsed.value.slug} scaffolded (${String(result.touched.length)} files)`);
  console.log('next:');
  result.next.forEach((line) => {
    console.log(`  - ${line}`);
  });
};

if (isMain(import.meta.url)) main();
