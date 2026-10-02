// Flip 7's cues (docs/design/flip7.md; docs/design/sounds.md "Flip 7"): the shell's four rows and
// the table's own, each a cue of the active font with its buzz (web/shared/lib/sound/cues.ts), and
// `cuesBetween`, the pure binding from the change between two views to the cues a device plays.
// Everyone at the table watches the same lines, so every seat hears the same table sounds (a bust
// is a bust whoever's it is, as backgammon's hit is heard by both seats); only the game's end is
// the listener's (`win`/`lose` online; pass-and-play hears the win, the phone being shared). The
// ids are qualified (sound-fonts.md §2.1): the base cue the default font voices, then this game's
// word (`bad.bust`, `great.flip7`), so a font voices a Flip 7 apart from any other triumph and the
// default font plays the base. src/fx.ts is meant to play rows of this table and ui/state.ts
// `rendered` to fire `cuesBetween` once per position (`cueKey`, the shell's `CueMemory`), never on
// a repaint; until they do (docs/design/sounds.md "Follow-ups"), the shell's four rows alone sound.
// Nothing else in the game names a sound.
import { SHELL_CUES, type CueSpec } from '../../../../shared/lib/sound/cues.ts';
import type { CueMemory } from '../../../../shared/ui/shell.ts';
import { numbersOf, type Card } from '../engine/cards.ts';
import type { Seat as SeatState, Status } from '../engine/engine.ts';
import type { View } from '../engine/index.ts';

export type Cue =
  | 'yourTurn'
  | 'win'
  | 'lose'
  /** A number card flipped off the deck into a line. */
  | 'flip'
  /** A modifier (+2 … +10, ×2) flipped into a line. */
  | 'modifier'
  /** A Second Chance taken into a line (flipped, or given by another seat). */
  | 'second'
  /** A duplicate number: the Second Chance takes it and the seat plays on. */
  | 'save'
  /** A duplicate number with no Second Chance: the seat busts. */
  | 'bust'
  /** A Freeze given: the seat banks and sits out the round. */
  | 'freeze'
  /** A Flip Three given: three cards in a row land in a line. */
  | 'flipThree'
  /** The seat stays and banks its line. */
  | 'stay'
  /** Seven distinct numbers: the bonus, and the round ends for everyone. */
  | 'flip7'
  /** The round settled: every line banked (the game not yet won). */
  | 'roundOver'
  /** A new round dealt (or a new game). */
  | 'deal';

export const CUES: Readonly<Record<Cue | 'tap', CueSpec>> = {
  ...SHELL_CUES,
  // Off a face-down deck: the font's falling draw.
  flip: { cue: 'draw', buzz: 10 },
  // Points onto the line: the font's light rising score.
  modifier: { cue: 'score.modifier', buzz: 15 },
  second: { cue: 'good.second', buzz: [20, 30, 20] },
  save: { cue: 'good.save', buzz: [30, 40, 30] },
  bust: { cue: 'bad.bust', buzz: [60, 40, 60] },
  freeze: { cue: 'neutral.freeze', buzz: [40, 40] },
  // A stake raised against a seat: the font's challenge (an octave leap).
  flipThree: { cue: 'challenge.flip3', buzz: [40, 40, 60] },
  stay: { cue: 'score.stay', buzz: 25 },
  flip7: { cue: 'great.flip7', buzz: [50, 50, 50, 50, 120] },
  roundOver: { cue: 'neutral.round', buzz: [40, 40, 40] },
  deal: { cue: 'start.deal', buzz: [30, 40, 30] },
};

/** The cue machine's memory (the shell's `CueMemory`): the position the cues last played for, so a re-sent frame plays nothing. */
export type CueState = CueMemory;
export const INITIAL_CUES: CueState = { key: null };

/** One key per position: the game, the round, the phase, whose turn, every line's length, what is pending and the scores. */
export const cueKey = (v: View): string =>
  [
    v.startedAt,
    v.round,
    v.phase.kind,
    v.turn,
    v.seats.map((s) => `${String(s.line.length)}${s.status[0] ?? ''}`).join(','),
    v.pending.length,
    v.scores.join(','),
  ].join(':');

/** How many cards a Flip Three deals, at least, in one step (the deck may run out). */
const FLIP_THREE_MIN = 2;

/** The cards in `next`'s line that `prev`'s did not hold, in order. */
const newCards = (prev: SeatState | undefined, next: SeatState): ReadonlyArray<Card> => {
  const had = new Set((prev?.line ?? []).map((c) => c.id));
  return next.line.filter((c) => !had.has(c.id));
};

const cardCue = (card: Card): Cue =>
  card.kind === 'number' ? 'flip' : card.kind === 'second' ? 'second' : 'modifier';

/** The one row a seat's status change plays, or none (a seat back to `active` is the new round's deal). */
const STATUS_CUE: Readonly<Record<Status, Cue | null>> = {
  active: null,
  stayed: 'stay',
  frozen: 'freeze',
  busted: 'bust',
  flip7: 'flip7',
};

/**
 * A Second Chance was spent: the line lost its Second Chance card and the seat plays on (a bust
 * keeps the card and the duplicate on the table; a new round clears every line, which `prev.round`
 * rules out above).
 */
const saved = (prev: SeatState | undefined, next: SeatState): boolean =>
  prev !== undefined &&
  next.status === 'active' &&
  prev.line.some((c) => c.kind === 'second') &&
  !next.line.some((c) => c.kind === 'second') &&
  numbersOf(next.line).length === numbersOf(prev.line).length;

/** One seat's cues between two views of the same round: the cards that landed, a save, then the status it ended in. */
const seatCues = (prev: SeatState | undefined, next: SeatState): ReadonlyArray<Cue> => {
  const landed = newCards(prev, next);
  const three = landed.length >= FLIP_THREE_MIN ? (['flipThree'] as const) : [];
  const fate = prev !== undefined && prev.status !== next.status ? STATUS_CUE[next.status] : null;
  return [
    ...three,
    ...landed.map(cardCue),
    ...(saved(prev, next) ? (['save'] as const) : []),
    ...(fate === null ? [] : [fate]),
  ];
};

/**
 * The cues for the change from `prev` to `next`, in the order they happened: a new game or round
 * is the deal; else every seat's cards and fate this step (the acting seat's flips, a Flip Three's
 * three, a Freeze's victim), then the round's end or the game's (`local`: the shared phone hears
 * the win). The engine applies one intent between two views, so the cues of one step are one
 * seat's, plus a target's. A repaint (`prev` equal to `next`) fires none.
 */
export const cuesBetween = (prev: View, next: View, local: boolean): ReadonlyArray<Cue> => {
  if (next.startedAt !== prev.startedAt || next.round !== prev.round) return ['deal'];
  const seats = next.seats.flatMap((seat, i) => seatCues(prev.seats[i], seat));
  const over = next.phase.kind === 'gameOver' && prev.phase.kind !== 'gameOver';
  const settled = next.phase.kind === 'roundOver' && prev.phase.kind !== 'roundOver';
  const won = local || (next.phase.kind === 'gameOver' && next.phase.winner === next.me);
  return [
    ...seats,
    ...(settled ? (['roundOver'] as const) : []),
    ...(over ? ([won ? 'win' : 'lose'] as const) : []),
  ];
};
