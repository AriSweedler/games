// The rows a new game adds to the harness (AGENT.md "A new game" steps 7 to 11; docs/design/new-game.md
// §4), as anchored text edits over the files the registry lives in: the `Game` union and the
// room-code rows, `SHELL_GAMES` in ids.ts, the SHELL, REGISTRY and CONFORMANCE rows of tools/games.ts,
// the suite row and the rules of tools/ci/suites.ts, the two package.json scripts, the tsconfig
// include, the shell-markup PAGES row, the e2e drivers, the page-only spec, the computed-style
// selectors and drive, the landing card and the README row, and the pin tests (step 8) that spell
// each list by hand. Every edit anchors on the newest game's row (Hearts'), so a row that moved
// fails loudly here rather than landing somewhere else. Pure: text in, text out; the CLI reads and
// writes the files.
import { namesOf, type NewGameSpec } from './spec.ts';

export type Edit = Readonly<{
  /** Repo-relative path of the file edited. */
  path: string;
  /** The whole file after the edit; throws when an anchor is missing. */
  apply: (text: string) => string;
}>;

const countOf = (text: string, needle: string): number => text.split(needle).length - 1;

/** `text` with `addition` right after the one place `anchor` occurs. */
export const insertAfter = (text: string, anchor: string, addition: string, path = ''): string => {
  const n = countOf(text, anchor);
  if (n !== 1)
    throw new Error(
      `${path}: anchor found ${String(n)} times, expected once: ${JSON.stringify(anchor)}`,
    );
  const at = text.indexOf(anchor) + anchor.length;
  return `${text.slice(0, at)}${addition}${text.slice(at)}`;
};

/** `text` with `addition` right before the one place `anchor` occurs. */
export const insertBefore = (text: string, anchor: string, addition: string, path = ''): string => {
  const n = countOf(text, anchor);
  if (n !== 1)
    throw new Error(
      `${path}: anchor found ${String(n)} times, expected once: ${JSON.stringify(anchor)}`,
    );
  const at = text.indexOf(anchor);
  return `${text.slice(0, at)}${addition}${text.slice(at)}`;
};

/** `text` with `addition` after the block that starts at `start` and ends at the first `end` after it. */
export const insertAfterBlock = (
  text: string,
  start: string,
  end: string,
  addition: string,
  path = '',
): string => {
  const from = text.indexOf(start);
  if (from < 0 || text.includes(start, from + 1))
    throw new Error(`${path}: block start not found once: ${JSON.stringify(start)}`);
  const to = text.indexOf(end, from + start.length);
  if (to < 0) throw new Error(`${path}: block end not found after start: ${JSON.stringify(end)}`);
  const at = to + end.length;
  return `${text.slice(0, at)}${addition}${text.slice(at)}`;
};

/** Every list line reading exactly `anchorLine` (any indent), followed by `newLine` at the same depth. */
export const listItemAfter = (
  text: string,
  anchorLine: string,
  newLine: string,
  path = '',
): string => {
  const lines = text.split('\n');
  if (!lines.some((line) => line.trim() === anchorLine))
    throw new Error(`${path}: no list line ${JSON.stringify(anchorLine)}`);
  // A list item: the next line is another item or the list's close; a tuple's row (`['glob',
  // 'hearts', { … }]` in tools/ci/suites.test.ts) is followed by `{` and is left alone.
  const isItem = (i: number): boolean => {
    const next =
      lines
        .slice(i + 1)
        .find((line) => line.trim() !== '')
        ?.trim() ?? '';
    return !next.startsWith('{') && !next.startsWith('[');
  };
  return lines
    .flatMap((line, i) =>
      line.trim() === anchorLine && isItem(i) ? [line, line.replace(anchorLine, newLine)] : [line],
    )
    .join('\n');
};

/** Every `from` replaced by `to`; at least one must occur. */
export const replaceAll = (text: string, from: string, to: string, path = ''): string => {
  if (countOf(text, from) === 0) throw new Error(`${path}: not found: ${JSON.stringify(from)}`);
  return text.split(from).join(to);
};

