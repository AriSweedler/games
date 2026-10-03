// The game conformance suite, the source half (docs/design/game-conformance.md; AGENT.md "A new
// game"): every registered shell game (tools/games.ts SHELL_GAMES, the one list) is held to the
// rules AGENT.md states, read off its sources and the per-game tables, with no build and no
// browser. Each failure names the game and the rule in one line (`<game>: <rule>: <what to fix>`)
// so the agent that broke it knows what to fix; a rule the game is known to miss is a declared gap
// in its CONFORMANCE row (tools/games.ts), reported here as a skip that names the follow-up, never
// as green. The built page's half is test/dist/game-conformance.test.ts and the browser's
// e2e/shell-conformance.spec.ts. Runs in the harness suite (tools/ci/suites.ts).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { ROOM_CODE, randomCode, sanitiseCode } from '../web/shared/lib/roomCode.ts';
import { SHELL_GAMES as IDS_SHELL_GAMES } from '../web/shared/ui/ids.ts';
import {
  ALIASES,
  CONFORMANCE,
  GAMES,
  REGISTRY,
  SHELL,
  SHELL_GAMES,
  SOLO,
  SOLO_PAGES,
  TOOL_NAMES,
  type ConformanceRule,
  type ShellGame,
} from '../tools/games.ts';

