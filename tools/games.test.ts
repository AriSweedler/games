import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { STORAGE_KEYS as BACKGAMMON_KEYS } from '../web/games/backgammon/src/storage.ts';
import { STORAGE_KEYS as BRISCOLA_KEYS } from '../web/games/briscola/src/storage.ts';
import { STORAGE_KEYS as FIDICE_KEYS } from '../web/games/fidice/src/storage.ts';
import { STORAGE_KEYS as FLIP7_KEYS } from '../web/games/flip7/src/storage.ts';
import { STORAGE_KEYS as GIN_KEYS } from '../web/games/gin-rummy/src/storage.ts';
import { STORAGE_KEYS as HIVE_KEYS } from '../web/games/hive/src/storage.ts';
import { STORAGE_KEYS as UNO_KEYS } from '../web/games/uno/src/storage.ts';
import {
  ALIASES,
  CONFORMANCE,
  GAMES,
  HOOKS,
  LANDING_HREFS,
  LANDING_PAGES,
  LEGACY_GAMES,
  PAGE_HOOKS,
  PAGE_TITLES,
  REGISTRY,
  SHELL,
  SHELL_GAMES,
  SOLO,
  SOLO_PAGES,
  UNLISTED_PAGES,
} from './games.ts';

describe('the games registry', () => {
  test('lists the seven built games in landing order; the two migrated ones have a legacy page', () => {
    expect(GAMES).toEqual([
      'gin-rummy',
      'fidice',
      'backgammon',
      'briscola',
      'uno',
      'flip7',
      'hive',
    ]);
    expect(Object.keys(REGISTRY)).toEqual(GAMES);
    expect(LEGACY_GAMES).toEqual(['gin-rummy', 'fidice']);
  });

  test('pins every row', () => {
    expect(REGISTRY).toEqual({
      'gin-rummy': {
        title: 'Gin Rummy',
        hook: 'window.__gin',
        suite: 'gin',
        specs: ['**/gin-*.spec.ts'],
        storage: { saveKey: 'ginRummyMP_v1', prefix: 'ginRummy_' },
        debug: 0,
        pageShape: {
          ids: ['app', 'homeScreen', 'tableScreen', 'scResOverlay', 'toast'],
          rulesSlots: true,
        },
        contractFloors: { ts: 50, markup: 40 },
        shell: {
          heading: '♠ Gin Rummy',
          shareTitle: 'Gin Rummy',
          tabs: ['Play', 'Rules', 'Score', 'About'],
          modes: ['🌐 Online', '📱 Pass & Play', '🧪 Sandbox'],
          hostFields: [],
          hostAnswered:
            /^Connected to .+'s room \(playing to \d+\)\. Waiting for the host to start/,
          connDot: '#connDot',
          localNames: ['Ari', 'Lavi'],
          localFields: [['localTargetInput', '100']],
          curtainButtons: 1,
          firstCurtain: 'Pass the phone to {name}',
        },
      },
      fidice: {
        title: "Fidice — one-cup liar's dice",
        hook: 'window.__fidice',
        suite: 'fidice',
        specs: ['**/fidice-*.spec.ts'],
        storage: { saveKey: 'fidiceMP_v1', prefix: 'fidice_' },
        debug: 1,
        pageShape: {
          ids: [
            'app',
            'homeScreen',
            'hostWaitScreen',
            'guestWaitScreen',
            'tableScreen',
            'endgameScreen',
            'configScreen',
            'ladderPanel',
            'fidiceTable',
            'toast',
          ],
          rulesSlots: true,
        },
        contractFloors: { ts: 50, markup: 40 },
        shell: {
          heading: '🥤Fidice',
          shareTitle: 'Fidice',
          tabs: ['Play', 'Rules', 'Ladder', 'About'],
          modes: ['Online', 'Pass the phone', 'Solo', 'Watch'],
          hostFields: [['seatsSel', '2']],
          hostAnswered: /^Connected — (\d+ of \d+ seated · )?waiting for .+ to start$/,
          connDot: '#connDot',
          localNames: ['Ari', 'Lavi'],
          localFields: [],
          curtainButtons: 1,
          firstCurtain: 'Pass the phone to {name}',
        },
      },
      backgammon: {
        title: 'Sheshbesh — backgammon',
        hook: 'window.__backgammon',
        suite: 'backgammon',
        specs: ['**/backgammon-*.spec.ts'],
        storage: { saveKey: 'backgammonMP_v1', prefix: 'backgammon_' },
        debug: 0,
        pageShape: {
          ids: [
            'app',
            'homeScreen',
            'tableScreen',
            'board',
            'toast',
            ...Array.from({ length: 24 }, (_, i) => `point-${String(i + 1)}`),
            'turnGate',
            'turnGateTitle',
            'turnGateSub',
            'turnGateGoBtn',
            'turnGateKeepBtn',
            'menuFlipToggle',
            'guestSeatName',
            'guestNameInput',
            'guestRenameBtn',
            'guestNameNote',
          ],
          rulesSlots: true,
        },
        contractFloors: { ts: 35, markup: 40 },
        shell: {
          heading: 'Sheshbesh',
          shareTitle: 'Sheshbesh',
          tabs: ['Play', 'Rules', 'About'],
          modes: ['Online', 'Pass the phone'],
          hostFields: [],
          hostAnswered: /^Connected — waiting for .+ to start$/,
          connDot: '#oppDot',
          localNames: ['Ari', 'Ethan'],
          localFields: [
            ['localVariantSel', 'portes'],
            ['localMatchLengthSel', '5'],
          ],
          curtainButtons: 2,
          firstCurtain: '{name} starts',
        },
      },
      briscola: {
        title: 'Briscola — cards',
        hook: 'window.__briscola',
        suite: 'briscola',
        specs: ['**/briscola-*.spec.ts'],
        storage: { saveKey: 'briscolaMP_v1', prefix: 'briscola_' },
        debug: 0,
        pageShape: {
          ids: [
            'app',
            'homeScreen',
            'tableScreen',
            'hand',
            'trick',
            'stock',
            'briscola',
            'scoreStrip',
            'toast',
            'guestSeatName',
            'guestNameInput',
            'guestRenameBtn',
            'guestNameNote',
          ],
          rulesSlots: true,
        },
        contractFloors: { ts: 35, markup: 40 },
        shell: {
          heading: 'Briscola',
          shareTitle: 'Briscola',
          tabs: ['Play', 'Rules', 'About'],
          modes: ['Online', 'Pass the phone'],
          hostFields: [],
          hostAnswered: /^Connected — waiting for .+ to deal$/,
          connDot: '#oppDot',
          localNames: ['Ari', 'Lavi'],
          localFields: [['localPlayersCount', '2']],
          curtainButtons: 2,
          firstCurtain: 'Pass the phone to {name}',
        },
      },
      uno: {
        title: 'UNO',
        hook: 'window.__uno',
        suite: 'uno',
        specs: ['**/uno.spec.ts'],
        storage: { saveKey: 'unoMP_v1', prefix: 'uno_' },
        debug: 0,
        pageShape: {
          ids: [
            'app',
            'homeScreen',
            'hostWaitScreen',
            'guestWaitScreen',
            'tableScreen',
            'endgameScreen',
            'seats',
            'topCard',
            'colorDot',
            'hand',
            'drawBtn',
            'statusText',
            'resultOverlay',
            'toast',
            'guestSeatName',
            'guestNameInput',
            'guestRenameBtn',
            'guestNameNote',
          ],
          rulesSlots: true,
        },
        contractFloors: { ts: 20, markup: 30 },
        shell: {
          heading: 'UNO',
          shareTitle: 'UNO',
          tabs: ['Play', 'Rules', 'About'],
          modes: ['Online', 'Pass the phone'],
          hostFields: [],
          hostAnswered: /^Connected — waiting for .+ to deal$/,
          connDot: '#oppDot',
          localNames: ['Ari', 'Lavi'],
          localFields: [['localPlayersCount', '2']],
          curtainButtons: 1,
          firstCurtain: 'Pass the phone to {name}',
        },
      },
      flip7: {
        title: 'Flip 7',
        hook: 'window.__flip7',
        suite: 'flip7',
        specs: ['**/flip7-*.spec.ts'],
        storage: { saveKey: 'flip7MP_v1', prefix: 'flip7_' },
        debug: 0,
        pageShape: {
          ids: [
            'app',
            'homeScreen',
            'hostWaitScreen',
            'guestWaitScreen',
            'tableScreen',
            'endgameScreen',
            'seats',
            'others',
            'mySeat',
            'hitBtn',
            'stayBtn',
            'target',
            'result',
            'pauseOverlay',
            'continueBtn',
            'toast',
            'guestSeatName',
            'guestNameInput',
            'guestRenameBtn',
            'guestNameNote',
          ],
          rulesSlots: true,
        },
        contractFloors: { ts: 10, markup: 30 },
        shell: {
          heading: 'Flip 7',
          shareTitle: 'Flip 7',
          tabs: ['Play', 'Rules', 'About'],
          modes: ['Online', 'Pass the phone'],
          hostFields: [],
          hostAnswered: /^Connected — waiting for .+ to deal$/,
          connDot: '#oppDot',
          localNames: ['Ari', 'Lavi'],
          localFields: [['localPlayersCount', '2']],
          curtainButtons: 2,
          firstCurtain: 'Pass the phone to {name}',
        },
      },
      hive: {
        title: 'Hive',
        hook: 'window.__hive',
        suite: 'hive',
        specs: ['**/hive.spec.ts'],
        storage: { saveKey: 'hiveMP_v1', prefix: 'hive_' },
        debug: 0,
        pageShape: {
          ids: [
            'app',
            'homeScreen',
            'hostWaitScreen',
            'guestWaitScreen',
            'tableScreen',
            'endgameScreen',
            'board',
            'whiteHand',
            'blackHand',
            'statusText',
            'resultOverlay',
            'toast',
            'guestSeatName',
            'guestNameInput',
            'guestRenameBtn',
            'guestNameNote',
          ],
          rulesSlots: true,
        },
        contractFloors: { ts: 20, markup: 30 },
        shell: {
          heading: 'Hive',
          shareTitle: 'Hive',
          tabs: ['Play', 'Rules', 'About'],
          modes: ['Online', 'Pass the phone'],
          hostFields: [],
          hostAnswered: /^Connected — waiting for .+ to start$/,
          connDot: '#oppDot',
          localNames: ['Ari', 'Lavi'],
          localFields: [],
          curtainButtons: 0,
          firstCurtain: null,
        },
      },
    });
  });

  test('every game is a shell game (M5 of docs/design/fidice-shell-adoption.md), each carrying its SHELL row, in GAMES order', () => {
    // The shell specs (e2e/shell-*.spec.ts) iterate SHELL_GAMES and read the save and the
    // preference keys through the storage row, so every row carries both.
    expect(SHELL_GAMES).toEqual(GAMES);
    expect(SHELL_GAMES).toEqual([
      'gin-rummy',
      'fidice',
      'backgammon',
      'briscola',
      'uno',
      'flip7',
      'hive',
    ]);
    SHELL_GAMES.forEach((game) => {
      expect(REGISTRY[game].shell).toBe(SHELL[game]);
    });
    expect(Object.keys(SHELL)).toEqual(SHELL_GAMES);
  });

  test("the storage rows are the games' own STORAGE_KEYS: the save key, and the prefix of the shell's preference keys", () => {
    // The shell's preferences (docs/design/shared-shell.md §5 A3): `<prefix><name>` in both games.
    // A game's other keys (gin's Score Counter save `ginRummyScorerState_v2`, backgammon's variant
    // and match length) are its own and need not carry the prefix.
    const SHELL_PREFS = ['name', 'p2Name', 'homeTab', 'playMode', 'sound', 'soundFont'];
    const pin = (
      storage: Readonly<{ saveKey: string; prefix: string }>,
      keys: Readonly<Record<string, string>>,
    ): void => {
      expect(storage.saveKey).toBe(keys['save']);
      SHELL_PREFS.forEach((name) => {
        expect(keys[name], name).toBe(`${storage.prefix}${name}`);
      });
    };
    pin(REGISTRY['gin-rummy'].storage, GIN_KEYS);
    pin(REGISTRY.fidice.storage, FIDICE_KEYS);
    pin(REGISTRY.backgammon.storage, BACKGAMMON_KEYS);
    pin(REGISTRY.briscola.storage, BRISCOLA_KEYS);
    pin(REGISTRY.uno.storage, UNO_KEYS);
    pin(REGISTRY.flip7.storage, FLIP7_KEYS);
    pin(REGISTRY.hive.storage, HIVE_KEYS);
  });

  test('pins every page title, read off the rows', () => {
    expect(PAGE_TITLES).toEqual({
      landing: "Ari's web apps",
      'gin-rummy': 'Gin Rummy',
      fidice: "Fidice — one-cup liar's dice",
      backgammon: 'Sheshbesh — backgammon',
      briscola: 'Briscola — cards',
      hive: 'Hive',
      rps: 'Rock Paper Scissors',
      uno: 'UNO',
      flip7: 'Flip 7',
      // The tool page (TOOLS): smoked like a game, no game.
      'ui-sandbox': 'UI Sandbox',
    });
  });

  test('the solo pages: the reaction game, a row with a title, a hook, a suite, its spec and its ids; never a game; unlisted', () => {
    expect(SOLO_PAGES).toEqual(['rps']);
    expect(Object.keys(SOLO)).toEqual(SOLO_PAGES);
    expect(SOLO.rps).toMatchObject({
      title: 'Rock Paper Scissors',
      hook: 'window.__rps',
      suite: 'rps',
      specs: ['**/rps.spec.ts'],
      listed: false,
    });
    expect(UNLISTED_PAGES).toEqual(['rps']);
    expect(SOLO.rps.pageShape.ids).toEqual(
      expect.arrayContaining(['app', 'counter', 'counterFace', 'buddy', 'islandSlot', 'techUpBtn']),
    );
    SOLO_PAGES.forEach((page) => {
      expect(GAMES as ReadonlyArray<string>, `${page} is a solo page, not a game`).not.toContain(
        page,
      );
      expect(existsSync(resolve(import.meta.dirname, '..', 'web', 'games', page)), page).toBe(true);
    });
    expect(PAGE_HOOKS).toEqual({
      ...HOOKS,
      rps: 'window.__rps',
    });
    // The reaction game is unlisted: the landing pages are the games alone.
    expect(LANDING_PAGES).toEqual([...GAMES]);
    expect(LANDING_PAGES).not.toContain('rps');
  });

  test('pins every page hook, read off the rows', () => {
    expect(HOOKS).toEqual({
      'gin-rummy': 'window.__gin',
      fidice: 'window.__fidice',
      backgammon: 'window.__backgammon',
      briscola: 'window.__briscola',
      uno: 'window.__uno',
      flip7: 'window.__flip7',
      hive: 'window.__hive',
      'ui-sandbox': 'window.__uiSandbox',
    });
  });

  test('the landing hrefs are games/<g>/ in LANDING_PAGES order: the games, then the listed solo pages (none today)', () => {
    expect(LANDING_HREFS).toEqual([
      'games/gin-rummy/',
      'games/fidice/',
      'games/backgammon/',
      'games/briscola/',
      'games/uno/',
      'games/flip7/',
      'games/hive/',
    ]);
    expect(LANDING_HREFS).not.toContain('games/rps/');
  });

  test('sheshbesh is an alias of backgammon: a game folder, never a game or a landing link', () => {
    expect(ALIASES).toEqual({ sheshbesh: 'backgammon' });
    Object.entries(ALIASES).forEach(([alias, game]) => {
      expect(GAMES, `${alias} is an alias, not a game`).not.toContain(alias);
      expect(LANDING_HREFS).not.toContain(`games/${alias}/`);
      expect(existsSync(resolve(import.meta.dirname, '..', 'web', 'games', game)), game).toBe(true);
    });
  });
});