/** `'hearts',` as a list item at any depth, followed by the new game's at the same depth. */
const listItemAfterHearts = (text: string, item: string, path: string): string =>
  listItemAfter(text, "'hearts',", `${item},`, path);

const GAMES_IN_ORDER = [
  'gin-rummy',
  'fidice',
  'backgammon',
  'briscola',
  'uno',
  'flip7',
  'hive',
  'hearts',
];

/** The SHELL row of tools/games.ts, and the same text the games.test.ts pin spells inline. */
const shellRow = (spec: NewGameSpec, indent: string): string => {
  const n = namesOf(spec);
  const title = JSON.stringify(n.title).replace(/^"|"$/g, '').replace(/'/g, "\\'");
  const i = indent;
  return [
    `${i}heading: '${title}',`,
    `${i}shareTitle: '${title}',`,
    `${i}tabs: ['Play', 'Rules', 'About'],`,
    `${i}modes: ['Online', 'Pass the phone'],`,
    `${i}hostFields: [],`,
    `${i}hostAnswered: /^Connected — waiting for .+ to start$/,`,
    `${i}connDot: '#oppDot',`,
    `${i}localNames: ['Ari', 'Lavi'],`,
    `${i}localFields: [],`,
    `${i}curtainButtons: ${spec.hidden ? '1' : '0'},`,
    `${i}firstCurtain: ${spec.hidden ? "'Pass the phone to {name}'" : 'null'},`,
  ].join('\n');
};

const registryRow = (spec: NewGameSpec, indent: string, shell: string): string => {
  const n = namesOf(spec);
  const title = n.title.replace(/'/g, "\\'");
  const i = indent;
  return [
    `${i}title: '${title}',`,
    `${i}hook: 'window.${n.hook}',`,
    `${i}suite: '${n.slug}',`,
    `${i}specs: ['**/${n.slug}.spec.ts'],`,
    `${i}storage: { saveKey: '${n.slug}MP_v1', prefix: '${n.slug}_' },`,
    `${i}debug: 0,`,
    `${i}pageShape: {`,
    `${i}  ids: [`,
    ...[
      'app',
      'homeScreen',
      'hostWaitScreen',
      'guestWaitScreen',
      'tableScreen',
      'endgameScreen',
      'board',
      'statusText',
      'resultOverlay',
      'toast',
      'guestSeatName',
      'guestNameInput',
      'guestRenameBtn',
      'guestNameNote',
    ].map((id) => `${i}    '${id}',`),
    `${i}  ],`,
    `${i}  rulesSlots: true,`,
    `${i}},`,
    `${i}contractFloors: { ts: 0, markup: 30 },`,
    `${i}shell: ${shell},`,
  ].join('\n');
};

const conformanceRow = (spec: NewGameSpec, indent: string, withGaps: boolean): string => {
  const i = indent;
  const gaps =
    spec.seats.min < spec.seats.max
      ? [
          `${i}gaps: [`,
          `${i}  {`,
          `${i}    rule: 'stepper',`,
          `${i}    followUp:`,
          `${i}      'the scaffold seats two; the stepper is Flip 7\\'s shape (docs/design/flip7.md §8): stepperHtml in page.ts, bindStepper in ui/home.ts, seats {min, max} in shellConfig.ts',`,
          `${i}  },`,
          `${i}  {`,
          `${i}    rule: 'seat-names',`,
          `${i}    followUp: 'one name input per seat the stepper counts, with the stepper (above)',`,
          `${i}  },`,
          `${i}],`,
        ]
      : [`${i}gaps: [],`];
  return [
    `${i}seats: { min: ${String(spec.seats.min)}, max: ${String(spec.seats.max)} },`,
    `${i}pauses: ['over'],`,
    `${i}cues: ['pass'],`,
    `${i}cssFloor: 30,`,
    `${i}hides: ${String(spec.hidden)},`,
    `${i}felt: '--felt',`,
    ...(withGaps ? gaps : []),
  ].join('\n');
};

/** Every edit, in the order they are applied; each names its file. */
export const registryEdits = (spec: NewGameSpec): ReadonlyArray<Edit> => {
  const n = namesOf(spec);
  const s = n.slug;
  const title = n.title.replace(/'/g, "\\'");
  const gapRules = spec.seats.min < spec.seats.max ? "['stepper', 'seat-names']" : '[]';
  return [
    {
      path: 'web/shared/lib/roomCode.ts',
      apply: (t) => {
        const p = 'web/shared/lib/roomCode.ts';
        const union = /export type Game =([^;]*);/.exec(t);
        if (union === null) throw new Error(`${p}: no Game union`);
        const t1 = t.replace(union[0], `export type Game =${union[1] ?? ''} | '${s}';`);
        const t2 = insertAfter(
          t1,
          'export const HEARTS_CODE_LENGTH_ERROR = GIN_CODE_LENGTH_ERROR;\n',
          `// ${n.title} (docs/design/${s}.md §3): gin's alphabet and length again, under its own prefix.\nexport const ${n.upper}_PEER_PREFIX = '${s}-';\nexport const ${n.upper}_CODE_ALPHABET = GIN_CODE_ALPHABET;\nexport const ${n.upper}_CODE_LENGTH = GIN_CODE_LENGTH;\nexport const ${n.upper}_CODE_LENGTH_ERROR = GIN_CODE_LENGTH_ERROR;\n`,
          p,
        );
        const t3 = insertAfterBlock(
          t2,
          '  hearts: {\n    alphabet: HEARTS_CODE_ALPHABET,',
          '\n  },\n',
          `  ${s}: {\n    alphabet: ${n.upper}_CODE_ALPHABET,\n    length: ${n.upper}_CODE_LENGTH,\n    peerPrefix: ${n.upper}_PEER_PREFIX,\n    peerCase: 'upper',\n    lengthError: ${n.upper}_CODE_LENGTH_ERROR,\n  },\n`,
          p,
        );
        return insertAfter(
          t3,
          '      .slice(0, HEARTS_CODE_LENGTH),\n',
          `  ${s}: (raw) =>\n    raw\n      .toUpperCase()\n      .replace(/[^A-Z]/g, '')\n      .slice(0, ${n.upper}_CODE_LENGTH),\n`,
          p,
        );
      },
    },
    {
      path: 'web/shared/ui/ids.ts',
      apply: (t) => listItemAfterHearts(t, `'${s}'`, 'web/shared/ui/ids.ts'),
    },
    {
      path: 'tools/games.ts',
      apply: (t) => {
        const p = 'tools/games.ts';
        const suite = /export type GameSuite =\s*([^;]*);/.exec(t);
        const shellGame = /export type ShellGame =\s*([^;]*);/.exec(t);
        if (suite === null || shellGame === null)
          throw new Error(`${p}: no GameSuite or ShellGame`);
        const t1 = t
          .replace(suite[0], `export type GameSuite =\n  ${(suite[1] ?? '').trim()} | '${s}';`)
          .replace(
            shellGame[0],
            `export type ShellGame =\n  ${(shellGame[1] ?? '').trim()} | '${s}';`,
          );
        const t2 = listItemAfterHearts(t1, `'${s}'`, p);
        const t3 = insertAfterBlock(
          t2,
          "  hearts: {\n    heading: 'Hearts',",
          '\n  },\n',
          `  ${s}: {\n${shellRow(spec, '    ')}\n  },\n`,
          p,
        );
        const t4 = insertAfterBlock(
          t3,
          "  hearts: {\n    title: 'Hearts',",
          '\n  },\n',
          `  ${s}: {\n${registryRow(spec, '    ', `SHELL.${s}`)}\n  },\n`,
          p,
        );
        return insertAfterBlock(
          t4,
          '  hearts: {\n    seats: { min: 3, max: 4 },',
          '\n  },\n',
          `  ${s}: {\n${conformanceRow(spec, '    ', true)}\n  },\n`,
          p,
        );
      },
    },
    {
      path: 'tools/ci/suites.ts',
      apply: (t) => {
        const p = 'tools/ci/suites.ts';
        const t1 = insertBefore(
          t,
          '  site: {\n    unit: [',
          `  ${s}: {\n    // ${n.title} (docs/design/${s}.md), scaffolded by tools/new-game.ts: its colocated tests. TODO: measure\n    // the engine's coverage at its landing and raise the row.\n    unit: ['web/games/${s}/**/*.test.ts'],\n    standalone: [],\n    browser: false,\n    needsBuild: false,\n    coverage: {\n      include: ['web/games/${s}/src/**/*.ts'],\n      thresholds: {\n        'web/games/${s}/src/engine/**': { lines: 80, functions: 80, statements: 80, branches: 70 },\n      },\n    },\n    e2e: gameE2e('${s}'),\n  },\n`,
          p,
        );
        const t2 = insertAfter(t1, "      e2eJob('hearts'),\n", `      e2eJob('${s}'),\n`, p);
        return insertAfter(t2, "  ...gameRules('hearts'),\n", `  ...gameRules('${s}'),\n`, p);
      },
    },
    {
      path: 'package.json',
      apply: (t) => {
        const p = 'package.json';
        const t1 = insertAfter(
          t,
          '    "test:hearts": "VITEST_SUITE=hearts vitest run --project hearts",\n',
          `    "test:${s}": "VITEST_SUITE=${s} vitest run --project ${s}",\n`,
          p,
        );
        return insertAfter(
          t1,
          '    "test:e2e:hearts": "E2E_SUITE=hearts npm run test:e2e",\n',
          `    "test:e2e:${s}": "E2E_SUITE=${s} npm run test:e2e",\n`,
          p,
        );
      },
    },
    {
      path: 'tsconfig.node.json',
      apply: (t) =>
        insertAfter(
          t,
          '    "web/games/hearts/src/**/*.ts",\n',
          `    "web/games/${s}/src/**/*.ts",\n`,
          'tsconfig.node.json',
        ),
    },
    {
      path: 'tools/shell-markup.ts',
      apply: (t) => {
        const p = 'tools/shell-markup.ts';
        const t1 = insertAfter(
          t,
          "import { HEARTS_PAGE } from '../web/games/hearts/page.ts';\n",
          `import { ${n.upper}_PAGE } from '../web/games/${s}/page.ts';\n`,
          p,
        );
        return insertAfter(t1, '  hearts: HEARTS_PAGE,\n', `  ${s}: ${n.upper}_PAGE,\n`, p);
      },
    },
    {
      path: 'e2e/fixtures/two-players.ts',
      apply: (t) =>
        insertAfter(
          t,
          "  hearts: shellDriver('hearts'),\n",
          `  ${s}: shellDriver('${s}'),\n`,
          'e2e/fixtures/two-players.ts',
        ),
    },
    {
      path: 'e2e/fixtures/online-games.ts',
      apply: (t) => {
        const p = 'e2e/fixtures/online-games.ts';
        const t1 = insertAfter(
          t,
          "} from './hearts.ts';\n",
          `import {\n  requireView as require${n.pascal},\n  ${s}Key,\n  ${s}PlayTurn,\n  ${s}Snapshot,\n  ${s}StartLocal,\n} from './${s}.ts';\n`,
          p,
        );
        const driver = `/**
 * ${n.title} (docs/design/${s}.md §3), a two-seat shell game scaffolded by tools/new-game.ts: the host
 * starts from the waiting room and both tables come up; the whole game through \`window.${n.hook}.view()\`.
 * ${spec.hidden ? 'The curtain rises on every turn in pass and play.' : 'No curtain in either mode (SHELL `firstCurtain` null).'}
 */
const ${s}: ShellDriver = {
  ...shellOnline,
  curtainSub: () => '',
  seatNames: {
    me: '#myName',
    meText: (name) => name,
    seated: '#guestSeatName',
  },
  start: async (host, guest) => {
    await hostStarts(host, guest);
    await expect(host.locator('#curtainOverlay')).toBeHidden();
    await expect(guest.locator('#curtainOverlay')).toBeHidden();
  },
  snapshot: ${s}Snapshot,
  agree: async (host, guest) => {
    const table = ${s}Key(await require${n.pascal}(host));
    await expect.poll(() => ${s}Snapshot(guest)).toBe(table);
    return table;
  },
  expectOpening: async (host, guest) => {
    const opening = await require${n.pascal}(host);
    expect(opening).toMatchObject({ seat: 0, game: { turn: 0, turns: 0, result: null } });
    expect(opening.names).toEqual([...ONLINE_NAMES]);
    await expect.poll(() => ${s}Snapshot(guest)).toBe(${s}Key(opening));
    const theirs = await require${n.pascal}(guest);
    expect(theirs).toMatchObject({ seat: 1, game: { turn: 0 }, legal: [] });
    await expect(host.locator('#passBtn')).toBeVisible();
    await expect(guest.locator('#passBtn')).toBeHidden();
  },
  hostSave: { seatCount: 2, game: { game: { turn: 0 } } },
  localSave: { game: { game: { turn: 0 } } },
  table: '#board',
  curtainOffer: {
    title: ${
      spec.hidden
        ? "'the offer is the table\\'s: after a pass the next seat lifts the curtain and takes it from the table'"
        : '"the offer is the table\'s alone and no curtain is raised: after a pass the next seat takes it from the table"'
    },
    toCurtain: async (page) => {
      await ${s}PlayTurn(page);
      ${spec.hidden ? 'await reveal(page);' : "await expect(page.locator('#curtainOverlay')).toBeHidden();"}
    },
    take: (page) => takeOffer(page, '${s}'),
  },
  glossary: {
    aboutTerm: 'pass',
    aboutRule: 'turn',
    innerFrom: 'goal',
    innerTo: 'turn',
    deepLink: 'goal',
    overlayFrom: 'goal',
    overlayTo: 'turn',
    openRulesOverTable: async (page, url, viewport) => {
      await ${s}StartLocal(page, url, viewport);
      await page.locator('#rulesBtnGame').click();
    },
  },
};

`;
        const t2 = insertBefore(t1, "/** Every game's row, in GAMES order. */", driver, p);
        return insertAfter(t2, '  hearts,\n};', '', p).replace(
          '  hearts,\n};',
          `  hearts,\n  ${s},\n};`,
        );
      },
    },
    {
      path: 'e2e/shell-result.spec.ts',
      apply: (t) =>
        insertAfterBlock(
          t,
          "  hearts: async (page) => {\n    await revealIf(page, 'hearts');",
          '\n  },\n',
          `  ${s}: async (page) => {\n    await revealIf(page, '${s}');\n    // Seat 0 resigns on its first turn: the result sheet over the table, Leave the table on it.\n    await page.locator('#resignBtn').click();\n    await expect(page.locator('#resultOverlay')).toBeVisible();\n    await expect(page.locator('#rsTitle')).toHaveText(\`\${DEFAULT_NAMES[1]} wins!\`);\n    return 'rsLeaveBtn';\n  },\n`,
          'e2e/shell-result.spec.ts',
        ),
    },
    {
      path: 'e2e/fixtures/site.ts',
      apply: (t) =>
        insertAfter(
          t,
          "  '**/hearts.spec.ts',\n",
          `  // ${n.title} pass-and-play: a game through the shell page, about the page alone.\n  '**/${s}.spec.ts',\n`,
          'e2e/fixtures/site.ts',
        ),
    },
    {
      path: 'tools/parity/computed-styles.ts',
      apply: (t) => {
        const p = 'tools/parity/computed-styles.ts';
        const t1 = insertAfterBlock(
          t,
          '  hearts: [\n    ...SHELL_SELECTORS,',
          '\n  ],\n',
          `  // ${n.title} (docs/design/${s}.md §3; page.ts, ui/render.ts), scaffolded: after the shell's, the\n  // names strip, the board slot, the status line and the controls. TODO: the game's own.\n  ${s}: [\n    ...SHELL_SELECTORS,\n    '.masthead .subtitle',\n    '.topbar',\n    '.names-strip',\n    '#myName',\n    '#oppName',\n    '#oppDot',\n    '.board',\n    '.board.turn',\n    '.status-line',\n    '.controls',\n    '.controls .btn',\n    '.result-note',\n  ],\n`,
          p,
        );
        const t2 = insertAfterBlock(
          t1,
          '  hearts: {\n    submenuShot: null,',
          '\n  },\n',
          `  ${s}: {\n    submenuShot: null,\n    localModeShot: 'home: play tab, pass the phone',\n    curtainShot: ${spec.hidden ? "'local: started, curtain up'" : 'null'},\n    localValues: {},\n  },\n`,
          p,
        );
        const t3 = insertBefore(
          t2,
          "/** A game's walk;",
          `/**\n * ${n.title} (docs/design/${s}.md §3), after the shell (driveShell): the table at the start, a pass,\n * then the rules sheet over the table. TODO: the game's own screens.\n */\nconst drive${n.pascal} = async (page: Page, shot: Shot): Promise<void> => {\n  await driveShell(page, shot, '${s}');\n  ${spec.hidden ? "await click(page, '#curtainBtn');\n  " : ''}await shot('local: started');\n  await click(page, '#passBtn');\n  ${spec.hidden ? "await visible(page, '#curtainOverlay');\n  await click(page, '#curtainBtn');\n  " : ''}await shot('local: after a pass');\n  await click(page, '#rulesBtnGame');\n  await shot('table: rules sheet');\n  await page.keyboard.press('Escape');\n  await click(page, '#leaveBtn');\n  await visible(page, '#homeScreen');\n  await shot('home: after the game');\n};\n\n`,
          p,
        );
        return insertAfter(t3, '  hearts: driveHearts,\n', `  ${s}: drive${n.pascal},\n`, p);
      },
    },
    {
      path: 'web/index.html',
      apply: (t) => {
        const line = /^.*href="games\/hearts\/".*\n/m.exec(t);
        if (line === null) throw new Error('web/index.html: no hearts card');
        const card = `    <a class="card" href="games/${s}/"><h2><span class="glyph" aria-hidden="true">🎮</span> <span class="name">${n.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span></h2></a>\n`;
        return insertAfter(t, line[0], card, 'web/index.html');
      },
    },
    {
      path: 'README.md',
      apply: (t) => {
        const line = /^\| Hearts .*\n/m.exec(t);
        if (line === null) throw new Error('README.md: no Hearts row');
        const pad = (text: string, width: number): string => text.padEnd(width);
        const row = `| ${pad(n.title, 28)} | ${pad(`https://arisweedler.github.io/games/games/${s}/`, 53)} | ${pad(`https://games.sweedler.com/${s}/`, 80)} | ${pad(`\`web/games/${s}/\``, 23)} |\n`;
        return insertAfter(t, line[0], row, 'README.md');
      },
    },
    // ---- the pin tests (step 8) --------------------------------------------------------------
    {
      path: 'tools/games.test.ts',
      apply: (t) => {
        const p = 'tools/games.test.ts';
        const t1 = insertAfter(
          t,
          "import { STORAGE_KEYS as HEARTS_KEYS } from '../web/games/hearts/src/storage.ts';\n",
          `import { STORAGE_KEYS as ${n.upper}_KEYS } from '../web/games/${s}/src/storage.ts';\n`,
          p,
        );
        const t2 = listItemAfterHearts(t1, `'${s}'`, p);
        const t3 = insertAfterBlock(
          t2,
          "      hearts: {\n        title: 'Hearts',",
          '\n      },\n',
          `      ${s}: {\n${registryRow(spec, '        ', `{\n${shellRow(spec, '          ')}\n        }`)}\n      },\n`,
          p,
        );
        const t4 = insertAfter(
          t3,
          '    pin(REGISTRY.hearts.storage, HEARTS_KEYS);\n',
          `    pin(REGISTRY.${s}.storage, ${n.upper}_KEYS);\n`,
          p,
        );
        const t5 = insertAfter(t4, "      hearts: 'Hearts',\n", `      ${s}: '${title}',\n`, p);
        const t6 = insertAfter(
          t5,
          "      hearts: 'window.__hearts',\n",
          `      ${s}: 'window.${n.hook}',\n`,
          p,
        );
        const t7 = insertAfter(t6, "      'games/hearts/',\n", `      'games/${s}/',\n`, p);
        const t8 = insertAfterBlock(
          t7,
          '      hearts: {\n        seats: { min: 3, max: 4 },',
          '\n      },\n',
          `      ${s}: {\n${conformanceRow(spec, '        ', false)}\n      },\n`,
          p,
        );
        return insertAfter(
          t8,
          "      hearts: ['stepper', 'seat-names'],\n",
          `      ${s}: ${gapRules},\n`,
          p,
        );
      },
    },
    {
      path: 'tools/ci/suites.test.ts',
      apply: (t) => {
        const p = 'tools/ci/suites.test.ts';
        const t1 = listItemAfterHearts(t, `'${s}'`, p);
        const t2 = listItemAfter(t1, "'e2e-hearts',", `'e2e-${s}',`, p);
        // Every other game's `otherTags`, one line or wrapped (the tail keeps a wrapped list's
        // trailing comma and indent); a solo page's empty `otherTags: []` has no item and stays.
        const t3 = t2.replace(
          /otherTags: \[([^\]]+?)(,?\s*)\]/g,
          (_m, inner: string, tail: string) => `otherTags: [${inner}, '@${s}'${tail}]`,
        );
        // The coverage pins: the row the suite's threshold adds, and its include glob.
        const t4 = insertAfter(
          t3,
          "    'web/games/hearts/src/engine/**',\n    'hearts',\n    { lines: 80, functions: 80, statements: 80, branches: 70 },\n  ],\n",
          `  [\n    'web/games/${s}/src/engine/**',\n    '${s}',\n    { lines: 80, functions: 80, statements: 80, branches: 70 },\n  ],\n`,
          p,
        );
        const t5 = insertAfter(
          t4,
          "  'web/games/hearts/src/**/*.ts',\n",
          `  'web/games/${s}/src/**/*.ts',\n`,
          p,
        );
        const others = GAMES_IN_ORDER.map((g) => `'@${g}'`).join(', ');
        return insertAfterBlock(
          t5,
          '    expect(SUITES.hearts.e2e).toStrictEqual({',
          '\n    });\n',
          `    expect(SUITES.${s}.e2e).toStrictEqual({\n      files: ['**/${s}.spec.ts', '**/shell-*.spec.ts'],\n      tag: '@${s}',\n      otherTags: [${others}],\n    });\n`,
          p,
        );
      },
    },
    {
      path: 'tools/ci/affected.test.ts',
      apply: (t) => {
        const p = 'tools/ci/affected.test.ts';
        const t1 = listItemAfter(t, "'hearts=false',", `'${s}=false',`, p);
        const t2 = listItemAfter(t1, "'e2e-hearts=false',", `'e2e-${s}=false',`, p);
        const t3 = replaceAll(t2, '"hearts"]', `"hearts","${s}"]`, p);
        const t4 = listItemAfter(t3, 'hearts: false,', `${s}: false,`, p);
        return listItemAfter(t4, "'e2e-hearts': false,", `'e2e-${s}': false,`, p);
      },
    },
    {
      path: 'web/shared/lib/roomCode.test.ts',
      apply: (t) => listItemAfterHearts(t, `'${s}'`, 'web/shared/lib/roomCode.test.ts'),
    },
    {
      path: 'web/shared/ui/ids.test.ts',
      apply: (t) => listItemAfterHearts(t, `'${s}'`, 'web/shared/ui/ids.test.ts'),
    },
    {
      path: 'test/dist/classes.test.ts',
      apply: (t) => {
        const p = 'test/dist/classes.test.ts';
        const t1 = listItemAfterHearts(t, `'${s}'`, p);
        return insertAfter(
          t1,
          "  expect(ownersOf('hearts')).toEqual(['hearts', 'shared', 'shell']);\n",
          `  expect(ownersOf('${s}')).toEqual(['${s}', 'shared', 'shell']);\n`,
          p,
        );
      },
    },
  ];
};
