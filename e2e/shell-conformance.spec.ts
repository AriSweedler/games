// The game conformance suite, the browser half (docs/design/game-conformance.md; AGENT.md "A new
// game"): every registered shell game (tools/games.ts SHELL_GAMES) at a phone (390x844), the rules
// a page can only prove in a browser. The home is the shell's with Online a mode (AGENT.md "Every
// game is a shared-shell game"); the player count is the shared stepper at the game's bounds and
// pass and play shows one name input per seat the stepper counts, at the minimum and at the
// maximum (the owner, 2026-10-02: "Make it impossible to have a bad menu like this": UNO's stepper
// reached 12 while its panel had four names); the Rules tab fits the phone with no scroll (AGENT.md
// "The Rules tab fits one phone screen"). The table's two seats by name are e2e/shell-local.spec.ts's;
// the N-seat table is each game's own spec. Each failure names the game and the rule in one line; a
// rule the game is known to miss is a declared gap in its CONFORMANCE row, reported as fixme with its
// follow-up. Page-only; a describe per game with its tag, run by that game's e2e job.
import type { Page } from '@playwright/test';

import { CONFORMANCE, SHELL, SHELL_GAMES, type ConformanceRule } from '../tools/games.ts';
import { PHONE } from './fixtures/geometry.ts';
import { gamePath } from './fixtures/player.ts';
import { DEFAULT_NAMES, hasCurtain, startLocal } from './fixtures/shell.ts';
import { expect, test } from './fixtures/two-players.ts';

const why = (game: string, rule: ConformanceRule, fix: string): string =>
  `${game}: ${rule}: ${fix}`;

/** Tap the stepper's button until it disables (the bound), at most `max` times. */
const stepTo = async (page: Page, button: string, max: number): Promise<void> => {
  const btn = page.locator(`#${button}`);
  // A bounded recursion in place of a loop: the suite's style ban reaches the specs.
  const step = async (left: number): Promise<void> => {
    if (left === 0 || (await btn.isDisabled())) return;
    await btn.click();
    await step(left - 1);
  };
  await step(max);
};

/** How many name inputs the pass-and-play panel shows. */
const visibleNames = (page: Page): Promise<number> =>
  page.locator('#localModeContent input[id$="NameInput"]:visible').count();

/** Whether anything from the rules list up to the document scrolls: the first scrolling ancestor, or null. */
const rulesOverflow = (page: Page): Promise<string | null> =>
  // A string expression: the e2e project has no DOM types.
  page.evaluate<string | null>(
    `(() => {
      const doc = document.documentElement;
      if (doc.scrollHeight > window.innerHeight + 1) return 'the document scrolls (' + doc.scrollHeight + ' > ' + window.innerHeight + ')';
      const list = document.getElementById('rulesList');
      if (list === null) return 'no #rulesList';
      const bottom = list.getBoundingClientRect().bottom;
      if (bottom > window.innerHeight + 1) return '#rulesList ends below the fold (' + Math.round(bottom) + ' > ' + window.innerHeight + ')';
      const scrolling = [];
      for (let el = list; el !== null && el !== document.body; el = el.parentElement) {
        const o = getComputedStyle(el).overflowY;
        if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 1) scrolling.push((el.id ? '#' + el.id : el.tagName) + ' (' + el.scrollHeight + ' > ' + el.clientHeight + ')');
      }
      return scrolling.length === 0 ? null : scrolling.join(', ');
    })()`,
  );

/** The curtain overlay's computed background alpha (1 is opaque), or null when it is not up. */
const curtainAlpha = (page: Page): Promise<number | null> =>
  // A string expression: the e2e project has no DOM types.
  page.evaluate<number | null>(
    `(() => {
      const el = document.getElementById('curtainOverlay');
      if (el === null || el.classList.contains('hidden')) return null;
      const bg = getComputedStyle(el).backgroundColor;
      const m = /rgba?\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*(?:,\\s*([\\d.]+))?\\s*\\)/.exec(bg);
      if (m === null) return bg === 'transparent' ? 0 : -1;
      return m[1] === undefined ? 1 : Number(m[1]);
    })()`,
  );

