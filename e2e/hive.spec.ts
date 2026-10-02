// Hive pass-and-play through the shared shell (docs/design/hive.md §7): a two-seat game on the
// shell page at a phone and a laptop. Pass the phone with two names, Start, the first curtain
// names White until "Show the board"; a tap on a hand tile lights where it may go, a tap on a lit
// hex places it and the curtain drops for Black; a tap on a tile already down lights its moves.
// Three tiles without the Queen and the status says she must come down, with only her playable;
// Resign ends the game on the result sheet, whose Continue leaves the final board on show. Nothing
// is random, so no seed. The hook `window.__hive` (`view()`, `legal()`, `act`) reads the game back.
// On `pages` alone: this is about the page, not the origin. The shell's own flows (the home, the
// room, the handoff, resume) are the shell specs' `@hive` describes.
import type { Page } from '@playwright/test';

import type { Bug } from '../web/games/hive/src/engine/pieces.ts';
import { DESKTOP, PHONE, type Viewport } from './fixtures/geometry.ts';
import { hiveReveal, hiveStartLocal, requireView } from './fixtures/hive.ts';
import { pagePath } from './fixtures/site.ts';
import { expect, test } from './fixtures/two-players.ts';

const NAMES = ['Ari', 'Lavi'] as const;

/** The seat holding the phone places `bug` on the first lit hex; the curtain comes up for the other seat. */
const placeFirstLit = async (page: Page, side: 'white' | 'black', bug: Bug): Promise<void> => {
  const tile = page.locator(`#${side}Hand .hand-tile[data-bug="${bug}"]`);
  await expect(tile).toHaveClass(/playable/);
  await tile.click();
  await expect(tile).toHaveClass(/picked/);
  const lit = page.locator('#board .hex.lit');
  await expect(lit.first()).toBeVisible();
  await lit.first().click();
  await expect(page.locator('#curtainOverlay')).toBeVisible();
};

const playAt = (viewport: Viewport): void => {
  test(`place, move and resign at ${String(viewport.width)}x${String(viewport.height)}`, async ({
    phone,
    project,
  }) => {
    test.skip(project !== 'pages', 'about the page, not the origin');
    const { page } = phone;
    await hiveStartLocal(page, pagePath(project, 'hive'), viewport, [...NAMES]);
    await expect(page).toHaveTitle('Hive');

    // The first curtain names White and hides the board; its one button shows it.
    await expect(page.locator('#curtainTitle')).toHaveText(`Pass the phone to ${NAMES[0]}`);
    await expect(page.locator('#curtainBtn')).toHaveText('Show the board');
    await hiveReveal(page);
    const start = await requireView(page);
    expect(start.names).toEqual([...NAMES]);
    expect(start).toMatchObject({ seat: 0, game: { turn: 'white', board: {} } });
    await expect(page.locator('#myName')).toHaveText(`${NAMES[0]} · White`);
    // The empty board shows the one cell the first tile may go to; all five bugs are playable.
    await expect(page.locator('#board .hex')).toHaveCount(1);
    await expect(page.locator('#whiteHand .hand-tile.playable')).toHaveCount(5);
    await expect(page.locator('#blackHand .hand-tile.playable')).toHaveCount(0);

    // White's Ant at the origin; the curtain hands the phone to Black, the move written on it.
    await placeFirstLit(page, 'white', 'ant');
    await expect(page.locator('#curtainTitle')).toHaveText(`Pass the phone to ${NAMES[1]}`);
    await expect(page.locator('#curtainSub')).toHaveText(`${NAMES[0]}, look away`);
    await expect(page.locator('#curtainLast')).toContainText('placed a Soldier Ant');
    await hiveReveal(page);
    // Black's first tile touches the hive: six cells lit around the one tile.
    await page.locator('#blackHand .hand-tile[data-bug="spider"]').click();
    await expect(page.locator('#board .hex.lit')).toHaveCount(6);
    await page.locator('#board .hex.lit').first().click();
    await hiveReveal(page);

    // White: a Grasshopper, then (Black: Queen) a Beetle: three tiles without the Queen.
    await placeFirstLit(page, 'white', 'grasshopper');
    await hiveReveal(page);
    await placeFirstLit(page, 'black', 'queen');
    await hiveReveal(page);
    await placeFirstLit(page, 'white', 'beetle');
    await hiveReveal(page);
    // Black's Queen is down, so Black may move: a tap on her lights her steps; a second tap clears.
    const queen = page.locator('#board .hex.b').filter({ hasText: 'Q' });
    await queen.click();
    await expect(page.locator('#board .hex.picked')).toHaveCount(1);
    await expect(page.locator('#board .hex.lit').first()).toBeVisible();
    await queen.click();
    await expect(page.locator('#board .hex.picked')).toHaveCount(0);
    await placeFirstLit(page, 'black', 'ant');
    await hiveReveal(page);

    // White's fourth tile must be the Queen: the status says so and she alone is playable.
    await expect(page.locator('#statusText')).toContainText('your Queen must come down');
    await expect(page.locator('#whiteHand .hand-tile.playable')).toHaveCount(1);
    await expect(page.locator('#whiteHand .hand-tile.playable')).toHaveAttribute(
      'data-bug',
      'queen',
    );
    const before = await requireView(page);
    expect(Object.keys(before.game.board)).toHaveLength(6);

    // White resigns: the result sheet over the board; Continue leaves the final board on show.
    await page.locator('#resignBtn').click();
    await expect(page.locator('#resultOverlay')).toBeVisible();
    await expect(page.locator('#rsTitle')).toHaveText(`${NAMES[1]} wins!`);
    await expect(page.locator('#rsNote')).toContainText(`${NAMES[0]} resigned`);
    await page.locator('#rsContinueBtn').click();
    await expect(page.locator('#resultOverlay')).toBeHidden();
    await expect(page.locator('#board .hex.w, #board .hex.b')).toHaveCount(6);
    await expect(page.locator('#againBtn')).toBeVisible();
    const over = await requireView(page);
    expect(over.game.result).toEqual({ kind: 'win', winner: 'black', by: 'resign' });
  });
};

playAt(PHONE);
playAt(DESKTOP);
