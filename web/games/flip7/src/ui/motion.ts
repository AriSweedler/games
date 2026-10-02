// Flip 7's anticipation (the owner, 2026-10-02: "The flip7 game is so fun because of the
// anticipation. There NEEDs to be animation and card flipping and niceness"), in briscola's shape
// (ui/motion.ts + ui/beat.ts): a pure clock, a pure plan and two small DOM steps. Every card is
// face up, so nothing flies: a dealt card flips face-up where it lies (theme.css `.tile.dealt`, a
// back-then-face turn with `--i` its place in this paint's stagger), the card that busts a seat
// lands red once its flip has shown it (`.tile.bust-card`) and the seat's line washes grey after
// (`.seat.busting`), a seat's Flip 7 glows gold (`.seat.flip7-now`), and the round's scores come up
// a row at a time (`.scores li.reveal`); the pause sheet rises only after the beat
// (`#pauseOverlay`, `--f7-beat-ms`), so what happened is read before Continue is offered.
//
// The moments are keyed on the table's diff, never on a repaint: `moments(prev, view)` sets the
// new view against the table the LAST paint left (`readPainted`: each seat's status and its tiles'
// ids read back from the DOM, which is exactly what the previous paint drew, so a paint with no new
// card flips nothing, and the Continue after a bust redraws the same tiles still) and names what is
// new: the cards no seat showed before, the seats that went from alive to busted or to Flip 7, and
// the scores panel coming up. A cold paint (a resume, a reconnect, the first deal) finds no seats
// and deals every card in, staggered to a cap, with no bust or bonus moment: nothing just happened.
//
// The clock is one table (`DURATIONS`), written on the root as `--f7-*-ms` once at bind
// (`writeClock`) so theme.css's animations read the same numbers the tests pin; under
// `prefers-reduced-motion` (the shared `reducedMotion` read) `REDUCED_DURATIONS` makes every turn a
// millisecond with no stagger and keeps the 300 ms still before the pause (long enough to read the
// card), and the theme's media query agrees as the fallback. `revealAtMs` is for the sound row
// (the flip's cue belongs at the moment the face shows: the turn's midpoint). Only the DOM edge is
// reached (dom.ts); never ui/state.ts.
import {
  dataOf,
  hasClass,
  queryAllIn,
  requireId,
  setRootStyle,
  type DocumentLike,
  type Element,
  type RootDocumentLike,
} from '../../../../shared/edge/dom.ts';
import type { Status, View } from '../engine/index.ts';

// ---- the clock -----------------------------------------------------------------------------------------

export type Durations = Readonly<{
  /** A dealt card's turn: back, then face. */
  flipMs: number;
  /** Between one card's turn and the next when several land in one paint. */
  gapMs: number;
  /** The bust card's red landing, and the line's grey wash after it. */
  landMs: number;
  /** From the paint to the pause sheet and the scores: the flip and the landing read first. */
  beatMs: number;
  /** One score row coming up. */
  rowMs: number;
  /** Between one row and the next. */
  rowGapMs: number;
  /** The Flip 7 glow's swell. */
  glowMs: number;
}>;

export const DURATIONS: Durations = {
  flipMs: 360,
  gapMs: 140,
  landMs: 280,
  beatMs: 720,
  rowMs: 260,
  rowGapMs: 90,
  glowMs: 900,
};

/** `prefers-reduced-motion`: every turn a millisecond, no stagger, the 300 ms still before the pause. */
export const REDUCED_DURATIONS: Durations = {
  flipMs: 1,
  gapMs: 0,
  landMs: 1,
  beatMs: 300,
  rowMs: 1,
  rowGapMs: 0,
  glowMs: 1,
};

export const durationsFor = (reducedMotion: boolean): Durations =>
  reducedMotion ? REDUCED_DURATIONS : DURATIONS;

/** How many cards of one paint flip one after another before the rest turn together (a cold paint deals a whole table in). */
export const MAX_STAGGER = 6;

/** When the `k`-th card of a paint shows its face, in ms after the paint: the sound row's cue. */
export const revealAtMs = (k: number, d: Durations): number =>
  Math.min(k, MAX_STAGGER) * d.gapMs + d.flipMs / 2;

/** The root's `--f7-*-ms` custom properties, one per duration, in theme.css's names. */
export const CLOCK_VARS: Readonly<Record<keyof Durations, string>> = {
  flipMs: '--f7-flip-ms',
  gapMs: '--f7-gap-ms',
  landMs: '--f7-land-ms',
  beatMs: '--f7-beat-ms',
  rowMs: '--f7-row-ms',
  rowGapMs: '--f7-row-gap-ms',
  glowMs: '--f7-glow-ms',
};

// ---- the plan ------------------------------------------------------------------------------------------

