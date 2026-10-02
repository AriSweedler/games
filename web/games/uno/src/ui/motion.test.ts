// The table's motion (docs/design/uno.md §9): the durations and their reduced-motion twins; the
// last paint read off the DOM; the pure plan (a cold table, a new deal or another seat's hand
// moves nothing; the top card changed from my hand, from a seat whose count fell, or from the lit
// seat; the ids new to my hand, a gap apart); and, over the page fake, the shared kernel's clone
// (web/shared/edge/motion.ts `launchClone`) cut from the arrival, fixed over a tile-sized box
// centred where it leaves from, sent to the arrival's box, the arrival hidden until the clone
// lands or the fallback fires, nothing flying where nothing can be measured or cloned.
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { Rect } from '../../../../shared/edge/dom.ts';
import { fakeEl, fakePage, type FakeEl } from '../../../../shared/edge/page.fake.ts';
import type { Card } from '../engine/cards.ts';
import type { View } from '../engine/view.ts';
import {
  COLD,
  DECK,
  DURATIONS,
  MAX_LIVE_FLYERS,
  REDUCED_DURATIONS,
  TOP,
  centredOn,
  durationsFor,
  flightsOf,
  flyCards,
  handTile,
  markPainted,
  movesBetween,
  planFlights,
  playerOf,
  readPainted,
  seatBadge,
  totalMs,
  type Flight,
  type Painted,
} from './motion.ts';

const rect = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  width,
  height,
});
const ZERO = rect(0, 0, 0, 0);

const card = (id: string): Card => ({ id, kind: 'number', color: 'red', value: 5 });

/** Seat 0's view of a two-seat game: my hand a and b, c on the pile, my turn. */
const view = (o: Partial<View> = {}): View => ({
  seat: 0,
  names: ['Ann', 'Bob'],
  counts: [2, 7],
  hand: [card('a'), card('b')],
  top: card('c'),
  color: 'red',
  turn: 0,
  direction: 1,
  phase: 'turn',
  winner: null,
  drawn: null,
  note: '',
  drawCount: 90,
  startedAt: 1000,
  playable: ['a'],
  uno: null,
  canUno: false,
  canCallOut: false,
  ...o,
});

