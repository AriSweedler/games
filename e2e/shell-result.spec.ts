// Leave the table from a finished pass-and-play game, on every shell game (the owner on Hive,
// 2026-10-02: "the modal didn't go away after clicking 'leave the table' … It should be fixed in
// the shell"). Each game is brought to its end through its own fixture and Leave the table is
// tapped where the game offers it with a sheet still up: Hive's result sheet carries it;
// backgammon's and briscola's menu sheets do (their result sheet is put away with "Look at the
// table" first, as a player would). The shell's confirm is accepted, and the home must come back with no overlay
// over it and its controls answering (web/shared/ui/shellPaint.ts `paintScreen`: the home has no
// sheet). Gin ends no sooner than a hundred points and fidice no sooner than an emptied cup, and
// neither puts Leave on a sheet (it sits in the table's top bar, under any sheet), so their case
// leaves from the table: the same home, the same assertions. UNO's result sheet carries Leave: a
// seat is dealt one card that plays and goes out. Flip 7 ends no sooner than two hundred points
// and its one sheet in play, the pause, carries only Continue (over the top bar's Leave), so its
// case rigs a bust, takes the pause through Continue, and leaves from the table. Page-only (e2e/fixtures/site.ts
// PAGE_ONLY_SPECS); tagged per game (see shell-home.spec.ts). One viewport: the rule is the
// paint's, not the layout's.
import type { Page } from '@playwright/test';

import { SHELL_GAMES, type ShellGame } from '../tools/games.ts';
import { bgMove, bgPosition, bgSetup } from './fixtures/backgammon.ts';
import {
  briscolaPosition,
  briscolaSetup,
  playTrick,
  requireView as briscolaView,
} from './fixtures/briscola.ts';
import { flip7RigBust } from './fixtures/flip7.ts';
import { PHONE } from './fixtures/geometry.ts';
import { requireView as hiveView } from './fixtures/hive.ts';
import { gamePath } from './fixtures/player.ts';
import { DEFAULT_NAMES, reveal, revealIf, startLocal } from './fixtures/shell.ts';
import { expect, test } from './fixtures/two-players.ts';
import { requireView as unoView, unoPosition, unoSetup } from './fixtures/uno.ts';

/** Light's last checker on its 1-point, fourteen off; Dark still home (own numbers: Dark's 24 is Light's 1, so Dark sits on its 23 and 1). Any die bears it off. */
const LAST_CHECKER = 'L: 1:1 | D: 23:2 1:13 | bar 0/0 | off 14/0';

/** The result sheet is put away with "Look at the table", the menu opened: Leave sits on that sheet, which is up at the leave (backgammon's and briscola's pages). */
const viaMenu = async (page: Page): Promise<string> => {
  await page.locator('#rsPeekBtn').click();
  await expect(page.locator('#resultOverlay')).toBeHidden();
  await page.locator('#menuBtn').click();
  await expect(page.locator('#menuOverlay')).toBeVisible();
  return 'menuLeaveBtn';
};

/**
 * Bring the game on `page` (pass and play just started, the first curtain up on a game that raises
 * one; hive raises none since #19, `revealIf`) to where Leave the table is tapped, and resolve
 * with that control's id. Where the game has a result sheet, it is reached and left up (or,
 * backgammon and briscola, swapped for the menu sheet that carries Leave).
 */
