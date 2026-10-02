// Hive pass-and-play through the shared shell (docs/design/hive.md §7): a two-seat game on the
// shell page at a phone and a laptop. Pass the phone with two names, Start, and the table is on
// show at once, White's view, with no curtain between turns (the owner, 2026-10-02: "hive is like
// backgammon, where you don't need to pass the phone for turns"): a tap on a hand tile lights
// where it may go, a tap on a lit hex places it and the view is Black's; a tap on a tile already
// down lights its moves. The hands are trays of hexagonal tiles (the board's hexagon, the bug
// engraved on it, a count badge), any of them playable at any time; three tiles without the Queen and the
// status says she must come down, with only her playable. The board's viewBox fits the hive and
// its ring, so a pick never rescales it. Resign ends the game on the result sheet, whose Continue
// leaves the final board on show. The tiles drag too (ui/dragger.ts over the shared kernel): a tray
// tile pressed and moved lights its hexes and a ghost follows the pointer; the lit hex nearest the
// pointer, from beside it, carries `drop`; released there the tile is down, released off every hex
// it glides back to the tray; a board tile drags the same way over the lift the paint lays on it.
// Nothing is random, so no seed. The hook `window.__hive`
// (`view()`, `legal()`, `act`) reads the game back. On `pages` alone: this is about the page, not
// the origin. The shell's own flows (the home, the room, the handoff, resume) are the shell specs'
// `@hive` describes.
import type { Page } from '@playwright/test';

import type { Bug } from '../web/games/hive/src/engine/pieces.ts';
import { DESKTOP, PHONE, type Viewport } from './fixtures/geometry.ts';
import { hiveAct, hiveStartLocal, requireView } from './fixtures/hive.ts';
import { pagePath } from './fixtures/site.ts';
import { expect, test } from './fixtures/two-players.ts';

const NAMES = ['Ari', 'Lavi'] as const;

/** `#myName` as the table paints it: the seat's name and side. */
const seated = (seat: 0 | 1): string => `${NAMES[seat]} · ${seat === 0 ? 'White' : 'Black'}`;

/** The board's viewBox, the fit the paint chose. */
const viewBox = (page: Page): Promise<string | null> =>
  page.locator('#board svg.hive').getAttribute('viewBox');

/**
 * The seat on show places `bug` on the first lit hex; the other seat's view comes up on screen
 * (no curtain), `#myName` naming it.
 */