const ROOT = resolve(import.meta.dirname, '..');
const gameFile = (game: string, rel: string): string => resolve(ROOT, 'web', 'games', game, rel);
const read = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '');
/** Every .ts under the game's src/, concatenated: where a bound's constant may live. */
const sourcesOf = (game: string): string =>
  readdirSync(gameFile(game, 'src'), { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.ts'))
    .map((d) => read(resolve(d.parentPath, d.name)))
    .join('\n');

/** The one-line reason a failure carries: the game, the rule, what to fix. */
const why = (game: string, rule: ConformanceRule, fix: string): string =>
  `${game}: ${rule}: ${fix}`;

/** The declared gap for `rule`, if the game has one. */
const gapFor = (game: ShellGame, rule: ConformanceRule) =>
  CONFORMANCE[game].gaps.find((g) => g.rule === rule);

/** A rule's case: skipped with the follow-up when the game declares the gap, else run. */
const rule = (game: ShellGame, name: ConformanceRule, title: string, body: () => void): void => {
  const gap = gapFor(game, name);
  if (gap !== undefined) {
    test.skip(`${game}: ${name}: ${title} [gap: ${gap.followUp}]`, body);
    return;
  }
  test(`${game}: ${name}: ${title}`, body);
};

describe('game conformance: the sources and the tables', () => {
  test('the shell games are the one list everywhere: tools/games.ts, web/shared/ui/ids.ts, REGISTRY', () => {
    expect([...IDS_SHELL_GAMES]).toEqual([...SHELL_GAMES]);
    expect([...GAMES]).toEqual([...SHELL_GAMES]);
  });

  test('every folder under web/games is a game, a solo page, a tool or an alias; a folder with a shellConfig is a registered shell game', () => {
    const known = new Set<string>([
      ...GAMES,
      ...SOLO_PAGES,
      ...TOOL_NAMES,
      ...Object.keys(ALIASES),
    ]);
    const folders = readdirSync(resolve(ROOT, 'web', 'games'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    expect(
      folders.filter((f) => !known.has(f)),
      'a folder no table names',
    ).toEqual([]);
    const shellConfigured = folders.filter((f) => existsSync(gameFile(f, 'src/shellConfig.ts')));
    expect(
      shellConfigured.filter((f) => !(SHELL_GAMES as ReadonlyArray<string>).includes(f)),
      'a game with a shellConfig.ts registered outside SHELL_GAMES (AGENT.md "Every game is a shared-shell game")',
    ).toEqual([]);
  });

  SOLO_PAGES.forEach((page) => {
    test(`${page}: a solo page seats no one: no shellConfig.ts, no seats, no room code`, () => {
      expect(existsSync(gameFile(page, 'src/shellConfig.ts'))).toBe(false);
      expect(
        /\bseats:\s*\{\s*min\b/.test(sourcesOf(page)),
        `${page}: a SOLO page declares seats; register it in SHELL_GAMES (AGENT.md "Every game is a shared-shell game")`,
      ).toBe(false);
      expect(page in ROOM_CODE).toBe(false);
    });

    // The landing half of a solo page's row: a listed page has its card like a game; an unlisted
    // one (SOLO `listed: false`) is served and smoked but the landing never names it, while the
    // README keeps its row so the URL is still written down somewhere.
    test(`${page}: ${SOLO[page].listed ? 'a listed solo page has its landing card' : 'an unlisted solo page has no landing card'}; the README keeps its row`, () => {
      const card = `class="card" href="games/${page}/"`;
      const landing = read(resolve(ROOT, 'web', 'index.html'));
      if (SOLO[page].listed) {
        expect(landing, `${page}: landing: add the <a class="card" href="games/<p>/">`).toContain(
          card,
        );
      } else {
        expect(
          landing,
          `${page}: landing: the page is unlisted (tools/games.ts SOLO listed: false); delete its card from web/index.html`,
        ).not.toContain(card);
        expect(landing, `${page}: landing: no link to an unlisted page`).not.toContain(
          `href="games/${page}/"`,
        );
      }
      expect(
        read(resolve(ROOT, 'README.md')),
        `${page}: landing: add the README "Play" row`,
      ).toContain(`https://games.sweedler.com/${page}/`);
    });
  });

  SHELL_GAMES.forEach((game) => {
    const conf = CONFORMANCE[game];
    const shell = SHELL[game];

    rule(game, 'tables', 'a row in every per-game table, each well-formed', () => {
      expect(REGISTRY[game], why(game, 'tables', 'add the REGISTRY row')).toBeDefined();
      expect(ROOM_CODE[game], why(game, 'tables', 'add the ROOM_CODE row')).toBeDefined();
      const code = randomCode(game, () => 0.5);
      expect(code, why(game, 'tables', "randomCode draws a code of the row's length")).toHaveLength(
        ROOM_CODE[game].length,
      );
      expect(
        sanitiseCode(game, code.toLowerCase()),
        why(game, 'tables', 'sanitiseCode is total'),
      ).toBe(code);
      expect(REGISTRY[game].shell).toBe(shell);
    });

    rule(
      game,
      'shell-home',
      'page.ts composes the page; shellConfig.ts is the ShellGameData',
      () => {
        expect(
          existsSync(gameFile(game, 'page.ts')),
          why(game, 'shell-home', 'write page.ts, the ShellPage'),
        ).toBe(true);
        expect(
          existsSync(gameFile(game, 'index.html')),
          why(game, 'shell-home', 'run tools/shell-markup.ts --write'),
        ).toBe(true);
        expect(
          existsSync(gameFile(game, 'src/shellConfig.ts')),
          why(game, 'shell-home', 'write shellConfig.ts'),
        ).toBe(true);
        expect(shell.tabs, why(game, 'shell-home', 'the tabs include Rules')).toContain('Rules');
      },
    );

    rule(game, 'online-mode', 'Online is a mode', () => {
      expect(
        shell.modes.some((m) => /online/i.test(m)),
        why(
          game,
          'online-mode',
          'the modes include Online (every multiplayer game is online through the shell)',
        ),
      ).toBe(true);
    });

    rule(game, 'stepper', "the seat range is the stepper's and shellConfig.ts agrees", () => {
      const { min, max } = conf.seats;
      const config = read(gameFile(game, 'src/shellConfig.ts'));
      const declared = /\bseats:\s*\{\s*min:\s*(\w+),\s*max:\s*(\w+)/.exec(config);
      if (declared === null) {
        expect(
          { min, max },
          why(game, 'stepper', 'shellConfig.ts declares no seats, so the game seats two'),
        ).toEqual({ min: 2, max: 2 });
      } else {
        // A bound (`MIN_SEATS`) is resolved to its literal anywhere under the game's src/.
        const value = (token: string): number =>
          /^\d+$/.test(token)
            ? Number(token)
            : Number(new RegExp(`const\\s+${token}\\s*=\\s*(\\d+)`).exec(sourcesOf(game))?.[1]);
        expect(
          { min: value(declared[1] ?? ''), max: value(declared[2] ?? '') },
          why(game, 'stepper', 'shellConfig.ts seats and the CONFORMANCE row disagree'),
        ).toEqual({ min, max });
      }
      const hasStepper = shell.localFields.some(([id]) => id === 'localPlayersCount');
      expect(
        hasStepper,
        why(
          game,
          'stepper',
          min < max
            ? 'the pass-and-play panel places the shared stepper (localPlayersCount), never a <select>'
            : 'a two-seat game has no stepper',
        ),
      ).toBe(min < max);
      expect(
        shell.hostFields.some(([id]) => /sel$/i.test(id)),
        why(game, 'stepper', 'the host card has a <select>; use stepperHtml'),
      ).toBe(false);
    });

    rule(
      game,
      'pauses',
      'every declared pause is raised in ui/state.ts through the shell`s table.pause adapter (pause/continue clears it)',
      () => {
        const state = read(gameFile(game, 'src/ui/state.ts'));
        expect(
          conf.pauses.length,
          why(
            game,
            'pauses',
            'declare the Pause kinds in CONFORMANCE (or a pauses gap with its follow-up)',
          ),
        ).toBeGreaterThan(0);
        expect(
          state,
          why(
            game,
            'pauses',
            'ui/state.ts supplies no `table.pause` adapter (shell.ts `ShellConfig`)',
          ),
        ).toMatch(/\bpause:/);
        conf.pauses.forEach((kind) => {
          expect(
            state,
            why(game, 'pauses', `the kind '${kind}' is declared but ui/state.ts never raises it`),
          ).toContain(`'${kind}'`);
        });
      },
    );

    rule(game, 'cues', 'src/ui/sound.ts spreads SHELL_CUES and names every declared cue', () => {
      const sound = read(gameFile(game, 'src/ui/sound.ts'));
      expect(
        conf.cues,
        why(
          game,
          'cues',
          'write src/ui/sound.ts and declare its cues (or a cues gap with its follow-up)',
        ),
      ).not.toBeNull();
      expect(sound, why(game, 'cues', 'src/ui/sound.ts is missing')).not.toBe('');
      expect(sound, why(game, 'cues', 'the cue table does not spread SHELL_CUES')).toContain(
        '...SHELL_CUES',
      );
      (conf.cues ?? []).forEach((cue) => {
        expect(
          sound,
          why(game, 'cues', `the cue '${cue}' is declared but sound.ts has no row for it`),
        ).toMatch(new RegExp(`['"]?${cue.replace(/\./g, '\\.')}['"]?:\\s`));
      });
      expect(
        (conf.cues ?? []).length,
        why(game, 'cues', "the table has no cue of the game's own"),
      ).toBeGreaterThan(0);
    });

    rule(
      game,
      'rules-fit',
      'ui/rules.ts exports RULES_ITEMS (the browser half measures the fit)',
      () => {
        expect(
          read(gameFile(game, 'src/ui/rules.ts')),
          why(game, 'rules-fit', 'write src/ui/rules.ts with RULES_ITEMS'),
        ).toContain('RULES_ITEMS');
      },
    );

    rule(
      game,
      'landing',
      'the landing card, the README row, the splash and its PNG; no alias shadows the game',
      () => {
        expect(
          read(resolve(ROOT, 'web', 'index.html')),
          why(game, 'landing', 'add the <a class="card" href="games/<g>/"> in web/index.html'),
        ).toContain(`class="card" href="games/${game}/"`);
        expect(
          read(resolve(ROOT, 'README.md')),
          why(game, 'landing', 'add the README "Play" row'),
        ).toContain(`https://games.sweedler.com/${game}/`);
        expect(
          existsSync(gameFile(game, 'assets/splash.svg')),
          why(game, 'landing', 'add assets/splash.svg'),
        ).toBe(true);
        expect(
          existsSync(resolve(ROOT, 'web', 'public', 'games', game, 'splash.png')),
          why(game, 'landing', 'run tools/splash.ts'),
        ).toBe(true);
        expect(game in ALIASES, why(game, 'landing', 'an alias shadows the game')).toBe(false);
      },
    );
  });
});