/** One seat as the last paint left it: its status class and its tiles' card ids, in line order. */
export type PaintedSeat = Readonly<{
  seat: number;
  status: Status | null;
  cards: ReadonlyArray<string>;
}>;

/** The table the last paint left: nothing when the table was not up (a cold paint). */
export type Painted = Readonly<{ seats: ReadonlyArray<PaintedSeat>; resultShown: boolean }>;

export const NOTHING_PAINTED: Painted = { seats: [], resultShown: false };

export type Moments = Readonly<{
  /** Card id to its place in this paint's stagger: 0 turns first. */
  dealt: ReadonlyMap<string, number>;
  /** The cards whose arrival busted their seat this paint: red once turned. */
  bustCards: ReadonlySet<string>;
  /** Seats that went from alive to busted this paint: the grey wash after the landing. */
  busting: ReadonlySet<number>;
  /** Seats that reached Flip 7 this paint: the gold moment. */
  flip7: ReadonlySet<number>;
  /** The result panel comes up this paint: its rows reveal one by one. */
  scores: boolean;
}>;

export const NO_MOMENTS: Moments = {
  dealt: new Map(),
  bustCards: new Set(),
  busting: new Set(),
  flip7: new Set(),
  scores: false,
};

const over = (view: View): boolean =>
  view.phase.kind === 'roundOver' || view.phase.kind === 'gameOver';

/** A seat went from alive (active, or stayed: a Freeze can still reach it) to `to` this paint; a cold seat never did. */
const became = (prev: PaintedSeat | undefined, now: Status, to: Status): boolean =>
  now === to && prev !== undefined && prev.status !== null && prev.status !== to;

/**
 * What is new this paint, the view set against the last paint's table: the cards no seat showed
 * before, in seat then line order, their stagger places capped at MAX_STAGGER; the busts and the
 * Flip 7s among seats that were alive; the scores when the panel was down and is up now.
 */
export const moments = (prev: Painted, view: View): Moments => {
  const shown = new Map(prev.seats.map((s) => [s.seat, s]));
  const fresh = view.seats.flatMap((seat, i) => {
    const before = shown.get(i)?.cards ?? [];
    return seat.line.filter((card) => !before.includes(card.id)).map((card) => card.id);
  });
  const dealt = new Map(fresh.map((id, k) => [id, Math.min(k, MAX_STAGGER)]));
  const busting = new Set(
    view.seats.flatMap((seat, i) => (became(shown.get(i), seat.status, 'busted') ? [i] : [])),
  );
  const bustCards = new Set(
    [...busting].flatMap((i) => {
      const last = view.seats[i]?.line.at(-1);
      return last !== undefined && dealt.has(last.id) ? [last.id] : [];
    }),
  );
  const flip7 = new Set(
    view.seats.flatMap((seat, i) => (became(shown.get(i), seat.status, 'flip7') ? [i] : [])),
  );
  return { dealt, bustCards, busting, flip7, scores: over(view) && !prev.resultShown };
};

// ---- the DOM steps -------------------------------------------------------------------------------------

const STATUSES: ReadonlyArray<Status> = ['active', 'stayed', 'frozen', 'busted', 'flip7'];

const statusOf = (el: Element): Status | null =>
  STATUSES.find((s) => hasClass(el, `status-${s}`)) ?? null;

const paintedSeat = (el: Element): PaintedSeat | null => {
  const raw = dataOf(el, 'seat');
  const seat = raw === null || raw === '' ? NaN : Number(raw);
  if (!Number.isInteger(seat)) return null;
  return {
    seat,
    status: statusOf(el),
    cards: queryAllIn(el, '.tile').flatMap((t) => {
      const id = dataOf(t, 'card');
      return id === null ? [] : [id];
    }),
  };
};

/**
 * The table as the last paint left it, read back before this one repaints: every `.seat[data-seat]`
 * under `#seats` (the background grid and the foreground seat alike, by seat index, so a seat that
 * moves to the foreground keeps its cards still) and whether `#result` was up.
 */
export const readPainted = (doc: DocumentLike): Painted => ({
  seats: queryAllIn(requireId(doc, 'seats'), '.seat[data-seat]').flatMap((el) => {
    const s = paintedSeat(el);
    return s === null ? [] : [s];
  }),
  resultShown: !hasClass(requireId(doc, 'result'), 'hidden'),
});

/** The clock on the root as `--f7-*-ms`, for theme.css: once at bind, from `durationsFor(reducedMotion())`. */
export const writeClock = (doc: DocumentLike & RootDocumentLike, d: Durations): void => {
  (Object.keys(CLOCK_VARS) as ReadonlyArray<keyof Durations>).forEach((key) => {
    setRootStyle(doc, CLOCK_VARS[key], `${String(d[key])}ms`);
  });
};
