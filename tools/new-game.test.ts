// The scaffolder's proof (docs/design/new-game.md §5): a throwaway game scaffolded into a copy of
// this checkout passes the gates AGENT.md "A new game" step 12 names that need no build and no
// browser: `tsc -b` over the three projects, eslint over the game and the files the edits touched,
// the game's own suite, the harness pins (tools/games.test.ts, tools/ci/*.test.ts) with the
// conformance suite, the shared pins (roomCode, ids) and the dist guards' pure half (classes). The
// copy is a plain directory with the checkout's node_modules linked in (nothing is installed) and a
// one-commit git history (tools/ci/affected.test.ts diffs HEAD against itself). The two shapes the
// flags pick between are proved: two seats with nothing hidden (Hive's), and a hidden hand with a
// seat range, whose stepper is a declared gap. Pure helpers (the arg parser, the anchored edits)
// are pinned beside, without a copy, and so is the table block the template spells
// (docs/design/dry-review-2026-10.md §6: the shell's partials, pause, sheets and types, and none
// of the pre-hoist shapes), so a row that edits the template is held to it without the copy's
// minute. Runs in the harness suite (tools/ci/suites.ts).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve, sep } from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { REPO_ROOT } from './legacy/extract.ts';
import { scaffold } from './new-game.ts';
import {
  insertAfter,
  insertAfterBlock,
  listItemAfter,
  registryEdits,
} from './new-game/registry.ts';
import { namesOf, parseArgs, type NewGameSpec } from './new-game/spec.ts';
import { generatedFiles } from './new-game/templates.ts';

/** What the copy leaves out: the history, the installed packages (linked instead), the baselines, the build, the frozen pages and the iOS clip. */
const SKIPPED: ReadonlyArray<string> = [
  '.git',
  'node_modules',
  `e2e${sep}__screenshots__`,
  'dist',
  'ios',
  'legacy',
  'shots',
  'coverage',
  'test-results',
  'playwright-report',
];

/** A copy of the checkout at a fresh temp dir, node_modules linked, one commit on it. */
const copyRepo = (): string => {
  const root = mkdtempSync(resolve(tmpdir(), 'new-game-'));
  cpSync(REPO_ROOT, root, {
    recursive: true,
    filter: (src) => {
      const rel = relative(REPO_ROOT, src);
      if (rel === '') return true;
      if (rel.endsWith('.tsbuildinfo')) return false;
      return !SKIPPED.some((skip) => rel === skip || rel.startsWith(`${skip}${sep}`));
    },
  });
  symlinkSync(resolve(REPO_ROOT, 'node_modules'), resolve(root, 'node_modules'));
  const git = (...args: ReadonlyArray<string>): void => {
    const r = spawnSync(
      'git',
      ['-c', 'user.name=scaffold', '-c', 'user.email=scaffold@example.invalid', ...args],
      { cwd: root, encoding: 'utf8' },
    );
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  };
  git('init', '-q');
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'the copy');
  return root;
};

/** The env a child node gets: this vitest's worker markers stripped, so a nested run is its own. */
const childEnv = (): NodeJS.ProcessEnv =>
  Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VITEST')));

