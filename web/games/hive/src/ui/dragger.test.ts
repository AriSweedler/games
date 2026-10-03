// The drag's wiring over the page fake (web/shared/edge/page.fake.ts): the pointer events reach the
// reducer as intents in the right order, a tray tile's ghost gets its place and follows the pointer,
// a board tile's ghost is the lift's clone, the lit hex nearest the pointer goes out once per change
// and snaps from inside SNAP of a hex's width, a release over a hex ends at once while a release
// over none glides back first, and a press that never moves stays a tap.
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { Rect } from '../../../../shared/edge/dom.ts';
import { fakeEl, fakePage, fakeTarget, type FakeEl } from '../../../../shared/edge/page.fake.ts';
import { DRAG_THRESHOLD, LAND_MS, SNAP, bindDrag, nearestLit, type DragIntent } from './dragger.ts';

const rect = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  width,
  height,
});

type Table = Readonly<{
  tile: FakeEl;
  tileGhost: FakeEl;
  cell: FakeEl;
  lift: FakeEl;
  liftGhost: FakeEl;
  board: FakeEl;
  white: FakeEl;
  intents: DragIntent[];
}>;

/**
 * White's playable Ant in the tray at (100, 600), 50 by 58; my movable Queen at the origin, drawn at
 * (200, 300), 60 by 70, with the lift the paint lays over her; two lit hexes, east and south-east.
 */
const table = (): Table => {
  const tileGhost = fakeEl('tileGhost', { classes: ['hand-tile', 'w', 'playable', 'dragging'] });
  const tile = fakeEl('ant', {
    classes: ['hand-tile', 'w', 'playable'],
    attrs: { 'data-bug': 'ant' },
  });
  Object.assign(tile.el, {
    getBoundingClientRect: () => rect(100, 600, 50, 58),
    cloneNode: () => tileGhost.el,
  });
  const cell = fakeEl('cell-origin', {
    classes: ['hex', 'w', 'movable'],
    attrs: { 'data-hex': '0,0' },
  });
  const liftGhost = fakeEl('liftGhost', { classes: ['hex', 'lift', 'w'] });
  const lift = fakeEl('lift', { classes: ['hex', 'lift', 'w'] });
  Object.assign(lift.el, {
    getBoundingClientRect: () => rect(200, 300, 60, 70),
    cloneNode: () => liftGhost.el,
  });
  const east = fakeEl('cell-east', {
    classes: ['hex', 'empty', 'lit'],
    attrs: { 'data-hex': '1,0' },
  });
  Object.assign(east.el, { getBoundingClientRect: () => rect(260, 300, 60, 70) });
  const south = fakeEl('cell-south', {
    classes: ['hex', 'empty', 'lit'],
    attrs: { 'data-hex': '0,1' },
  });
  Object.assign(south.el, { getBoundingClientRect: () => rect(230, 352, 60, 70) });
  const board = fakeEl('board', { queries: { '.hex.lit': [east, south], 'svg.lift': [lift] } });
  const white = fakeEl('whiteHand', { queries: { '.hand-tile[data-bug="ant"]': [tile] } });
  const black = fakeEl('blackHand');
  const page = fakePage([board, white, black]);
  const intents: DragIntent[] = [];
  bindDrag(page.doc, (i) => {
    intents.push(i);
  });
  return { tile, tileGhost, cell, lift, liftGhost, board, white, intents };
};

/** A pointer event's init: where it is and what `closest` finds under it. */
const at = (closest: Readonly<Record<string, FakeEl>>, x: number, y: number) => ({
  clientX: x,
  clientY: y,
  pointerId: 1,
  target: fakeTarget({ closest }),
});

afterEach(() => {
  vi.useRealTimers();
});