describe('the conformance declarations (docs/design/game-conformance.md)', () => {
  test('one row per shell game: the seat range, the pauses, the cues and the CSS floor', () => {
    expect(Object.keys(CONFORMANCE)).toEqual([...SHELL_GAMES]);
    const rows = Object.fromEntries(
      SHELL_GAMES.map((game) => {
        const { seats, pauses, cues, cssFloor, hides } = CONFORMANCE[game];
        return [game, { seats, pauses, cues, cssFloor, hides }];
      }),
    );
    expect(rows).toEqual({
      'gin-rummy': {
        seats: { min: 2, max: 2 },
        pauses: [],
        cues: ['knockGood', 'gin', 'bad', 'neutral', 'oppStock', 'oppDiscard'],
        cssFloor: 160,
        hides: true,
      },
      fidice: { seats: { min: 1, max: 6 }, pauses: [], cues: [], cssFloor: 190, hides: true },
      backgammon: {
        seats: { min: 2, max: 2 },
        pauses: [],
        cues: ['roll', 'doubles', 'place', 'hit', 'bearOff', 'double'],
        cssFloor: 130,
        hides: false,
      },
      briscola: {
        seats: { min: 2, max: 4 },
        pauses: [],
        cues: ['start.deal', 'move.play', 'draw.stock', 'good.trick.small'],
        cssFloor: 145,
        hides: true,
      },
      uno: {
        seats: { min: 2, max: 12 },
        pauses: [],
        cues: ['play', 'draw', 'penalty', 'deal'],
        cssFloor: 80,
        hides: true,
      },
      flip7: {
        seats: { min: 2, max: 12 },
        pauses: ['bust', 'frozen', 'flip7'],
        cues: ['flip', 'bust', 'freeze', 'stay', 'deal'],
        cssFloor: 72,
        hides: false,
      },
      hive: {
        seats: { min: 2, max: 2 },
        pauses: [],
        cues: ['place', 'move'],
        cssFloor: 78,
        hides: false,
      },
    });
  });

  test('the declared gaps, by rule: the audit table of docs/design/game-conformance.md', () => {
    const gaps = Object.fromEntries(
      SHELL_GAMES.map((game) => [game, CONFORMANCE[game].gaps.map((g) => g.rule)]),
    );
    expect(gaps).toEqual({
      'gin-rummy': ['rules-fit', 'pauses'],
      fidice: ['curtain', 'rules-fit', 'cues', 'stepper', 'pauses'],
      backgammon: ['rules-fit', 'pauses'],
      briscola: ['curtain', 'rules-fit', 'pauses'],
      uno: ['curtain', 'pauses'],
      flip7: [],
      hive: ['pauses'],
    });
  });

  test("every seat range is the shell config's shape (min <= max, two or more) and every gap names a follow-up", () => {
    SHELL_GAMES.forEach((game) => {
      const { seats, gaps, cssFloor } = CONFORMANCE[game];
      expect(seats.min).toBeLessThanOrEqual(seats.max);
      expect(seats.max).toBeGreaterThanOrEqual(2);
      expect(cssFloor).toBeGreaterThan(0);
      gaps.forEach((gap) => {
        expect(gap.followUp.length).toBeGreaterThan(20);
      });
    });
  });
});