/** Run `node <args>` at `root`; the combined output is the failure's message. */
const node = (root: string, args: ReadonlyArray<string>, env: NodeJS.ProcessEnv = {}): void => {
  const r = spawnSync(process.execPath, [...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...childEnv(), ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  expect(r.status, `${args.join(' ')}\n${r.stdout}\n${r.stderr}`).toBe(0);
};

const vitest = (root: string, suite: string, files: ReadonlyArray<string>): void => {
  node(root, ['node_modules/vitest/vitest.mjs', 'run', '--project', suite, ...files], {
    VITEST_SUITE: suite,
  });
};

const roots: string[] = [];
afterAll(() => {
  roots.forEach((root) => {
    rmSync(root, { recursive: true, force: true });
  });
});

/** Scaffold `spec` into a fresh copy and run every build-free gate on it. */
const prove = (spec: NewGameSpec): void => {
  const root = copyRepo();
  roots.push(root);
  const n = namesOf(spec);
  const result = scaffold(spec, root);
  expect(result.touched).toContain(`web/games/${n.slug}/index.html`);
  expect(existsSync(resolve(root, 'web', 'games', n.slug, 'index.html'))).toBe(true);
  expect(readFileSync(resolve(root, 'web', 'games', n.slug, 'index.html'), 'utf8')).toContain(
    `<title>${n.title}</title>`,
  );
  // A second run refuses: the folder and the registry row exist.
  expect(() => scaffold(spec, root)).toThrow(/exists already/);

  node(root, ['node_modules/typescript/bin/tsc', '-b']);
  node(root, [
    'node_modules/eslint/bin/eslint.js',
    '--max-warnings',
    '0',
    `web/games/${n.slug}`,
    `e2e/${n.slug}.spec.ts`,
    `e2e/fixtures/${n.slug}.ts`,
    ...registryEdits(spec)
      .map((e) => e.path)
      .filter((p) => p.endsWith('.ts')),
  ]);
  node(root, [
    'node_modules/prettier/bin/prettier.cjs',
    '--check',
    ...generatedFiles(spec)
      .map((f) => f.path)
      .filter((p) => /\.(ts|css)$/.test(p)),
  ]);
  vitest(root, n.slug, []);
  vitest(root, 'harness', [
    'test/game-conformance.test.ts',
    'tools/games.test.ts',
    'tools/ci/suites.test.ts',
    'tools/ci/affected.test.ts',
  ]);
  vitest(root, 'shared', ['web/shared/lib/roomCode.test.ts', 'web/shared/ui/ids.test.ts']);
  vitest(root, 'site', ['test/dist/classes.test.ts']);
};

describe('the scaffold on a copy of the checkout', { timeout: 300_000 }, () => {
  test('two seats, nothing hidden: typecheck, lint, the game suite, the harness pins and the conformance suite pass before a rule is written', () => {
    prove({ slug: 'tally', title: 'Tally', seats: { min: 2, max: 2 }, hidden: false });
  });

  test('a hidden hand and a seat range: the curtain shape, the stepper as a declared gap', () => {
    prove({ slug: 'veil', title: 'Veil', seats: { min: 2, max: 4 }, hidden: true });
  });
});

describe('the arguments', () => {
  test('the four flags, with their defaults and their checks', () => {
    expect(
      parseArgs(['--name', 'tally', '--title', 'Tally', '--seats', '2-4', '--hidden-hands', 'yes']),
    ).toEqual({
      ok: true,
      value: { slug: 'tally', title: 'Tally', seats: { min: 2, max: 4 }, hidden: true },
    });
    expect(parseArgs(['--name', 'tally', '--title', 'Tally'])).toEqual({
      ok: true,
      value: { slug: 'tally', title: 'Tally', seats: { min: 2, max: 2 }, hidden: false },
    });
    expect(parseArgs(['--name', 'Gin-Rummy', '--title', 'x']).ok).toBe(false);
    expect(parseArgs(['--name', 'tally']).ok).toBe(false);
    expect(parseArgs(['--name', 'tally', '--title', 'T', '--seats', '1-2']).ok).toBe(false);
    expect(parseArgs(['--name', 'tally', '--title', 'T', '--seats', '3-2']).ok).toBe(false);
    expect(parseArgs(['--name', 'tally', '--title', 'T', '--hidden-hands', 'maybe']).ok).toBe(
      false,
    );
    expect(parseArgs(['--name']).ok).toBe(false);
    expect(parseArgs(['tally']).ok).toBe(false);
    expect(
      namesOf({ slug: 'tally', title: 'Tally', seats: { min: 2, max: 2 }, hidden: false }),
    ).toEqual({
      slug: 'tally',
      pascal: 'Tally',
      upper: 'TALLY',
      hook: '__tally',
      title: 'Tally',
    });
  });
});

/** The scaffold's file whose path ends with `suffix`, read off the template without a copy. */
const generated = (spec: NewGameSpec, suffix: string): string => {
  const file = generatedFiles(spec).find((f) => f.path.endsWith(suffix));
  if (file === undefined) throw new Error(`no generated file ends with ${suffix}`);
  return file.content;
};

/** The two shapes the flags pick between, as the copies above prove them. */
const OPEN: NewGameSpec = {
  slug: 'tally',
  title: 'Tally',
  seats: { min: 2, max: 2 },
  hidden: false,
};
const VEILED: NewGameSpec = {
  slug: 'veil',
  title: 'Veil',
  seats: { min: 2, max: 4 },
  hidden: true,
};

/** What a game made before the hoists carried and the shell owns since (dry-review-2026-10.md §6): none may be in a scaffold. */
const PRE_HOIST: ReadonlyArray<string> = [
  'historyOpen',
  'SCREENS',
  'paintConnDot',
  'paintHandoff',
  'paintScreen',
  'soundEnabled',
  'LEAVE_',
  'DEFAULT_NAME',
  'rulesItemsHtml',
  'continue/click',
  'rsContinueBtn',
];

describe('the table block the template spells (dry-review-2026-10.md §6)', () => {
  test('the page: the topbar partial, the pause and the result through the shell, the curtain words by shape', () => {
    [OPEN, VEILED].forEach((spec) => {
      const page = generated(spec, '/page.ts');
      expect(page).toContain("topbarHtml({ dot: 'last'");
      expect(page).toContain('result: resultMarkup({');
      expect(page).toMatch(
        /_PAGE: ShellPage = \{ copy, notes, look: THEME_LOOK, blocks, pause: true \};/,
      );
      expect(page).toContain("revealLabel: 'Show the table'");
      // The partials spell these; a page that did would compose them twice.
      expect(page).not.toContain('pauseOverlay');
      expect(page).not.toContain('resultOverlay');
      expect(page).not.toContain('seated: true');
    });
    expect(generated(VEILED, '/page.ts')).toContain(
      "curtainNote: ': raised on every change of turn",
    );
    expect(generated(OPEN, '/page.ts')).toContain(
      "curtainNote: ': composed by the shell, never raised",
    );
  });

  test("the reducer and the paint: GameTypes over a Table of the curtain alone, the pause through table.pause, the sheets and the chrome the shell's", () => {
    const state = generated(OPEN, '/src/ui/state.ts');
    expect(state).toContain('export type Tally = GameTypes<{');
    expect(state).toContain('export const initialTable: Table = { curtain: null };');
    expect(state).toContain("export type TableIntent = Readonly<{ type: 'act'; action: Action }>;");
    expect(state).toContain('pause: (_app, prev, view) => pauseFor(prev, view)');
    expect(state).toContain('export const reducer = shellReducer(TALLY, {');
    const render = generated(OPEN, '/src/ui/render.ts');
    expect(render).toContain('paintShellChrome(doc, app.shell, {');
    expect(render).toContain('paintShellSheets(doc, app.shell);');
    expect(render).toContain("['historyBtn', { type: 'history/open' }]");
  });

  test('the wire and the store: a game for two, through twoSeatProtocol and shellStore (the seat range is the declared gap)', () => {
    [OPEN, VEILED].forEach((spec) => {
      expect(generated(spec, '/src/protocol.ts')).toContain(
        'twoSeatProtocol({ decodeAction, decodeView, room })',
      );
      expect(generated(spec, '/src/storage.ts')).toContain('shellStore<State, Opts, HomeTab>(');
    });
  });

  test('no pre-hoist shape anywhere in either scaffold', () => {
    [OPEN, VEILED].forEach((spec) => {
      generatedFiles(spec).forEach(({ path, content }) => {
        PRE_HOIST.forEach((token) => {
          expect(content, `${path} spells ${token}`).not.toContain(token);
        });
      });
    });
  });
});

describe('the anchored edits', () => {
  test('insertAfter and insertAfterBlock demand one anchor and name the file', () => {
    expect(insertAfter('a\nb\n', 'a\n', 'x\n')).toBe('a\nx\nb\n');
    expect(() => insertAfter('a\na\n', 'a\n', 'x', 'f.ts')).toThrow(/f\.ts: anchor found 2 times/);
    expect(() => insertAfter('b\n', 'a\n', 'x', 'f.ts')).toThrow(/found 0 times/);
    expect(
      insertAfterBlock('  h: {\n    t: 1,\n  },\n  z\n', '  h: {\n    t: 1,', '\n  },\n', 'N'),
    ).toBe('  h: {\n    t: 1,\n  },\nN  z\n');
    expect(() => insertAfterBlock('x', 'h', '}', 'N', 'f.ts')).toThrow(/f\.ts: block start/);
  });

  test('listItemAfter adds the item at each list depth and leaves a tuple row alone', () => {
    const text =
      "const A = [\n  'hive',\n];\nconst B = [\n    'flip7',\n    'hive',\n    'site',\n];\nconst R = [\n  [\n    'glob',\n    'hive',\n    { lines: 1 },\n  ],\n];\n";
    expect(listItemAfter(text, "'hive',", "'tally',")).toBe(
      "const A = [\n  'hive',\n  'tally',\n];\nconst B = [\n    'flip7',\n    'hive',\n    'tally',\n    'site',\n];\nconst R = [\n  [\n    'glob',\n    'hive',\n    { lines: 1 },\n  ],\n];\n",
    );
    expect(() => listItemAfter('x', "'hive',", "'t',", 'f.ts')).toThrow(/f\.ts: no list line/);
  });

  test('every edit names a file of this checkout and every generated path is under the game, e2e or docs', () => {
    const spec: NewGameSpec = {
      slug: 'tally',
      title: 'Tally',
      seats: { min: 2, max: 2 },
      hidden: false,
    };
    registryEdits(spec).forEach(({ path }) => {
      expect(existsSync(resolve(REPO_ROOT, path)), path).toBe(true);
    });
    generatedFiles(spec).forEach(({ path }) => {
      expect(path).toMatch(
        /^(web\/games\/tally\/|e2e\/(fixtures\/)?tally\.|docs\/design\/tally\.md$)/,
      );
    });
  });
});