describe('nearestLit', () => {
  const targets = [
    { key: 'east', rect: rect(260, 300, 60, 70) },
    { key: 'south', rect: rect(230, 352, 60, 70) },
  ];
  test('the nearest centre within SNAP of the width takes it; farther is none; a rect with no size is never near', () => {
    expect(nearestLit(targets, { x: 290, y: 335 })).toBe('east');
    expect(nearestLit(targets, { x: 262, y: 386 })).toBe('south');
    // Between the two, nearer the south one's centre (260, 387) than the east one's (290, 335).
    expect(nearestLit(targets, { x: 272, y: 365 })).toBe('south');
    // Just inside and just outside the snap radius, due west of the east hex.
    expect(nearestLit(targets, { x: 290 - 60 * SNAP, y: 300 })).toBeNull();
    expect(nearestLit(targets, { x: 290 - 60 * SNAP + 0.5, y: 335 })).toBe('east');
    expect(nearestLit(targets, { x: 10, y: 10 })).toBeNull();
    expect(nearestLit([{ key: 'fake', rect: rect(0, 0, 0, 0) }], { x: 0, y: 0 })).toBeNull();
    expect(nearestLit([], { x: 290, y: 335 })).toBeNull();
  });

  test('the home the tile left: nothing takes the drop while the pointer is nearer its centre than the nearest lit hex; a home with no size is no home', () => {
    // The cell west of the east hex, its centre (230, 335) one width from the east one's (290, 335).
    const home = rect(200, 300, 60, 70);
    // A tenth of a hex east of the home's centre: inside the east hex's snap, nearer home.
    expect(nearestLit(targets, { x: 245, y: 335 })).toBe('east');
    expect(nearestLit(targets, { x: 245, y: 335 }, home)).toBeNull();
    // Past the midpoint: the east hex is nearer.
    expect(nearestLit(targets, { x: 265, y: 335 }, home)).toBe('east');
    expect(nearestLit(targets, { x: 290, y: 335 }, home)).toBe('east');
    // The south hex from the home: the same rule on the diagonal.
    expect(nearestLit(targets, { x: 240, y: 352 }, home)).toBeNull();
    expect(nearestLit(targets, { x: 255, y: 378 }, home)).toBe('south');
    // A home never measured (a fake's) holds nothing back.
    expect(nearestLit(targets, { x: 245, y: 335 }, rect(0, 0, 0, 0))).toBe('east');
  });
});

