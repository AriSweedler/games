// The game conformance suite, the built half (docs/design/game-conformance.md): the served page of
// every registered shell game (tools/games.ts SHELL_GAMES) is the shell's home, or the build fails
// here. UNO's first menu was live for hours because its SOLO MVP shipped before its shell page (the
// owner, 2026-10-02: "Make it impossible to have a bad menu like this"); this guard makes that
// order impossible: a page without the shell's host and join cards, its mode switch with Online,
// its Rules tab, or with a `<select>` where the stepper belongs, fails naming the game and the
// rule. A solo page (SOLO_PAGES) must not carry the shell's home either: a game with seats
// registered as a solo page is the same mistake. Runs after the build (npm run test:site).
import { expect, test } from 'vitest';

import { CONFORMANCE, SHELL_GAMES, SOLO_PAGES } from '../../tools/games.ts';
import { describeDist, readDist } from './dist.ts';

/** The ids the shell's home partial (web/shared/markup/shell/home.html) gives every shell page. */
const HOME_IDS: ReadonlyArray<string> = [
  'homeScreen',
  'topTabbar',
  'tabPlayBtn',
  'tabRulesBtn',
  'playModeSwitch',
  'onlineModeContent',
  'nameInput',
  'codeInput',
  'joinBtn',
  'localModeContent',
  'localBtn',
  'rulesPanel',
  'rulesList',
];

describeDist("game conformance: the served home is the shell's", (root) => {
  SHELL_GAMES.forEach((game) => {
    const page = readDist(root, `games/${game}/index.html`);
    const { seats, gaps } = CONFORMANCE[game];

    test(`${game}: shell-home: the home has the host and join cards, the mode switch and the Rules tab`, () => {
      HOME_IDS.forEach((id) => {
        expect(
          page.includes(`id="${id}"`),
          `${game}: shell-home: the served page has no #${id}; compose the page from page.ts (tools/shell-markup.ts --write)`,
        ).toBe(true);
      });
      expect(
        page.includes('data-mode="online"'),
        `${game}: online-mode: the mode switch has no Online`,
      ).toBe(true);
    });

    const stepperGap = gaps.find((g) => g.rule === 'stepper');
    const stepperCase = stepperGap === undefined ? test : test.skip;
    stepperCase(
      `${game}: stepper: ${seats.min < seats.max ? `a stepper ${String(seats.min)}-${String(seats.max)} in the host card and the pass-and-play panel, no <select>` : 'two seats, no stepper and no <select>'}${stepperGap === undefined ? '' : ` [gap: ${stepperGap.followUp}]`}`,
      () => {
        const steppers = page.match(/class="stepper" data-min="(\d+)" data-max="(\d+)"/g) ?? [];
        if (seats.min < seats.max) {
          expect(
            steppers,
            `${game}: stepper: the page places the shared stepper twice (host card, pass-and-play panel) at ${String(seats.min)}-${String(seats.max)}`,
          ).toEqual([
            `class="stepper" data-min="${String(seats.min)}" data-max="${String(seats.max)}"`,
            `class="stepper" data-min="${String(seats.min)}" data-max="${String(seats.max)}"`,
          ]);
        } else {
          expect(steppers, `${game}: stepper: a two-seat game places no stepper`).toEqual([]);
        }
        expect(
          /<select[^>]*id="[^"]*(seat|player)[^"]*"/i.test(page),
          `${game}: stepper: a <select> picks the player count; use stepperHtml (AGENT.md "never a <select>")`,
        ).toBe(false);
      },
    );
  });

  SOLO_PAGES.forEach((page) => {
    test(`${page}: a solo page carries no shell home (a game with seats belongs in SHELL_GAMES)`, () => {
      const markup = readDist(root, `games/${page}/index.html`);
      expect(
        markup.includes('id="playModeSwitch"'),
        `${page}: shell-home: a solo page serves the shell's mode switch; register it as a shell game`,
      ).toBe(false);
      expect(
        markup.includes('class="stepper"'),
        `${page}: stepper: a solo page has a player count; register it as a shell game`,
      ).toBe(false);
    });
  });
});
