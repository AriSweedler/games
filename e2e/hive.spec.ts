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
// The Spider's path reads 1-2-3 over a lit hex the mouse is on while she is picked, and her move
// hops along it (the owner: "the spider's moves must show the '1-2-3' when it moves, as a special
// case"). A stack's count badge peeks at the column (the owner: "selecting or hovering the badge
// showing how many bugs are underneath should show the stack of bugs"): hovered, focused or
// tapped, a panel beside the hex lists every tile top to bottom, the top one marked; a tap
// elsewhere or Escape closes it, and a tap on the badge is no tap on the hex. With the hints hidden
// (💡, or the home's switch) nothing lights: a tile tapped onto any hex is proposed there with
// Confirm and Cancel under the board; Confirm on a move against the rules shows the red toast with
// the reason and the tile is back, on a legal one it plays (the owner: "option to not show
// moves... if you confirm an illegal move it will yell at you with a red toast and tell you why
// it's no good and then undo your move"). Nothing is random, so no seed. The hook `window.__hive`
// (`view()`, `legal()`, `act`) reads the game back. On `pages` alone: this is about the page, not
// the origin. The shell's own flows (the home, the room, the handoff, resume) are the shell specs'
// `@hive` describes.
import type { Page } from '@playwright/test';

import type { Bug } from '../web/games/hive/src/engine/pieces.ts';
import { DESKTOP, PHONE, readFrame, type Viewport } from './fixtures/geometry.ts';
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
    // The ghost is the tile's size, and it keeps its offset from the pointer as it follows.
    const lifted = await centreOf(page, GHOST);
    expect(Math.abs(lifted.w - antAt.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(lifted.h - antAt.h)).toBeLessThanOrEqual(1);
    const grab = { x: lifted.x - (antAt.x + 12), y: lifted.y - (antAt.y - 12) };
    // The hex is a thumb's target; beside it, outside its box but inside the snap, it takes the drop.
    const to = await centreOf(page, '#board .hex.lit');
    expect(to.w).toBeGreaterThanOrEqual(44);
    expect(to.h).toBeGreaterThanOrEqual(44);
    await page.mouse.move(to.x + to.w * 0.7, to.y, { steps: 4 });
    await expect(litHex).toHaveClass(/drop/);
    const carried = await centreOf(page, GHOST);
    expect(Math.abs(carried.x - (to.x + to.w * 0.7) - grab.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(carried.y - to.y - grab.y)).toBeLessThanOrEqual(1);
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
    const queenAt = await centreOf(page, '#board .hex.b.movable');
    await lift(page, queenAt, 0, -12);
    await expect(page.locator('#board .hex.picked')).toHaveCount(1);
    await expect(page.locator('#board svg.lift')).toHaveCount(1);
    await expect(page.locator(GHOST)).toHaveCount(1);
    // The ghost lifts in place: the lift's clone sits on the Queen's own cell, her box to the
    // pixel (both read in-page: `boundingBox()` measures an SVG `g` by another box); and while
    // the pointer is still over her cell no lit neighbour takes the drop.
    const PICKED = '#board .hex.picked';
    const frame = await readFrame(page, [GHOST, PICKED]);
    const [ghostBox, cellBox] = [frame[GHOST], frame[PICKED]];
    if (ghostBox === null || ghostBox === undefined || cellBox === null || cellBox === undefined)
      throw new Error('the ghost or the picked cell has no box');
    expect(Math.abs(ghostBox.x - cellBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(ghostBox.y - cellBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(ghostBox.w - cellBox.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(ghostBox.h - cellBox.h)).toBeLessThanOrEqual(1);
    await expect(page.locator('#board .hex.drop')).toHaveCount(0);
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
dragAt(DESKTOP);

test("the Spider's path reads 1-2-3 over the aimed hex, and her move hops along it", async ({
  phone,
  project,
}) => {
  test.skip(project !== 'pages', 'about the page, not the origin');
  const { page } = phone;
  await hiveStartLocal(page, pagePath(project, 'hive'), DESKTOP, [...NAMES]);
  // Both Queens down and White's Spider a leaf at (-1,0), through the hook; White to move.
  const placements = [
    ['queen', { q: 0, r: 0 }, 1],
    ['queen', { q: 1, r: 0 }, 0],
    ['spider', { q: -1, r: 0 }, 1],
    ['ant', { q: 2, r: 0 }, 0],
  ] as const;
  await placements.reduce(async (prev, [bug, to, seat]) => {
    await prev;
    await hiveAct(page, { type: 'place', bug, to });
    await expect(page.locator('#myName')).toHaveText(seated(seat));
  }, Promise.resolve());

  // The Spider picked: her destinations lit, no numeral until one is aimed at.
  const spider = page.locator('#board .hex[data-hex="-1,0"]');
  await spider.click();
  await expect(spider).toHaveClass(/picked/);
  const lit = page.locator('#board .hex.lit');
  await expect(lit.first()).toBeVisible();
  await expect(page.locator('#board text.step')).toHaveCount(0);
  const target = lit.first();
  const toKey = await target.getAttribute('data-hex');
  if (toKey === null) throw new Error('a lit hex has no key');
  // The mouse over a lit hex: 1, 2, 3 along the way to it, 3 on the hex itself.
  await target.hover();
  await expect(page.locator('#board text.step')).toHaveCount(3);
  expect((await page.locator('#board text.step').allTextContents()).sort()).toEqual([
    '1',
    '2',
    '3',
  ]);
  await expect(page.locator(`#board .hex[data-hex="${toKey}"] text.step`)).toHaveText('3');
  // Off the lit hexes, the numerals go.
  await spider.hover();
  await expect(page.locator('#board text.step')).toHaveCount(0);

  // The move: the tile lands at the destination (the board keyed on the hop), the way under it
  // cleared once it arrives, and the game agrees.
  await target.hover();
  await target.click();
  const landed = page.locator(`#board .hex[data-hex="${toKey}"]`);
  await expect(landed).toHaveClass(/\bw\b/);
  await expect(landed).toHaveAttribute('aria-label', /Spider/);
  await expect(page.locator('#board')).toHaveAttribute('data-hop', /./);
  await expect(page.locator('#board .hex.trail')).toHaveCount(0);
  await expect(page.locator('#board text.step')).toHaveCount(0);
  await expect(landed).not.toHaveClass(/hopping/);
  const after = await requireView(page);
  expect(after.game.board[toKey]).toEqual([{ side: 'white', bug: 'spider' }]);
  expect(after.game.board['-1,0']).toBeUndefined();
  expect(after.game.turn).toBe('black');
});

/**
 * The crawl (the owner: "the tiles move too fast... have them move in little jumps (with an
 * optional button to have them snap to the end result. Make this a config option)"): an Ant's
 * move carries its cell hex by hex (`hopping` while it goes, cleared when it lands), the 🐌 in the
 * topbar (a laptop's: a phone's is full, so the home's switch `#motionToggle` is the choice there)
 * is pressed by default; a tap makes it ⚡ and the next tile snaps, with no transition run; the
 * choice survives a reload (browser storage, settings.ts `hive_motion`). With HIVE_CRAWL_SHOTS set
 * to a folder, three frames of the walk are saved there.
 */
test('every tile crawls hex by hex; the ⚡ snaps them; the choice survives a reload', async ({
  phone,
  project,
}) => {
  test.skip(project !== 'pages', 'about the page, not the origin');
  const { page } = phone;
  // On a phone the topbar is full, so its button is hidden and the home's switch (on by default) is the choice.
  await hiveStartLocal(page, pagePath(project, 'hive'), PHONE, [...NAMES]);
  const motion = page.locator('#motionBtn');
  await expect(motion).toBeHidden();
  await expect(motion).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#motionToggle')).toBeChecked();
  // Both Queens down and White's Ant a leaf at (-1,0); White to move.
  const placements = [
    ['queen', { q: 0, r: 0 }, 1],
    ['queen', { q: 1, r: 0 }, 0],
    ['ant', { q: -1, r: 0 }, 1],
    ['spider', { q: 2, r: 0 }, 0],
  ] as const;
  await placements.reduce(async (prev, [bug, to, seat]) => {
    await prev;
    await hiveAct(page, { type: 'place', bug, to });
    await expect(page.locator('#myName')).toHaveText(seated(seat));
  }, Promise.resolve());
  // The Ant slides to the far side of the hive: a long way, one hop a hex.
  const far = { q: 3, r: 0 };
  const legal =
    await page.evaluate<ReadonlyArray<{ type: string; to?: { q: number; r: number } }>>(
      'window.__hive.legal()',
    );
  expect(legal.some((a) => a.type === 'move' && a.to?.q === far.q && a.to.r === far.r)).toBe(true);
  await hiveAct(page, { type: 'move', from: { q: -1, r: 0 }, to: far });
  const landed = page.locator('#board .hex[data-hex="3,0"]');
  await expect(landed).toHaveClass(/hopping/);
  const shots = process.env['HIVE_CRAWL_SHOTS'];
  if (shots !== undefined) {
    await [1, 2, 3].reduce(async (prev, i) => {
      await prev;
      await page.waitForTimeout(260);
      await page.screenshot({ path: `${shots}/ant-crawl-${String(i)}.png` });
    }, Promise.resolve());
  }
  // The transform is inline while it goes (the translate of a leg), then cleared with the class.
  await expect(landed).toHaveAttribute('style', /translate/);
  await expect(landed).not.toHaveClass(/hopping/, { timeout: 10_000 });
  await expect(landed).not.toHaveAttribute('style', /translate|transition|animation/);
  await expect(page.locator('#board .hex.trail')).toHaveCount(0);
  expect((await requireView(page)).game.board['3,0']).toEqual([{ side: 'white', bug: 'ant' }]);

  // On a laptop the button shows, 🐌 pressed; ⚡ and Black's Beetle snaps to where it lands: no class, no inline style.
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  await expect(motion).toBeVisible();
  await expect(motion).toHaveText('🐌');
  await motion.click();
  await expect(motion).toHaveAttribute('aria-pressed', 'false');
  await expect(motion).toHaveText('⚡');
  await hiveAct(page, { type: 'place', bug: 'beetle', to: { q: 1, r: 1 } });
  const snapped = page.locator('#board .hex[data-hex="1,1"]');
  await expect(snapped).toHaveClass(/\bb\b/);
  await expect(snapped).not.toHaveClass(/hopping/);
  await expect(snapped).not.toHaveAttribute('style', /./);

  // A reload: the choice is remembered on this device, on the home's switch too; the switch flips it back.
  await page.reload();
  await expect(page.locator('#homeScreen')).toBeVisible();
  await expect(motion).toHaveAttribute('aria-pressed', 'false');
  await expect(motion).toHaveText('⚡');
  await expect(page.locator('#motionToggle')).not.toBeChecked();
  await page.locator('#motionToggle').click();
  await expect(page.locator('#motionToggle')).toBeChecked();
  await expect(motion).toHaveAttribute('aria-pressed', 'true');
});

const peekAt = (viewport: Viewport): void => {
  test(`the count badge on a stack peeks at the column at ${String(viewport.width)}x${String(viewport.height)}`, async ({
    phone,
    project,
  }, testInfo) => {
    test.skip(project !== 'pages', 'about the page, not the origin');
    const { page } = phone;
    await hiveStartLocal(page, pagePath(project, 'hive'), viewport, [...NAMES]);
    // Both Queens down, White's Beetle beside hers; the Beetle climbs onto the Queen, then Black
    // places a Spider on its own side so White, who may lift the Beetle, is on show.
    const placements = [
      ['queen', { q: 0, r: 0 }, 1],
      ['queen', { q: 1, r: 0 }, 0],
      ['beetle', { q: -1, r: 0 }, 1],
      ['ant', { q: 2, r: 0 }, 0],
    ] as const;
    await placements.reduce(async (prev, [bug, to, seat]) => {
      await prev;
      await hiveAct(page, { type: 'place', bug, to });
      await expect(page.locator('#myName')).toHaveText(seated(seat));
    }, Promise.resolve());
    await expect(page.locator('#board .stack-badge')).toHaveCount(0);
    await hiveAct(page, { type: 'move', from: { q: -1, r: 0 }, to: { q: 0, r: 0 } });
    await expect(page.locator('#myName')).toHaveText(seated(1));
    await hiveAct(page, { type: 'place', bug: 'spider', to: { q: 3, r: 0 } });
    await expect(page.locator('#myName')).toHaveText(seated(0));
    const climbed = await requireView(page);
    expect(climbed.game.board['0,0']).toEqual([
      { side: 'white', bug: 'queen' },
      { side: 'white', bug: 'beetle' },
    ]);

    // The stacked cell: the Beetle on top, movable, with a badge of 2 that names the whole column.
    const cell = page.locator('#board .hex[data-hex="0,0"]');
    await expect(cell).toHaveClass(/\bstack\b/);
    await expect(cell).toHaveClass(/movable/);
    const badge = cell.locator('.stack-badge');
    await expect(badge).toHaveCount(1);
    await expect(badge.locator('text.badge')).toHaveText('2');
    await expect(badge).toHaveAttribute(
      'aria-label',
      '2 tiles: Beetle (White) over Queen Bee (White)',
    );
    await expect(badge).toHaveAttribute('aria-expanded', 'false');
    const peek = page.locator('#board .peek');
    await expect(peek).toHaveCount(0);

    // A tap on the badge opens the peek: two mini tiles, the Beetle on top, the Queen under; it is
    // no tap on the hex, so nothing is picked. A tap on another tile closes it.
    const hit = badge.locator('.hit');
    await hit.click();
    await expect(peek).toHaveCount(1);
    await expect(badge).toHaveAttribute('aria-expanded', 'true');
    await expect(peek.locator('.peek-tile')).toHaveCount(2);
    await expect(peek.locator('.peek-tile').nth(0)).toHaveClass(/\bw\b.*\btop\b|\btop\b.*\bw\b/);
    await expect(peek.locator('.peek-tile').nth(0).locator('.bug')).toHaveAttribute(
      'data-bug',
      'beetle',
    );
    await expect(peek.locator('.peek-tile').nth(1).locator('.bug')).toHaveAttribute(
      'data-bug',
      'queen',
    );
    await expect(peek.locator('.peek-tile').nth(1)).not.toHaveClass(/top/);
    await expect(page.locator('#board .hex.picked')).toHaveCount(0);
    await testInfo.attach(`peek open ${String(viewport.width)}x${String(viewport.height)}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.locator('#board .hex[data-hex="3,0"]').click();
    await expect(peek).toHaveCount(0);
    await expect(badge).toHaveAttribute('aria-expanded', 'false');

    // Escape closes it, and it stays closed while the pointer rests on the badge (the repaint put
    // a fresh badge under it: its pointerover is no reopen; the badge, focused by the tap, is
    // refocused and that opens nothing either); a tap on the badge reopens it; and the hex's own
    // face still picks the Beetle, which closes the peek.
    await hit.click();
    await expect(peek).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(peek).toHaveCount(0);
    const badgeAt = await centreOf(page, '#board .hex[data-hex="0,0"] .stack-badge .hit');
    await page.mouse.move(badgeAt.x + 1, badgeAt.y + 1);
    await page.mouse.move(badgeAt.x - 1, badgeAt.y - 1);
    await expect(peek).toHaveCount(0);
    await expect(badge).toHaveAttribute('aria-expanded', 'false');
    await hit.click();
    await expect(peek).toHaveCount(1);
    await cell.click();
    await expect(page.locator('#board .hex.picked')).toHaveCount(1);
    await expect(peek).toHaveCount(0);
    await cell.click();
    await expect(page.locator('#board .hex.picked')).toHaveCount(0);

    // The keyboard: focus alone opens nothing; Enter on the focused badge does, and the badge keeps
    // the focus through the repaint, through Escape too; focus moving on closes it. Then the mouse
    // (where there is one) hovering the badge opens it, and leaving for another hex closes it.
    await page.mouse.move(5, 5);
    await badge.focus();
    await expect(page.locator('#board .stack-badge')).toBeFocused();
    await expect(peek).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(peek).toHaveCount(1);
    await expect(page.locator('#board .stack-badge')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(peek).toHaveCount(0);
    await expect(page.locator('#board .stack-badge')).toBeFocused();
    await page.keyboard.press(' ');
    await expect(peek).toHaveCount(1);
    await page.locator('#board .hex[data-hex="3,0"]').focus();
    await expect(peek).toHaveCount(0);
    if (viewport.width >= 1024) {
      await hit.hover();
      await expect(peek).toHaveCount(1);
      await page.locator('#board .hex[data-hex="3,0"]').hover();
      await expect(peek).toHaveCount(0);
      // Dismissed under the resting mouse, it stays shut; off the badge and back, it opens again.
      await hit.hover();
      await expect(peek).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(peek).toHaveCount(0);
      await page.mouse.move(badgeAt.x + 1, badgeAt.y);
      await expect(peek).toHaveCount(0);
      await page.locator('#board .hex[data-hex="3,0"]').hover();
      await hit.hover();
      await expect(peek).toHaveCount(1);
    }
  });
};

peekAt(PHONE);
peekAt(DESKTOP);

/**
 * The hints hidden (the owner: "option to not show moves. That is, you get to click on the grid
 * where you wanna put them and then confirm. But if you confirm an illegal move it will yell at you
 * with a red toast and tell you why it's no good and then undo your move and you can try again"):
 * the 💡 off, a picked Ant lights nothing and the ring is drawn; tapped onto the Queen it sits there
 * as a proposal with Confirm under the board; Confirm: the red toast names the rule, the Ant is back
 * on its hex and still picked; onto an empty hex beside the hive and confirmed, it moves. With
 * HIVE_HINTS_SHOTS set to a folder, the proposal and the toast are saved there.
 */
test('hints hidden: a tile goes anywhere, Confirm refuses a bad move in red and plays a good one', async ({
  phone,
  project,
}) => {
  test.skip(project !== 'pages', 'about the page, not the origin');
  const { page } = phone;
  await hiveStartLocal(page, pagePath(project, 'hive'), DESKTOP, [...NAMES]);
  const hints = page.locator('#hintsBtn');
  await expect(hints).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#hintsToggle')).toBeChecked();
  await expect(page.locator('#proposalBar')).toBeHidden();
  // Both Queens down and White's Ant a leaf at (-1,0); White to move.
  const placements = [
    ['queen', { q: 0, r: 0 }, 1],
    ['queen', { q: 1, r: 0 }, 0],
    ['ant', { q: -1, r: 0 }, 1],
    ['spider', { q: 2, r: 0 }, 0],
  ] as const;
  await placements.reduce(async (prev, [bug, to, seat]) => {
    await prev;
    await hiveAct(page, { type: 'place', bug, to });
    await expect(page.locator('#myName')).toHaveText(seated(seat));
  }, Promise.resolve());

  // The hints off: the Ant picked lights nothing, and the ring around the hive is drawn to tap.
  await hints.click();
  await expect(hints).toHaveAttribute('aria-pressed', 'false');
  await expect(hints).toHaveAttribute('title', 'Hide moves');
  await expect(page.locator('#hintsToggle')).not.toBeChecked();
  const ant = page.locator('#board .hex[data-hex="-1,0"]');
  await ant.click();
  await expect(ant).toHaveClass(/picked/);
  await expect(page.locator('#board .hex.lit')).toHaveCount(0);
  await expect(page.locator('#board')).toHaveClass(/free/);
  await expect(page.locator('#board .hex')).toHaveCount(16);

  // Onto White's Queen: the Ant is drawn there as a stack, proposed, and the bar shows.
  await page.locator('#board .hex[data-hex="0,0"]').click();
  const onQueen = page.locator('#board .hex[data-hex="0,0"]');
  await expect(onQueen).toHaveClass(/proposed/);
  await expect(onQueen).toHaveClass(/stack/);
  await expect(onQueen).toHaveAttribute('aria-label', /Ant, on a stack of 2, proposed/);
  await expect(page.locator('#proposalBar')).toBeVisible();
  await expect(page.locator('#confirmBtn')).toHaveClass(/btn-go/);
  const shots = process.env['HIVE_HINTS_SHOTS'];
  if (shots !== undefined) await page.screenshot({ path: `${shots}/proposal.png` });
  // Confirm: the red toast says why, the Ant is back on its hex and still picked for another try.
  await page.locator('#confirmBtn').click();
  const toast = page.locator('#toast');
  await expect(toast).toHaveClass(/show/);
  await expect(toast).toHaveClass(/error/);
  await expect(toast).toHaveAttribute('role', 'alert');
  await expect(toast).toHaveText('Only the Beetle may climb onto another tile.');
  if (shots !== undefined) {
    // The toast fades in over 0.2 s: let it finish before the frame is saved.
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${shots}/red-toast.png` });
  }
  await expect(page.locator('#proposalBar')).toBeHidden();
  await expect(ant).toHaveClass(/picked/);
  await expect(ant).toHaveAttribute('aria-label', /Ant/);
  await expect(onQueen).not.toHaveClass(/stack|proposed/);
  const kept = await requireView(page);
  expect(kept.game.board['-1,0']).toEqual([{ side: 'white', bug: 'ant' }]);
  expect(kept.game.turn).toBe('white');
  // The toast is red for four seconds, then gone.
  await expect(toast).not.toHaveClass(/show/, { timeout: 6000 });

  // Cancel puts a proposal back and drops the pick.
  await page.locator('#board .hex[data-hex="-2,1"]').click();
  await expect(page.locator('#board .hex[data-hex="-2,1"]')).toHaveClass(/proposed/);
  await page.locator('#cancelBtn').click();
  await expect(page.locator('#proposalBar')).toBeHidden();
  await expect(page.locator('#board .hex.picked')).toHaveCount(0);
  await expect(page.locator('#board')).not.toHaveClass(/free/);

  // A legal one: the Ant slid a step round the Queen to (-1,1) and confirmed moves; Black's view is up.
  await ant.click();
  await page.locator('#board .hex[data-hex="-1,1"]').click();
  await expect(page.locator('#board .hex[data-hex="-1,1"]')).toHaveClass(/proposed/);
  await page.locator('#confirmBtn').click();
  await expect(page.locator('#myName')).toHaveText(seated(1));
  await expect(page.locator('#board .hex[data-hex="-1,1"]')).toHaveClass(/\bw\b/);
  const moved = await requireView(page);
  expect(moved.game.board['-1,1']).toEqual([{ side: 'white', bug: 'ant' }]);
  expect(moved.game.board['-1,0']).toBeUndefined();

  // The choice survives a reload, on the home's switch too.
  await page.reload();
  await expect(page.locator('#homeScreen')).toBeVisible();
  await expect(page.locator('#hintsToggle')).not.toBeChecked();
  await expect(hints).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#hintsToggle').click();
  await expect(hints).toHaveAttribute('aria-pressed', 'true');
});