describe('bindDrag', () => {
  test('a press that moves less than the threshold is a tap; a press on a tile that cannot be lifted is nothing', () => {
    const t = table();
    t.white.fire('pointerdown', at({ '.hand-tile.playable': t.tile }, 125, 629));
    t.white.fire('pointermove', at({ '.hand-tile.playable': t.tile }, 128, 631));
    t.white.fire('pointerup', at({ '.hand-tile.playable': t.tile }, 128, 631));
    expect(t.intents).toEqual([]);
    // A spent or disabled tile: `closest` finds no playable one.
    t.white.fire('pointerdown', at({}, 125, 629));
    t.white.fire('pointermove', at({}, 300, 629));
    t.white.fire('pointerup', at({}, 300, 629));
    // A board cell that is not movable.
    t.board.fire('pointerdown', at({}, 230, 335));
    t.board.fire('pointermove', at({}, 330, 335));
    t.board.fire('pointerup', at({}, 330, 335));
    expect(t.intents).toEqual([]);
    expect(t.tileGhost.hasClass('drag-ghost')).toBe(false);
  });

  test('a tray tile: past the threshold the drag begins, the ghost follows, the lit hex nearest the pointer goes out once per change, a release off every hex glides back', () => {
    const t = table();
    const on = { '.hand-tile.playable': t.tile };
    t.white.fire('pointerdown', at(on, 125, 629));
    t.white.fire('pointermove', at(on, 125 + DRAG_THRESHOLD, 629));
    expect(t.intents).toEqual([{ type: 'drag/start', picked: { kind: 'hand', bug: 'ant' } }]);
    // The ghost: the tile's clone, fixed at its box, its own width as `--tile-w`, the press marks off.
    expect(t.tileGhost.hasClass('drag-ghost')).toBe(true);
    expect(t.tileGhost.hasClass('playable')).toBe(false);
    expect(t.tileGhost.hasClass('dragging')).toBe(false);
    expect(t.tileGhost.hasClass('hand-tile')).toBe(true);
    expect([
      t.tileGhost.style('left'),
      t.tileGhost.style('top'),
      t.tileGhost.style('width'),
      t.tileGhost.style('height'),
      t.tileGhost.style('--tile-w'),
    ]).toEqual(['100px', '600px', '50px', '58px', '50px']);
    expect(t.tileGhost.style('transform')).toBe('translate(0px, 0px)');
    // Onto the east hex's centre: one `drag/over`; a little way off, still nearest it: silent.
    t.white.fire('pointermove', at(on, 290, 335));
    expect(t.tileGhost.style('transform')).toBe('translate(157px, -294px)');
    expect(t.intents.at(-1)).toEqual({ type: 'drag/over', hex: { q: 1, r: 0 } });
    t.white.fire('pointermove', at(on, 300, 345));
    expect(t.intents).toHaveLength(2);
    // Beside the south hex, outside its box but inside the snap: it takes over. Then over nothing.
    t.white.fire('pointermove', at(on, 240, 400));
    expect(t.intents.at(-1)).toEqual({ type: 'drag/over', hex: { q: 0, r: 1 } });
    t.white.fire('pointermove', at(on, 10, 10));
    expect(t.intents.at(-1)).toEqual({ type: 'drag/over', hex: null });
    // Released over nothing: the ghost glides back to the tray; the end waits for the transition.
    t.white.fire('pointerup', at(on, 10, 10));
    expect(t.tileGhost.hasClass('landing')).toBe(true);
    expect(t.tileGhost.style('transform')).toBe('translate(0px, 0px)');
    expect(t.intents).toHaveLength(4);
    t.tileGhost.fire('transitionend');
    expect(t.intents.at(-1)).toEqual({ type: 'drag/end' });
    expect(t.tileGhost.removed()).toBe(true);
    expect(t.intents).toHaveLength(5);
  });

  test('a board tile: the ghost is the lift the paint laid over it, less its own class; a release over a hex ends at once', () => {
    const t = table();
    const on = { '.hex.movable': t.cell };
    t.board.fire('pointerdown', at(on, 230, 335));
    // Westward first: from the press, the south hex's centre is one pixel inside the snap.
    t.board.fire('pointermove', at(on, 230 - DRAG_THRESHOLD, 335));
    expect(t.intents).toEqual([
      { type: 'drag/start', picked: { kind: 'hex', hex: { q: 0, r: 0 } } },
    ]);
    expect(t.liftGhost.hasClass('drag-ghost')).toBe(true);
    expect(t.liftGhost.hasClass('lift')).toBe(false);
    expect(t.liftGhost.hasClass('hex')).toBe(true);
    expect(t.liftGhost.hasClass('w')).toBe(true);
    expect([
      t.liftGhost.style('left'),
      t.liftGhost.style('top'),
      t.liftGhost.style('width'),
    ]).toEqual(['200px', '300px', '60px']);
    // Back east, still over the Queen's own cell though inside the east hex's snap: no drop yet
    // (the lift's box is the home); past the midpoint between the two centres the east hex takes it.
    t.board.fire('pointermove', at(on, 245, 335));
    expect(t.intents).toHaveLength(1);
    t.board.fire('pointermove', at(on, 265, 335));
    expect(t.intents.at(-1)).toEqual({ type: 'drag/over', hex: { q: 1, r: 0 } });
    t.board.fire('pointermove', at(on, 290, 335));
    expect(t.intents).toHaveLength(2);
    expect(t.intents.at(-1)).toEqual({ type: 'drag/over', hex: { q: 1, r: 0 } });
    t.board.fire('pointerup', at(on, 290, 335));
    expect(t.intents.at(-1)).toEqual({ type: 'drag/end' });
    expect(t.liftGhost.hasClass('landing')).toBe(false);
    expect(t.liftGhost.removed()).toBe(true);
    // The session is over: a new press starts afresh.
    t.board.fire('pointerdown', at(on, 230, 335));
    t.board.fire('pointermove', at(on, 130, 335));
    expect(t.intents.at(-1)).toEqual({
      type: 'drag/start',
      picked: { kind: 'hex', hex: { q: 0, r: 0 } },
    });
  });

  test('a glide that never ends: the fallback timer lands it; a cancel is a release', () => {
    vi.useFakeTimers();
    const t = table();
    const on = { '.hand-tile.playable': t.tile };
    t.white.fire('pointerdown', at(on, 125, 629));
    t.white.fire('pointermove', at(on, 125, 500));
    t.white.fire('pointercancel', at(on, 125, 500));
    // Over nothing from the start: `over` never changed, so no `drag/over` went out.
    expect(t.intents).toEqual([{ type: 'drag/start', picked: { kind: 'hand', bug: 'ant' } }]);
    vi.advanceTimersByTime(LAND_MS + 60);
    expect(t.intents.at(-1)).toEqual({ type: 'drag/end' });
  });
});
