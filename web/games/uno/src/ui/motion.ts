// The table's motion (docs/design/uno.md §9; the owner, 2026-10-02: "cards getting played to the
// center and drawing to your hand should be animated"): a layer over the keyed paint, in briscola's
// shape (web/games/briscola/src/ui/motion.ts). The painter reads what the last paint left on the
// table (`readPainted`: the deal, the viewer, the turn, the top card, my hand's ids and every
// seat's count, all off the DOM, which is the memory the way `data-key` is), plans the flights the
// change to the new view asks for BEFORE the table repaints (`planFlights`: my played tile's slot
// goes with the repaint, so its box is measured first), repaints, then runs them (`flyCards`). The
// plan is pure (`movesBetween`, `flightsOf`): the top card changed and the card was in my hand, so
// it flies from its slot to the pile; the top card changed and a seat's count fell, so it flies
// from that seat's badge to the pile; ids my hand has that it had not, so each flies from the draw
// pile to its tile, a gap apart. A cold paint, a new deal (`startedAt`) or the phone changing hands
// (the viewer's seat) flies nothing, and a repaint of the same view has no diff, so a re-sent
// frame, a toast or a sheet launches nothing. Each flight is the shared kernel's `launchClone`
// (web/shared/edge/motion.ts): the ARRIVAL's clone (the pile's new top, my new tile), fixed over a
// tile-sized box centred where it leaves from, sent to its own box by one translate, removed when
// the transition ends or the fallback fires; the arrival hides under `arriving` until it lands.
// Nothing measurable (the page fake, a hidden tab) means the repaint alone. The flight's length
// goes on the clone as `--fly-ms` (theme.css `.flyer` reads it; the clone sits on the body), and
// `prefers-reduced-motion` is the shared `reducedMotion` read: `durationsFor(true)` makes every
// glide 1 ms with no gap, and the theme's media query agrees. Only the DOM edge is reached
// (dom.ts); never ui/state.ts.
import {
  addClass,
  byId,
  dataOf,
  queryAllIn,
  queryIn,
  rectOf,
  removeClass,
  removeElement,
  setAttr,
  setStyle,
  type Element,
  type PageLike,
  type Rect,
} from '../../../../shared/edge/dom.ts';
import { launchClone, reducedMotion } from '../../../../shared/edge/motion.ts';
import type { View } from '../engine/view.ts';

// ---- durations ----------------------------------------------------------------------------------------

export type Durations = Readonly<{
  /** A card's glide from a hand or a badge to the pile. */
  playMs: number;
  /** A card's glide from the draw pile to my hand. */
  drawMs: number;
  /** Between two draws landing in one paint (a +2, a +4). */
  drawGapMs: number;
}>;

export const DURATIONS: Durations = { playMs: 280, drawMs: 260, drawGapMs: 90 };
/** Under `prefers-reduced-motion`: every glide 1 ms, no gap, so the card is simply there. */
export const REDUCED_DURATIONS: Durations = { playMs: 1, drawMs: 1, drawGapMs: 0 };

export const durationsFor = (reduced: boolean): Durations =>
  reduced ? REDUCED_DURATIONS : DURATIONS;

// ---- what the last paint left ---------------------------------------------------------------------------

/** The table as the last paint left it, read off the DOM before the next one. */
export type Painted = Readonly<{
  /** `#tableScreen[data-started]`: the deal last painted, or null on a cold table. */
  startedAt: string | null;
  /** `#tableScreen[data-viewer]`: the seat whose hand was painted, or null. */
  seat: number | null;
  /** The lit seat (`.seat.current`), or null. */
  turn: number | null;
  /** The pile's top tile, or null. */
  topId: string | null;
  /** My hand's tiles, in order. */
  handIds: ReadonlyArray<string>;
  /** Every seat's card count (`.seat[data-count]`), by seat. */
  counts: ReadonlyArray<number>;
}>;

/** A table nothing has been painted on. */
export const COLD: Painted = {
  startedAt: null,
  seat: null,
  turn: null,
  topId: null,
  handIds: [],
  counts: [],
};

const intOf = (s: string | null): number | null => {
  if (s === null || s === '') return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
};