const ROUTES: Readonly<Record<ShellGame, (page: Page) => Promise<string>>> = {
  'gin-rummy': async (page) => {
    await reveal(page);
    return 'leaveBtn';
  },
  fidice: async (page) => {
    await reveal(page);
    return 'leaveBtn';
  },
  backgammon: async (page) => {
    await reveal(page);
    await bgSetup(page, bgPosition({ text: LAST_CHECKER, turn: 0, dice: [6, 5] }));
    await bgMove(page, 1, 'off');
    await expect(page.locator('#resultOverlay')).toBeVisible();
    await expect(page.locator('#rsTitle')).toContainText(`${DEFAULT_NAMES[0]} wins`);
    return viaMenu(page);
  },
  briscola: async (page) => {
    await reveal(page);
    // One card each, the stock out: the one trick left ends the game.
    await briscolaSetup(
      page,
      briscolaPosition({ hands: [['AB'], ['2C']], trumpCard: '7S', leader: 0 }),
    );
    const over = await playTrick(page);
    expect(over.phase).toBe('over');
    await expect(page.locator('#resultOverlay')).toBeVisible();
    expect((await briscolaView(page)).phase).toBe('over');
    return viaMenu(page);
  },
  hive: async (page) => {
    await revealIf(page, 'hive');
    // White resigns on its first turn: the result sheet over the board, Leave the table on it.
    await page.locator('#resignBtn').click();
    await expect(page.locator('#resultOverlay')).toBeVisible();
    await expect(page.locator('#rsTitle')).toHaveText(`${DEFAULT_NAMES[1]} wins!`);
    expect((await hiveView(page)).game.result).toMatchObject({ kind: 'win', by: 'resign' });
    return 'rsLeaveBtn';
  },
  hearts: async (page) => {
    await revealIf(page, 'hearts');
    // Seat 0 resigns on its first turn: the result sheet over the table, Leave the table on it.
    await page.locator('#resignBtn').click();
    await expect(page.locator('#resultOverlay')).toBeVisible();
    await expect(page.locator('#rsTitle')).toHaveText(`${DEFAULT_NAMES[1]} wins!`);
    return 'rsLeaveBtn';
  },
  uno: async (page) => {
    await reveal(page);
    // Ann holds one red card over a red pile: the one play goes out, the result sheet over the table.
    await unoSetup(page, unoPosition({ hands: [['r5a'], ['b3a', 'b7a']], top: 'r9a' }));
    await page.locator('#hand .tile[data-id="r5a"]').click();
    await expect(page.locator('#resultOverlay')).toBeVisible();
    await expect(page.locator('#rsTitle')).toHaveText('You win!');
    expect(await unoView(page)).toMatchObject({ phase: 'gameOver', winner: 0 });
    return 'rsLeaveBtn';
  },
  flip7: async (page) => {
    await reveal(page);
    // Ann's Hit busts her: the pause (Continue alone on it) holds the table, then Leave in the top bar.
    await flip7RigBust(page);
    await expect(page.locator('#mySeat .seat-name')).toHaveText(DEFAULT_NAMES[0]);
    await page.locator('#hitBtn').click();
    await expect(page.locator('#pauseOverlay')).toBeVisible();
    await expect(page.locator('#pauseTitle')).toHaveText(`${DEFAULT_NAMES[0]} busts`);
    await page.locator('#continueBtn').click();
    await expect(page.locator('#pauseOverlay')).toBeHidden();
    await expect(page.locator('#mySeat .seat-name')).toHaveText(DEFAULT_NAMES[1]);
    return 'leaveBtn';
  },
};

SHELL_GAMES.forEach((game) => {
  test.describe(game, { tag: `@${game}` }, () => {
    test('Leave the table from the finished game: the home comes back with no sheet over it and answers a tap', async ({
      player,
      project,
    }) => {
      const { page } = player;
      await startLocal(page, gamePath(project, game), PHONE);
      const leave = await ROUTES[game](page);
      await expect(page.locator(`#${leave}`)).toBeVisible();
      // The shell's confirm ("Leave the local game?") is the browser's dialog: accepted.
      page.once('dialog', (dialog) => void dialog.accept());
      await page.locator(`#${leave}`).click();
      await expect(page.locator('#homeScreen')).toBeVisible();
      await expect(page.locator('#tableScreen')).toBeHidden();
      // No sheet over the home: the result sheet, the menu, the curtain, every overlay the page carries.
      await expect(page.locator('.overlay:not(.hidden)')).toHaveCount(0);
      // The home answers: the mode switch takes the tap (an overlay left over it would take it
      // instead, and Playwright would refuse the click), and the host button is live.
      await page.locator('#playModeSwitch .mode-btn[data-mode="online"]').click();
      await expect(page.locator('#onlineModeContent')).toBeVisible();
      await expect(page.locator('#hostBtn')).toBeVisible();
      await expect(page.locator('#hostBtn')).toBeEnabled();
    });
  });
});