/** The last paint of `view()`. */
const painted = (o: Partial<Painted> = {}): Painted => ({
  startedAt: '1000',
  seat: 0,
  turn: 0,
  topId: 'c',
  handIds: ['a', 'b'],
  counts: [2, 7],
  ...o,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('durations', () => {
  test('the figures, and 1 ms glides with no gap under reduced motion', () => {
    expect(DURATIONS).toEqual({ playMs: 280, drawMs: 260, drawGapMs: 90 });
    expect(REDUCED_DURATIONS).toEqual({ playMs: 1, drawMs: 1, drawGapMs: 0 });
    expect(durationsFor(false)).toBe(DURATIONS);
    expect(durationsFor(true)).toBe(REDUCED_DURATIONS);
  });
});

describe('movesBetween', () => {
  test('a cold table, a new deal or another seat`s hand moves nothing; the same view moves nothing', () => {
    expect(movesBetween(COLD, view())).toEqual([]);
    expect(movesBetween(painted({ startedAt: '999' }), view())).toEqual([]);
    expect(movesBetween(painted({ seat: 1 }), view())).toEqual([]);
    expect(movesBetween(painted({ topId: null }), view())).toEqual([]);
    expect(movesBetween(painted(), view())).toEqual([]);
  });

  test('my play: the top card was in my hand, so it flies from my seat', () => {
    const v = view({ hand: [card('b')], top: card('a'), counts: [1, 7], turn: 1 });
    expect(movesBetween(painted(), v)).toEqual([{ kind: 'play', seat: 0, id: 'a' }]);
  });

  test('another seat`s play: the seat whose count fell, even when a +2 lit a third seat', () => {
    const prev = painted({ turn: 1, counts: [2, 7, 5], handIds: ['a', 'b'] });
    const v = view({ top: card('x'), counts: [2, 6, 5], turn: 2, names: ['Ann', 'Bob', 'Cy'] });
    expect(movesBetween(prev, v)).toEqual([{ kind: 'play', seat: 1, id: 'x' }]);
    expect(playerOf(prev, v)).toBe(1);
  });

  test('the lit seat when no count fell (a frame with the pile alone changed); none when that was me', () => {
    const v = view({ top: card('x') });
    expect(playerOf(painted({ turn: 1 }), v)).toBe(1);
    expect(playerOf(painted({ turn: 0 }), v)).toBeNull();
    expect(playerOf(painted({ turn: null }), v)).toBeNull();
    expect(movesBetween(painted({ turn: 0 }), v)).toEqual([]);
  });

  test('a draw: the ids my hand has that it had not, in hand order; a penalty brings several', () => {
    const one = view({ hand: [card('a'), card('b'), card('d')], phase: 'drawn' });
    expect(movesBetween(painted(), one)).toEqual([{ kind: 'draw', ids: ['d'] }]);
    const two = view({ hand: [card('a'), card('b'), card('d'), card('e')] });
    expect(movesBetween(painted(), two)).toEqual([{ kind: 'draw', ids: ['d', 'e'] }]);
  });

  test('a catch-up frame: the play first, then the draws', () => {
    const v = view({ top: card('x'), counts: [2, 6], hand: [card('a'), card('b'), card('d')] });
    expect(movesBetween(painted({ turn: 1 }), v)).toEqual([
      { kind: 'play', seat: 1, id: 'x' },
      { kind: 'draw', ids: ['d'] },
    ]);
  });
});

describe('flightsOf', () => {
  const at = rect(10, 500, 60, 87);

  test('my play leaves from the box measured for it; none where nothing stood there', () => {
    const f = flightsOf([{ kind: 'play', seat: 0, id: 'a' }], 0, DURATIONS, () => at);
    expect(f).toEqual([{ from: handTile('a'), to: TOP, ms: 280, delayMs: 0, fromRect: at }]);
    expect(flightsOf([{ kind: 'play', seat: 0, id: 'a' }], 0, DURATIONS, () => null)).toEqual([]);
  });

  test('another seat`s play leaves from its badge, unmeasured', () => {
    const f = flightsOf([{ kind: 'play', seat: 2, id: 'x' }], 0, DURATIONS, () => at);
    expect(f).toEqual([{ from: seatBadge(2), to: TOP, ms: 280, delayMs: 0 }]);
    expect(seatBadge(2)).toEqual({ id: 'seats', within: '.seat[data-seat="2"]' });
  });

  test('the draws leave the draw pile a gap apart for their tiles; reduced motion lands them at once', () => {
    const f = flightsOf([{ kind: 'draw', ids: ['d', 'e', 'f'] }], 0, DURATIONS, () => null);
    expect(f.map((x) => x.from)).toEqual([DECK, DECK, DECK]);
    expect(f.map((x) => x.to)).toEqual([handTile('d'), handTile('e'), handTile('f')]);
    expect(f.map((x) => x.delayMs)).toEqual([0, 90, 180]);
    expect(f.every((x) => x.ms === 260 && x.fromRect === undefined)).toBe(true);
    expect(totalMs(f)).toBe(440);
    expect(
      totalMs(flightsOf([{ kind: 'draw', ids: ['d', 'e'] }], 0, REDUCED_DURATIONS, () => null)),
    ).toBe(1);
    expect(totalMs([])).toBe(0);
  });

  test('the targets', () => {
    expect(TOP).toEqual({ id: 'topCard', within: '.tile' });
    expect(DECK).toEqual({ id: 'tableScreen', within: '.draw-pile' });
    expect(handTile('q')).toEqual({ id: 'hand', within: '.tile[data-id="q"]' });
  });
});

describe('centredOn', () => {
  test('a box of the shape`s size centred on the other', () => {
    expect(centredOn(rect(0, 0, 60, 90), rect(100, 100, 120, 30))).toEqual(rect(130, 70, 60, 90));
  });
});

// ---- the DOM step over the page fake ----------------------------------------------------------------------

/** An element that reports `at` and, unless told not to, clones into `clone`. */
const piece = (
  id: string,
  options: Readonly<{ classes?: ReadonlyArray<string>; attrs?: Readonly<Record<string, string>> }>,
  at: Rect,
  clone: FakeEl | null,
): FakeEl => {
  const el = fakeEl(id, options);
  Object.assign(el.el, {
    getBoundingClientRect: () => at,
    ...(clone === null ? {} : { cloneNode: () => clone.el }),
  });
  return el;
};

type Options = Readonly<{ topAt?: Rect; badgeAt?: Rect; noTop?: boolean; cloneable?: boolean }>;

/**
 * A painted table: `#tableScreen` marked with the deal and the viewer, two badges (seat 1 lit),
 * the pile's top `c`, my tiles `a` (playable, at `handAt`) and `b`.
 */
const table = (o: Options = {}) => {
  const clone = fakeEl('clone', { classes: ['tile', 'top'] });
  const top = piece(
    'topTile',
    { classes: ['tile', 'top'], attrs: { 'data-id': 'c' } },
    o.topAt ?? rect(300, 200, 60, 87),
    o.cloneable === false ? null : clone,
  );
  const topCard = fakeEl('topCard', { queries: { '.tile': o.noTop === true ? [] : [top] } });
  const deck = piece('deck', { classes: ['draw-pile'] }, rect(200, 200, 60, 87), null);
  const screen = fakeEl('tableScreen', {
    attrs: { 'data-started': '1000', 'data-viewer': '0' },
    queries: { '.draw-pile': [deck] },
  });
  const badge0 = fakeEl('b0', {
    classes: ['seat', 'mine'],
    attrs: { 'data-seat': '0', 'data-count': '2' },
  });
  const badge1 = piece(
    'b1',
    { classes: ['seat', 'current'], attrs: { 'data-seat': '1', 'data-count': '7' } },
    o.badgeAt ?? rect(100, 20, 120, 30),
    null,
  );
  const seats = fakeEl('seats', {
    queries: {
      '.seat': [badge0, badge1],
      '.seat.current': [badge1],
      '.seat[data-seat="1"]': [badge1],
    },
  });
  const tileA = piece(
    'tileA',
    { classes: ['tile', 'playable'], attrs: { 'data-id': 'a' } },
    rect(40, 600, 60, 87),
    clone,
  );
  const tileB = fakeEl('tileB', { classes: ['tile', 'dim'], attrs: { 'data-id': 'b' } });
  const hand = fakeEl('hand', {
    queries: {
      '.tile': [tileA, tileB],
      '.tile[data-id="a"]': [tileA],
      '.tile[data-id="b"]': [tileB],
    },
  });
  const page = fakePage([screen, seats, topCard, hand]);
  return { page, clone, top, topCard, deck, screen, badge1, tileA, hand };
};

describe('readPainted and markPainted', () => {
  test('the marks, the lit seat, the top, my tiles and the counts off the DOM; COLD where the table is not built', () => {
    const t = table();
    expect(readPainted(t.page.doc)).toEqual({
      startedAt: '1000',
      seat: 0,
      turn: 1,
      topId: 'c',
      handIds: ['a', 'b'],
      counts: [2, 7],
    });
    expect(readPainted(table({ noTop: true }).page.doc).topId).toBeNull();
    expect(readPainted(fakePage([fakeEl('tableScreen')]).doc)).toEqual(COLD);
    markPainted(t.page.doc, view({ startedAt: 2000, seat: 1 }));
    expect(t.screen.attr('data-started')).toBe('2000');
    expect(t.screen.attr('data-viewer')).toBe('1');
    expect(readPainted(t.page.doc).seat).toBe(1);
  });
});

describe('flyCards', () => {
  test('my play: the top`s clone leaves from my slot measured before the repaint, lands on the top, which hides (`data-flying`) until it does', () => {
    const t = table();
    const flight: Flight = {
      from: handTile('a'),
      to: TOP,
      ms: 280,
      delayMs: 0,
      fromRect: rect(40, 600, 60, 87),
    };
    expect(flyCards(t.page.doc, [flight])).toBe(1);
    expect(t.top.hasClass('arriving')).toBe(true);
    expect(t.top.attr('data-flying')).toBe('');
    expect(t.clone.hasClass('flyer')).toBe(true);
    expect(t.clone.style('left')).toBe('40px');
    expect(t.clone.style('top')).toBe('600px');
    expect(t.clone.style('--tile-w')).toBe('60px');
    expect(t.clone.style('--fly-ms')).toBe('280ms');
    expect(t.clone.style('transform')).toBe('translate(260px, -400px)');
    t.clone.fire('transitionend');
    expect(t.top.hasClass('arriving')).toBe(false);
    expect(t.top.attr('data-flying')).toBeNull();
    expect(t.clone.removed()).toBe(true);
    // A measured box of no size flies nothing: the repaint alone placed the card.
    expect(flyCards(t.page.doc, [{ ...flight, fromRect: ZERO }])).toBe(0);
  });

  test('another seat`s play: a tile-sized box centred on its badge, measured after the repaint; the state classes stay behind', () => {
    const t = table({ badgeAt: rect(100, 20, 120, 30) });
    expect(flyCards(t.page.doc, [{ from: seatBadge(1), to: TOP, ms: 280, delayMs: 0 }])).toBe(1);
    // The badge's centre (160, 35) less half a tile (30, 43.5).
    expect(t.clone.style('left')).toBe('130px');
    expect(t.clone.style('top')).toBe('-8.5px');
    expect(t.clone.style('width')).toBe('60px');
    expect(t.clone.style('height')).toBe('87px');
    expect(t.clone.style('transform')).toBe('translate(170px, 208.5px)');
    expect(t.clone.hasClass('playable')).toBe(false);
    expect(t.clone.hasClass('dim')).toBe(false);
  });

  test('a draw: from the draw pile to my tile, a delay written to both delays, the fallback clearing what the end would', () => {
    vi.useFakeTimers();
    const t = table();
    expect(flyCards(t.page.doc, [{ from: DECK, to: handTile('a'), ms: 260, delayMs: 90 }])).toBe(1);
    expect(t.tileA.hasClass('arriving')).toBe(true);
    expect(t.clone.style('transition-delay')).toBe('90ms');
    expect(t.clone.style('animation-delay')).toBe('90ms');
    expect(t.clone.style('transform')).toBe('translate(-160px, 400px)');
    vi.advanceTimersByTime(260 + 90 + 60);
    expect(t.tileA.hasClass('arriving')).toBe(false);
    expect(t.clone.removed()).toBe(true);
  });

  test('nothing flies for a missing end, an unmeasurable one or a tile that cannot clone; no flights is 0', () => {
    expect(
      flyCards(table({ noTop: true }).page.doc, [{ from: DECK, to: TOP, ms: 1, delayMs: 0 }]),
    ).toBe(0);
    expect(
      flyCards(table({ topAt: ZERO }).page.doc, [{ from: DECK, to: TOP, ms: 1, delayMs: 0 }]),
    ).toBe(0);
    expect(
      flyCards(table({ cloneable: false }).page.doc, [{ from: DECK, to: TOP, ms: 1, delayMs: 0 }]),
    ).toBe(0);
    expect(flyCards(table().page.doc, [{ from: seatBadge(3), to: TOP, ms: 1, delayMs: 0 }])).toBe(
      0,
    );
    expect(flyCards(table().page.doc, [])).toBe(0);
  });

  test('a burst of stale clones past MAX_LIVE_FLYERS is culled before new ones launch', () => {
    const stale = Array.from({ length: MAX_LIVE_FLYERS + 1 }, (_, i) =>
      fakeEl(`stale${String(i)}`, { classes: ['flyer'] }),
    );
    const t = table();
    const body = fakeEl('body', { queries: { '.flyer': stale } });
    const page = fakePage([t.screen, t.topCard, t.hand], body);
    expect(flyCards(page.doc, [{ from: DECK, to: TOP, ms: 1, delayMs: 0 }])).toBe(1);
    expect(stale.every((s) => s.removed())).toBe(true);
  });
});

describe('planFlights', () => {
  test('reads the last paint, measures my played tile while it stands, marks the table, and plans the flight', () => {
    const t = table();
    const v = view({ hand: [card('b')], top: card('a'), counts: [1, 7], turn: 1 });
    expect(planFlights(t.page.doc, v)).toEqual([
      { from: handTile('a'), to: TOP, ms: 280, delayMs: 0, fromRect: rect(40, 600, 60, 87) },
    ]);
    expect(t.screen.attr('data-started')).toBe('1000');
    expect(t.screen.attr('data-viewer')).toBe('0');
    // The same view again: nothing to plan.
    expect(planFlights(t.page.doc, view())).toEqual([]);
    // My tile that the fake cannot measure: the play is placed by the repaint alone.
    const prev = painted();
    expect(movesBetween(prev, v)).toHaveLength(1);
    expect(
      planFlights(table({}).page.doc, view({ hand: [card('a')], top: card('b'), counts: [1, 7] })),
    ).toEqual([]);
  });

  test('a new deal marks the table and plans nothing', () => {
    const t = table();
    expect(
      planFlights(t.page.doc, view({ startedAt: 2000, hand: [card('q')], top: card('z') })),
    ).toEqual([]);
    expect(t.screen.attr('data-started')).toBe('2000');
  });
});