/** `readPainted`'s DOM read: the marks on `#tableScreen`, the seats' badges, the pile's top, my tiles. */
export const readPainted = (doc: PageLike): Painted => {
  const screen = byId(doc, 'tableScreen');
  const seats = byId(doc, 'seats');
  const hand = byId(doc, 'hand');
  const top = byId(doc, 'topCard');
  if (screen === null || seats === null || hand === null || top === null) return COLD;
  const badges = queryAllIn(seats, '.seat');
  const current = queryIn(seats, '.seat.current');
  return {
    startedAt: dataOf(screen, 'started'),
    seat: intOf(dataOf(screen, 'viewer')),
    turn: current === null ? null : intOf(dataOf(current, 'seat')),
    topId: dataOf(queryIn(top, '.tile') ?? top, 'id'),
    handIds: queryAllIn(hand, '.tile').map((t) => dataOf(t, 'id') ?? ''),
    counts: badges.map((b) => intOf(dataOf(b, 'count')) ?? 0),
  };
};

/** The marks the next `readPainted` reads: the deal and the viewer, on `#tableScreen`. */
export const markPainted = (doc: PageLike, v: View): void => {
  const screen = byId(doc, 'tableScreen');
  if (screen === null) return;
  setAttr(screen, 'data-started', String(v.startedAt));
  setAttr(screen, 'data-viewer', String(v.seat));
};

// ---- the pure plan ----------------------------------------------------------------------------------------

/** One thing that moved between two paints. */
export type Move =
  /** A card reached the pile: from my hand (`seat` mine) or from `seat`'s badge. */
  | Readonly<{ kind: 'play'; seat: number; id: string }>
  /** Cards reached my hand from the draw pile, in hand order. */
  | Readonly<{ kind: 'draw'; ids: ReadonlyArray<string> }>;

/**
 * The seat whose card the pile's new top is: mine when my hand held it, else the seat other than
 * mine whose count fell (a +2 moves the turn on, so the lit seat is not the player), else the seat
 * that was lit; null when none of those says (a frame that changed the pile alone).
 */
export const playerOf = (prev: Painted, v: View): number | null => {
  if (prev.handIds.includes(v.top.id)) return v.seat;
  const fell = v.counts.findIndex((n, seat) => {
    const was = prev.counts[seat];
    return seat !== v.seat && was !== undefined && n < was;
  });
  if (fell !== -1) return fell;
  return prev.turn !== null && prev.turn !== v.seat ? prev.turn : null;
};

/**
 * What changed from the last paint to `v`: nothing on a cold table, a new deal or another seat's
 * hand (the phone changed hands); else the play that changed the top card, and the draws that
 * brought my hand ids it had not. A repaint of the same view moves nothing.
 */
export const movesBetween = (prev: Painted, v: View): ReadonlyArray<Move> => {
  if (prev.startedAt === null || prev.startedAt !== String(v.startedAt)) return [];
  if (prev.seat !== v.seat || prev.topId === null) return [];
  const seat = v.top.id === prev.topId ? null : playerOf(prev, v);
  const plays: ReadonlyArray<Move> = seat === null ? [] : [{ kind: 'play', seat, id: v.top.id }];
  const drawn = v.hand.map((c) => c.id).filter((id) => !prev.handIds.includes(id));
  const draws: ReadonlyArray<Move> = drawn.length === 0 ? [] : [{ kind: 'draw', ids: drawn }];
  return [...plays, ...draws];
};

/** An element by id, or one inside it by selector. */
export type Target = Readonly<{ id: string; within?: string }>;

export type Flight = Readonly<{
  /** Where the card leaves from, measured after the repaint unless `fromRect` says otherwise. */
  from: Target;
  /** The arrival: its clone flies, and it hides under `arriving` until the clone lands. */
  to: Target;
  /** The glide's length. */
  ms: number;
  /** How long after the repaint it leaves. */
  delayMs: number;
  /** The source's box measured BEFORE the repaint that removed it (my played tile's slot). */
  fromRect?: Rect;
}>;

/** The pile's top tile. */
export const TOP: Target = { id: 'topCard', within: '.tile' };
/** The draw pile. */
export const DECK: Target = { id: 'tableScreen', within: '.draw-pile' };
/** A tile of my hand by id. */
export const handTile = (id: string): Target => ({ id: 'hand', within: `.tile[data-id="${id}"]` });
/** A seat's badge in the seats strip. */
export const seatBadge = (seat: number): Target => ({
  id: 'seats',
  within: `.seat[data-seat="${String(seat)}"]`,
});

/**
 * The flights for `moves`: my play from the box `myTile` measured for it (none when nothing
 * measurable stood there), another seat's from its badge, each draw from the draw pile to its
 * tile, `drawGapMs` apart.
 */
