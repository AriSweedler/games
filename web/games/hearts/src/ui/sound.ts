// Hearts's cues (docs/design/hearts.md §7; docs/design/sound-fonts.md §5): the shell's four rows
// (a tap, my turn, win, lose) and the table's own, each a cue of the active font with its buzz
// (web/shared/lib/sound/cues.ts), and `cuesBetween`, the pure binding from the change between two
// views to the cues this device plays. Every card is seen by every seat, so a play and a trick
// gathered are heard at every device; the rows that depend on the listener are `points` and
// `queen` (the trick landed in MY pile, `View.seat`), heard instead of the quiet gather. The
// reducer (ui/state.ts `rendered`) plays the cues once per position (`CueMemory`, keyed on the
// view), never on a repaint, and adds `yourTurn` itself, since that needs the role. The ids are
// qualified (sound-fonts.md §2.1): the base cue the default font voices, then this game's word, so a
// font may voice `bad.queen` louder than `bad.points` and the default font plays both as the plain
// bad notice. Nothing else in the game names a sound.
import { QUEEN_OF_SPADES } from '../engine/cards.ts';
import type { View } from '../engine/view.ts';
import { SHELL_CUES, type CueSpec } from '../../../../shared/lib/sound/cues.ts';

export type Cue =
  | 'yourTurn'
  | 'win'
  | 'lose'
  /** A seat's three cards chosen for the pass (any seat; the cards stay face down). */
  | 'pass'
  /** A card laid on the trick, by any seat. */
  | 'play'
  /** A trick gathered that carried no points, or another seat's points: quiet. */
  | 'trick'
  /** A trick with hearts landed in MY pile. */
  | 'points'
  /** The queen of spades landed in MY pile: the louder bad notice. */
  | 'queen'
  /** The moon shot, by any seat (the hand's end). */
  | 'moon'
  /** A hand's end, the scores up. */
  | 'handOver'
  /** A new hand dealt (Next hand, Play again). */
  | 'deal';

export const CUES: Readonly<Record<Cue | 'tap', CueSpec>> = {
  ...SHELL_CUES,
  // Three cards slid away face down: the font's placing tock, softer than a card laid.
  pass: { cue: 'move.pass', buzz: 10 },
  play: { cue: 'move', buzz: 15 },
  // The taker gathers the cards: something lifted off the table, quietly.
  trick: { cue: 'pickup', buzz: 10 },
  points: { cue: 'bad.points', buzz: [60, 40, 60] },
  queen: { cue: 'bad.queen', buzz: [90, 40, 90, 40, 120] },
  moon: { cue: 'great', buzz: [50, 50, 50, 50, 120] },
  handOver: { cue: 'neutral.hand', buzz: 30 },
  deal: { cue: 'start.deal', buzz: [30, 40, 30] },
};

const trueCount = (flags: ReadonlyArray<boolean>): number => flags.filter(Boolean).length;

/** The trick's cards in play order, a key: two views show the same trick taken when they match. */
const trickKey = (view: View): string => view.lastTrick?.plays.map((p) => p.card).join(' ') ?? '';

/** The row the trick just gathered plays on this device: the queen or the hearts when they are mine, else the quiet gather. */
const gatherCue = (view: View): Cue => {
  const trick = view.lastTrick;
  if (trick?.taker !== view.seat || trick.points === 0) return 'trick';
  return trick.plays.some((p) => p.card === QUEEN_OF_SPADES) ? 'queen' : 'points';
};

/** The hand just ended (or the game with it): the moon when shot, else the plain end's notice. */
const handEndCues = (next: View): ReadonlyArray<Cue> => {
  if (next.phase === 'gameOver') {
    const end: Cue = next.winners.includes(next.seat) ? 'win' : 'lose';
    return next.moon === null ? [end] : ['moon', end];
  }
  return next.moon === null ? ['handOver'] : ['moon'];
};

/**
 * The cues for the change from `prev` to `next`: a new deal (a new game or the next hand); the
 * hand's end, the moon first when shot, then the win or the loss when the game ended with it
 * (pass-and-play hears the holder's); a trick gathered, by what landed where; a seat's pass chosen;
 * else a card laid. The engine applies one intent between two views, so one moment fires (the moon
 * and the end are one moment), and a repaint (`prev` equal to `next`) fires none.
 */
export const cuesBetween = (prev: View, next: View): ReadonlyArray<Cue> => {
  if (next.startedAt !== prev.startedAt || next.round !== prev.round) return ['deal'];
  const over = next.phase === 'handOver' || next.phase === 'gameOver';
  if (over && !(prev.phase === 'handOver' || prev.phase === 'gameOver')) return handEndCues(next);
  if (trickKey(next) !== trickKey(prev)) return [gatherCue(next)];
  if (trueCount(next.passed) > trueCount(prev.passed)) return ['pass'];
  return next.trick.plays.length > prev.trick.plays.length ? ['play'] : [];
};
