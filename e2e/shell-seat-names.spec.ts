// One name input per seat on every shell game with a Players stepper in its pass-and-play panel
// (web/shared/markup/seatNames.ts, web/shared/ui/seatNames.ts; the owner, 2026-10-02, on a UNO
// home with the stepper at six and four inputs painted: "more than 4 players should paint
// properly ... Make it impossible to have a bad menu like this"): at the stepper's minimum, at six
// (or the maximum where that is lower) and at the maximum, the inputs on show are exactly as many
// as the count says. A page whose panel has no stepper (a fixed two seats, or briscola's select
// until its stepper lands) skips. Page-only; tagged per game (see shell-home.spec.ts).
import type { Page } from '@playwright/test';

import { SHELL_GAMES } from '../tools/games.ts';
import { PHONE } from './fixtures/geometry.ts';
import { gamePath } from './fixtures/player.ts';
import { expect, test } from './fixtures/two-players.ts';

const FIELD = '#localPlayersCount';

/** The stepper tapped towards `n`, one step at a time, until the field says so. */
const stepTo = async (page: Page, n: number): Promise<void> => {
  const now = Number(await page.locator(FIELD).inputValue());
  if (now === n) return;
  await page.locator(now < n ? `${FIELD}Inc` : `${FIELD}Dec`).click();
  await expect(page.locator(FIELD)).toHaveValue(String(now < n ? now + 1 : now - 1));
  await stepTo(page, n);
};

/** The name inputs on show in the pass-and-play panel: `#p1NameInput` … `#p12NameInput`. */
const visibleNames = (page: Page): ReturnType<Page['locator']> =>
  page.locator('#localModeContent input[id$="NameInput"]:visible');

SHELL_GAMES.forEach((game) => {
  test.describe(game, { tag: `@${game}` }, () => {
    test('pass and play: as many name inputs on show as the Players stepper says, at its minimum, at six and at its maximum', async ({
      player,
      project,
    }) => {
      const { page } = player;
      await page.setViewportSize({ width: PHONE.width, height: PHONE.height });
      await page.goto(gamePath(project, game));
      await page.locator('#playModeSwitch .mode-btn[data-mode="local"]').click();
      await expect(page.locator('#localModeContent')).toBeVisible();
      test.skip((await page.locator(FIELD).count()) === 0, 'no Players stepper in this panel');
      const stepper = page.locator('#localModeContent .stepper');
      const min = Number(await stepper.getAttribute('data-min'));
      const max = Number(await stepper.getAttribute('data-max'));
      expect(min).toBeGreaterThanOrEqual(2);
      expect(max).toBeGreaterThan(min);
      await [min, Math.min(6, max), max].reduce<Promise<void>>(async (prev, n) => {
        await prev;
        await stepTo(page, n);
        await expect(visibleNames(page)).toHaveCount(n);
        await expect(page.locator(`#p${String(n)}NameInput`)).toBeVisible();
        await expect(page.locator(`#p${String(n + 1)}NameInput`)).toBeHidden();
      }, Promise.resolve());
    });
  });
});