const placeFirstLit = async (page: Page, side: 'white' | 'black', bug: Bug): Promise<void> => {
  const tile = page.locator(`#${side}Hand .hand-tile[data-bug="${bug}"]`);
  await expect(tile).toHaveClass(/playable/);
  await tile.click();
  await expect(tile).toHaveClass(/picked/);
  const lit = page.locator('#board .hex.lit');
  await expect(lit.first()).toBeVisible();
  await lit.first().click();
  await expect(page.locator('#curtainOverlay')).toBeHidden();
  await expect(page.locator('#myName')).toHaveText(seated(side === 'white' ? 1 : 0));
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

    // No curtain: White's table is on show from Start.
    await expect(page.locator('#curtainOverlay')).toBeHidden();
    const start = await requireView(page);
    expect(start.names).toEqual([...NAMES]);
    expect(start).toMatchObject({ seat: 0, game: { turn: 'white', board: {} } });
    await expect(page.locator('#myName')).toHaveText(seated(0));
    // The empty board shows the one cell the first tile may go to; all five bugs are playable.
    await expect(page.locator('#board .hex')).toHaveCount(1);
    await expect(page.locator('#whiteHand .hand-tile.playable')).toHaveCount(5);
    await expect(page.locator('#blackHand .hand-tile.playable')).toHaveCount(0);

    // The tray's tiles are hexagons: each a button around the board's polygon with the bug drawn
    // inside (ui/bugs.ts: a `<use>` of the inlined symbol) and the count badge; at least 44px to tap.
    const ant = page.locator('#whiteHand .hand-tile[data-bug="ant"]');
    await expect(ant.locator('svg.tile polygon.face')).toHaveCount(1);
    await expect(ant.locator('svg.tile .bug[data-bug="ant"] use.ink')).toHaveCount(1);
    await expect(page.locator('body > svg symbol#bug-ant')).toHaveCount(1);
    await expect(ant.locator('.count')).toHaveText('3');
    const box = await ant.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    // A pick lights the origin and leaves the board where it was: the viewBox is the same box.
    const fit = await viewBox(page);
    await ant.click();
    await expect(page.locator('#board .hex.lit')).toHaveCount(1);
    expect(await viewBox(page)).toBe(fit);
    await ant.click();
    await expect(ant).not.toHaveClass(/picked/);
    expect(await viewBox(page)).toBe(fit);

    // White's Ant at the origin; Black's view comes up, the move in the status line.
    await placeFirstLit(page, 'white', 'ant');
    await expect(page.locator('#statusText')).toContainText('placed a Soldier Ant');
    await expect(page.locator('#statusText')).toContainText('Your turn');
    // Black's first tile touches the hive: six cells lit around the one tile, inside the fit.
    const fitOne = await viewBox(page);
    await page.locator('#blackHand .hand-tile[data-bug="spider"]').click();
    await expect(page.locator('#board .hex.lit')).toHaveCount(6);
    expect(await viewBox(page)).toBe(fitOne);
    await page.locator('#board .hex.lit').first().click();
    await expect(page.locator('#myName')).toHaveText(seated(0));

    // White: a Grasshopper, then (Black: Queen) a Beetle: three tiles without the Queen.
    await placeFirstLit(page, 'white', 'grasshopper');
    await placeFirstLit(page, 'black', 'queen');
    await placeFirstLit(page, 'white', 'beetle');
    // Black's Queen is down, so Black may move: a tap on her lights her steps; a second tap clears.
    const queen = page.locator('#board .hex.b', { has: page.locator('.bug[data-bug="queen"]') });
    await queen.click();
    await expect(page.locator('#board .hex.picked')).toHaveCount(1);
    await expect(page.locator('#board .hex.lit').first()).toBeVisible();
    await queen.click();
    await expect(page.locator('#board .hex.picked')).toHaveCount(0);
    await placeFirstLit(page, 'black', 'ant');

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

/** The centre of a locator's box, which it must have. */
const centreOf = async (
  page: Page,
  selector: string,
): Promise<{ x: number; y: number; w: number; h: number }> => {
  const box = await page.locator(selector).boundingBox();
  if (box === null) throw new Error(`${selector}: no box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, w: box.width, h: box.height };
};

/** A press at `from` carried `dx, dy` past the kernel's threshold: the drag has begun. */
const lift = async (
  page: Page,
  from: { x: number; y: number },
  dx: number,
  dy: number,
): Promise<void> => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 2 });
};

const GHOST = 'body > .drag-ghost';

const dragAt = (viewport: Viewport): void => {
  test(`drag a tile from the tray, one back to it, and one across the board at ${String(viewport.width)}x${String(viewport.height)}`, async ({
    phone,
    project,
  }) => {
    test.skip(project !== 'pages', 'about the page, not the origin');
    const { page } = phone;
    await hiveStartLocal(page, pagePath(project, 'hive'), viewport, [...NAMES]);

    // White's Ant lifted off the tray: the origin lights, the tile dims, a ghost is on the body.
    const ant = page.locator('#whiteHand .hand-tile[data-bug="ant"]');
    const antAt = await centreOf(page, '#whiteHand .hand-tile[data-bug="ant"]');
    await lift(page, antAt, 12, -12);
    const litHex = page.locator('#board .hex.lit');
    await expect(litHex).toHaveCount(1);
    await expect(ant).toHaveClass(/dragging/);
    await expect(page.locator(GHOST)).toHaveCount(1);
    await expect(page.locator('#board .hex.drop')).toHaveCount(0);
    // The hex is a thumb's target; beside it, outside its box but inside the snap, it takes the drop.
    const to = await centreOf(page, '#board .hex.lit');
    expect(to.w).toBeGreaterThanOrEqual(44);
    expect(to.h).toBeGreaterThanOrEqual(44);
    await page.mouse.move(to.x + to.w * 0.7, to.y, { steps: 4 });
    await expect(litHex).toHaveClass(/drop/);
    // Far away again: dark. Back over it and released: the Ant is down and Black's view is up.
    await page.mouse.move(antAt.x, antAt.y, { steps: 4 });
    await expect(page.locator('#board .hex.drop')).toHaveCount(0);
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await expect(litHex).toHaveClass(/drop/);
    await page.mouse.up();
    await expect(page.locator('#board .hex.w')).toHaveCount(1);
    await expect(page.locator('#myName')).toHaveText(seated(1));
    await expect(page.locator(GHOST)).toHaveCount(0);
    expect((await requireView(page)).game.board['0,0']).toEqual([{ side: 'white', bug: 'ant' }]);

    // Black's Spider released on the names strip, off every hex: the ghost glides back, nothing is placed.
    const spider = page.locator('#blackHand .hand-tile[data-bug="spider"]');
    await lift(page, await centreOf(page, '#blackHand .hand-tile[data-bug="spider"]'), 12, 12);
    await expect(page.locator('#board .hex.lit')).toHaveCount(6);
    const strip = await centreOf(page, '#myName');
    await page.mouse.move(strip.x, strip.y, { steps: 4 });
    await page.mouse.up();
    await expect(page.locator(GHOST)).toHaveCount(0);
    await expect(page.locator('#board .hex.lit')).toHaveCount(0);
    await expect(spider).not.toHaveClass(/picked|dragging/);
    const kept = await requireView(page);
    expect(kept.game.hands.black.spider).toBe(2);
    expect(Object.keys(kept.game.board)).toHaveLength(1);

    // Both Queens down through the hook; Black's Queen may step, so she is `movable`: dragged off her
    // hex (the lift laid over it) onto a lit one, she moves and the turn is White's.
    await hiveAct(page, { type: 'place', bug: 'queen', to: { q: 1, r: 0 } });
    await expect(page.locator('#myName')).toHaveText(seated(0));
    await hiveAct(page, { type: 'place', bug: 'queen', to: { q: -1, r: 0 } });
    await expect(page.locator('#myName')).toHaveText(seated(1));
    const queen = page.locator('#board .hex.b.movable');
    await expect(queen).toHaveCount(1);
    await lift(page, await centreOf(page, '#board .hex.b.movable'), 0, -12);
    await expect(page.locator('#board .hex.picked')).toHaveCount(1);
    await expect(page.locator('#board svg.lift')).toHaveCount(1);
    await expect(page.locator(GHOST)).toHaveCount(1);
    const target = page.locator('#board .hex.lit').first();
    const key = await target.getAttribute('data-hex');
    if (key === null) throw new Error('the lit hex has no key');
    const step = await centreOf(page, `#board .hex.lit[data-hex="${key}"]`);
    await page.mouse.move(step.x, step.y, { steps: 4 });
    await expect(target).toHaveClass(/drop/);
    await page.mouse.up();
    const moved = await requireView(page);
    expect(moved.game.board['1,0']).toBeUndefined();
    expect(moved.game.board[key]).toEqual([{ side: 'black', bug: 'queen' }]);
    await expect(page.locator('#myName')).toHaveText(seated(0));
    await expect(page.locator(GHOST)).toHaveCount(0);
    await expect(page.locator('#board svg.lift')).toHaveCount(0);
  });
};

dragAt(PHONE);