SHELL_GAMES.forEach((game) => {
  test.describe(game, { tag: `@${game}` }, () => {
    const conf = CONFORMANCE[game];
    const shell = SHELL[game];
    const gap = (rule: ConformanceRule) => conf.gaps.find((g) => g.rule === rule);

    test.beforeEach(async ({ player, project }) => {
      await player.page.setViewportSize({ width: PHONE.width, height: PHONE.height });
      await player.page.goto(gamePath(project, game));
    });

    test("shell-home: the shell's home with its host and join cards; online-mode: Online is a mode", async ({
      player,
    }) => {
      const { page } = player;
      await expect(
        page.locator('#homeScreen'),
        why(game, 'shell-home', 'the page has no shell home; compose it from page.ts'),
      ).toBeVisible();
      await expect(
        page.locator('#playModeSwitch .mode-btn'),
        why(game, 'shell-home', "the mode switch is not the shell's"),
      ).toHaveText(shell.modes);
      expect(
        shell.modes.some((m) => /online/i.test(m)),
        why(game, 'online-mode', 'Online is not a mode'),
      ).toBe(true);
      await page.locator('#playModeSwitch .mode-btn[data-mode="online"]').click();
      await expect(
        page.locator('#onlineModeContent'),
        why(game, 'shell-home', 'no online panel'),
      ).toBeVisible();
      await expect(
        page.locator('#codeInput'),
        why(game, 'shell-home', 'no join card (#codeInput)'),
      ).toBeVisible();
      await expect(
        page.locator('#joinBtn'),
        why(game, 'shell-home', 'no join button'),
      ).toBeVisible();
      await expect(
        page.locator('#nameInput'),
        why(game, 'shell-home', 'no host card name'),
      ).toBeVisible();
    });

    test("stepper and seat-names: the pass-and-play count steps between the game's bounds and shows one name per seat", async ({
      player,
    }) => {
      const { page } = player;
      const stepperGap = gap('stepper');
      test.fixme(
        stepperGap !== undefined,
        stepperGap === undefined ? '' : why(game, 'stepper', stepperGap.followUp),
      );
      const namesGap = gap('seat-names');
      test.fixme(
        namesGap !== undefined,
        namesGap === undefined ? '' : why(game, 'seat-names', namesGap.followUp),
      );
      await page.locator('#playModeSwitch .mode-btn[data-mode="local"]').click();
      await expect(page.locator('#localModeContent')).toBeVisible();
      const { min, max } = conf.seats;
      if (min === max) {
        await expect(
          page.locator('#localModeContent .stepper'),
          why(game, 'stepper', 'a two-seat game places no stepper'),
        ).toHaveCount(0);
        expect(
          await visibleNames(page),
          why(game, 'seat-names', 'two seats, two name inputs'),
        ).toBe(2);
        return;
      }
      const stepper = page.locator('#localModeContent .stepper');
      await expect(
        stepper,
        why(
          game,
          'stepper',
          'the pass-and-play panel has no shared stepper (stepperHtml with id localPlayersCount)',
        ),
      ).toHaveCount(1);
      await expect(stepper, why(game, 'stepper', `data-min is not ${String(min)}`)).toHaveAttribute(
        'data-min',
        String(min),
      );
      await expect(stepper, why(game, 'stepper', `data-max is not ${String(max)}`)).toHaveAttribute(
        'data-max',
        String(max),
      );
      await expect(
        page.locator('#localModeContent select[id*="eat"], #localModeContent select[id*="layer"]'),
        why(game, 'stepper', 'a <select> picks the player count; the count is the stepper'),
      ).toHaveCount(0);
      await stepTo(page, 'localPlayersCountInc', max);
      await expect(
        page.locator('#localPlayersCount'),
        why(game, 'stepper', `+ does not reach ${String(max)}`),
      ).toHaveValue(String(max));
      expect(
        await visibleNames(page),
        why(
          game,
          'seat-names',
          `${String(max)} players but not ${String(max)} name inputs: paint one per seat`,
        ),
      ).toBe(max);
      await stepTo(page, 'localPlayersCountDec', max);
      await expect(
        page.locator('#localPlayersCount'),
        why(game, 'stepper', `− does not reach ${String(min)}`),
      ).toHaveValue(String(min));
      expect(
        await visibleNames(page),
        why(game, 'seat-names', `${String(min)} players but not ${String(min)} name inputs`),
      ).toBe(min);
    });

    test('curtain: the pass-and-play curtain hides the table (an opaque scrim, or the table hidden under it)', async ({
      player,
      project,
    }) => {
      const { page } = player;
      const curtainGap = gap('curtain');
      test.fixme(
        curtainGap !== undefined,
        curtainGap === undefined ? '' : why(game, 'curtain', curtainGap.followUp),
      );
      test.skip(!hasCurtain(game), `${game} raises no curtain (SHELL firstCurtain null)`);
      test.skip(
        !conf.hides,
        `${game} hides nothing: the curtain names the starter or rises once (CONFORMANCE hides)`,
      );
      await startLocal(page, gamePath(project, game), PHONE, DEFAULT_NAMES);
      await expect(page.locator('#curtainOverlay')).toBeVisible();
      const alpha = await curtainAlpha(page);
      const tableShown = await page.locator('#tableScreen').isVisible();
      expect(
        alpha === 1 || !tableShown,
        why(
          game,
          'curtain',
          `the curtain's scrim is ${String(alpha)} opaque over a visible table: paint .overlay.curtain opaque in theme.css or hide the table under it`,
        ),
      ).toBe(true);
    });

    test('rules-fit: the Rules tab fits 390x844 with no scroll', async ({ player }) => {
      const { page } = player;
      const rulesGap = gap('rules-fit');
      test.fixme(
        rulesGap !== undefined,
        rulesGap === undefined ? '' : why(game, 'rules-fit', rulesGap.followUp),
      );
      await page.locator('#tabRulesBtn').click();
      await expect(page.locator('#rulesPanel')).toBeVisible();
      await expect(page.locator('#rulesList li').first()).toBeVisible();
      expect(
        await rulesOverflow(page),
        why(
          game,
          'rules-fit',
          'the Rules tab scrolls at 390x844; cut RULES_ITEMS to what fits (AGENT.md "The Rules tab fits one phone screen")',
        ),
      ).toBeNull();
    });
  });
});
