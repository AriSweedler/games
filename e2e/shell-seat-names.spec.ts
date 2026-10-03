// One name input per seat on every shell game with a Players stepper in its pass-and-play panel
// (web/shared/markup/seatNames.ts, web/shared/ui/seatNames.ts; the owner, 2026-10-02, on a UNO
// home with the stepper at six and four inputs painted: "more than 4 players should paint
// properly ... Make it impossible to have a bad menu like this"): at the stepper's minimum, at six
// (or the maximum where that is lower) and at the maximum, the inputs on show are exactly as many
// as the count says. And a third seat's prefilled default clears on the tap and stays cleared
// through the repaint, so what is typed is what is stored and shown after a reload (the owner on
// a live UNO home that stored "SandroQ" for a typed "Q", 2026-10-02: "Make it impossible to have
// a bad menu like this"). A page whose panel has no stepper (a fixed two seats, or briscola's
// select until its stepper lands) skips. Page-only; tagged per game (see shell-home.spec.ts).
import type { Page } from '@playwright/test';

import { REGISTRY, SHELL_GAMES, type ShellGame } from '../tools/games.ts';
import { PHONE } from './fixtures/geometry.ts';
import { gamePath } from './fixtures/player.ts';
import type { Project } from './fixtures/site.ts';
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

/** The pass-and-play panel open at `PHONE`; true when it has a Players stepper. */
const openLocalPanel = async (page: Page, project: Project, game: ShellGame): Promise<boolean> => {
  await page.setViewportSize({ width: PHONE.width, height: PHONE.height });
  await page.goto(gamePath(project, game));
  await page.locator('#playModeSwitch .mode-btn[data-mode="local"]').click();
  await expect(page.locator('#localModeContent')).toBeVisible();
  return (await page.locator(FIELD).count()) > 0;
};

/** `localStorage[key]`, or null. */
const stored = (page: Page, key: string): Promise<string | null> =>
  page.evaluate((k) => localStorage.getItem(k), key);

SHELL_GAMES.forEach((game) => {
  test.describe(game, { tag: `@${game}` }, () => {
    test('pass and play: as many name inputs on show as the Players stepper says, at its minimum, at six and at its maximum', async ({
      player,
      project,
    }) => {
      const { page } = player;
      test.skip(!(await openLocalPanel(page, project, game)), 'no Players stepper in this panel');
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

    test('pass and play: a tap on the third seat clears its default; the typed name is what is stored and what a reload shows', async ({
      player,
      project,
    }) => {
      const { page } = player;
      test.skip(!(await openLocalPanel(page, project, game)), 'no Players stepper in this panel');
      await stepTo(page, 3);
      const third = page.locator('#p3NameInput');
      const key = `${REGISTRY[game].storage.prefix}p3Name`;
      // Untouched: the default shows, marked, and nothing is stored.
      await expect(third).toBeVisible();
      await expect(third).toHaveAttribute('data-default', '1');
      const fallback = await third.inputValue();
      expect(fallback).not.toBe('');
      expect(await stored(page, key)).toBeNull();
      // The tap clears the default and keeps it clear; the keystroke is the whole name.
      await third.click();
      await expect(third).toHaveValue('');
      await expect(third).not.toHaveAttribute('data-default', '1');
      await page.keyboard.type('Q');
      await expect(third).toHaveValue('Q');
      expect(await stored(page, key)).toBe('Q');
      // Back from a reload the typed name is remembered, unmarked.
      await page.reload();
      await page.locator('#playModeSwitch .mode-btn[data-mode="local"]').click();
      await expect(third).toBeVisible();
      await expect(third).toHaveValue('Q');
      await expect(third).not.toHaveAttribute('data-default', '1');
      expect(await stored(page, key)).toBe('Q');
      // Cleared and left empty, the seat falls back to its default after a reload, storing nothing.
      await third.fill('');
      expect(await stored(page, key)).toBeNull();
      await page.reload();
      await page.locator('#playModeSwitch .mode-btn[data-mode="local"]').click();
      await expect(third).toHaveValue(fallback);
      await expect(third).toHaveAttribute('data-default', '1');
    });
  });
});