export const flightsOf = (
  moves: ReadonlyArray<Move>,
  me: number,
  d: Durations,
  myTile: (id: string) => Rect | null,
): ReadonlyArray<Flight> =>
  moves.flatMap((m): ReadonlyArray<Flight> => {
    switch (m.kind) {
      case 'play': {
        if (m.seat !== me) return [{ from: seatBadge(m.seat), to: TOP, ms: d.playMs, delayMs: 0 }];
        const fromRect = myTile(m.id);
        return fromRect === null
          ? []
          : [{ from: handTile(m.id), to: TOP, ms: d.playMs, delayMs: 0, fromRect }];
      }
      case 'draw':
        return m.ids.map((id, k) => ({
          from: DECK,
          to: handTile(id),
          ms: d.drawMs,
          delayMs: k * d.drawGapMs,
        }));
    }
  });

/** When the last flight has landed, in ms after the repaint; 0 for none. */
export const totalMs = (flights: ReadonlyArray<Flight>): number =>
  flights.reduce((max, f) => Math.max(max, f.delayMs + f.ms), 0);

// ---- the DOM step -------------------------------------------------------------------------------------

/**
 * More clones than this in the air is a scripted burst (a policy playing through the hook, a
 * reconnect replaying frames), not play: they are culled before new ones launch.
 */
export const MAX_LIVE_FLYERS = 12;
/** The source's state classes, which must not fly with its clone. */
const STRIP: ReadonlyArray<string> = ['playable', 'dim', 'arriving'];

const measurable = (r: Rect): boolean => r.width > 0 || r.height > 0;

const find = (doc: PageLike, t: Target): Element | null => {
  const root = byId(doc, t.id);
  return root === null || t.within === undefined ? root : queryIn(root, t.within);
};

/** A box of `shape`'s size centred on `at`: the clone keeps the tile's own size wherever it leaves from. */
export const centredOn = (shape: Rect, at: Rect): Rect => ({
  left: at.left + at.width / 2 - shape.width / 2,
  top: at.top + at.height / 2 - shape.height / 2,
  width: shape.width,
  height: shape.height,
});

/**
 * One flight: measure both ends, launch the arrival's clone from a tile-sized box centred on the
 * source to the arrival's own box (`launchClone`: fixed where it starts, sized as `--tile-w`, laid
 * out, sent by one translate, removed when the transition ends or the fallback fires), its length
 * on it as `--fly-ms`, the arrival hidden until it lands. False when an end is missing,
 * unmeasurable or the tile cannot be cloned: the repaint alone has placed it.
 */
const launch = (doc: PageLike, f: Flight): boolean => {
  const target = find(doc, f.to);
  if (target === null) return false;
  const source = f.fromRect === undefined ? find(doc, f.from) : null;
  const fromRect = f.fromRect ?? (source === null ? null : rectOf(source));
  if (fromRect === null) return false;
  const to = rectOf(target);
  if (!measurable(fromRect) || !measurable(to)) return false;
  const clone = launchClone(doc, target, centredOn(to, fromRect), to, {
    classes: ['flyer'],
    strip: STRIP,
    sizeVar: '--tile-w',
    ms: f.ms,
    delay: f.delayMs,
    scale: false,
    onDone: () => {
      removeClass(target, 'arriving');
      setAttr(target, 'data-flying', null);
    },
  });
  if (clone === null) return false;
  addClass(target, 'arriving');
  // Read by the painter: a repaint mid-flight keeps the arrival hidden under its clone.
  setAttr(target, 'data-flying', '');
  // Read by theme.css `.flyer`'s transition: set before the style flush that starts it.
  setStyle(clone, '--fly-ms', `${String(f.ms)}ms`);
  return true;
};

/**
 * Run every flight after the repaint that placed the arrivals (the painter paints, then calls
 * this): stale clones beyond MAX_LIVE_FLYERS are culled first. Returns how many flights left the
 * ground; the rest were placed by the repaint alone.
 */
export const flyCards = (doc: PageLike, flights: ReadonlyArray<Flight>): number => {
  if (flights.length === 0) return 0;
  const live = queryAllIn(doc.body, '.flyer');
  if (live.length > MAX_LIVE_FLYERS) live.forEach(removeElement);
  return flights.filter((f) => launch(doc, f)).length;
};

/**
 * The flights the change from the last paint to `v` asks for, planned BEFORE the table repaints:
 * the last paint read off the DOM, my played tile's slot measured while it still stands, the marks
 * for the next read written. Reduced motion makes every glide 1 ms.
 */
export const planFlights = (doc: PageLike, v: View): ReadonlyArray<Flight> => {
  const prev = readPainted(doc);
  markPainted(doc, v);
  const myTile = (id: string): Rect | null => {
    const tile = find(doc, handTile(id));
    if (tile === null) return null;
    const r = rectOf(tile);
    return measurable(r) ? r : null;
  };
  return flightsOf(movesBetween(prev, v), v.seat, durationsFor(reducedMotion()), myTile);
};
