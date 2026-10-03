// UNO's cues (docs/design/uno.md §9; docs/design/sounds.md "UNO"): the shell's four rows and the
// table's own, each a cue of the active font with its buzz (web/shared/lib/sound/cues.ts), and
// `cuesBetween`, the pure binding from the change between two views to the cues this device
// plays. Every card is seen by every seat, so a play is heard at every device; the one row that
// depends on the listener is `penalty` (the cards a Draw Two or a Wild Draw Four put in MY hand,
// `View.seat`), heard instead of the table's `draw2`/`wild4` sting. The reducer (ui/state.ts
// `rendered`) plays the cues once per position (`CueMemory`, keyed on the view), never on a
// repaint, and adds `yourTurn` itself, since that needs the role. The ids are qualified
// (sound-fonts.md §2.1): the base cue the default font voices, then this game's word, so a font
// may voice `neutral.skip` apart from `neutral.reverse` and the default font plays both as the
// plain notice. Nothing else in the game names a sound.
import { SHELL_CUES, type CueSpec } from '../../../../shared/lib/sound/cues.ts';
import type { Kind } from '../engine/cards.ts';
import type { View } from '../engine/view.ts';

export type Cue =
  | 'yourTurn'
  | 'win'
  | 'lose'
  /** A number card laid on the pile. */
  | 'play'
  /** One card off the face-down stock, by any seat. */
  | 'draw'
  /** A Skip: the next seat sits out. */
  | 'skip'
  /** A Reverse: play runs the other way. */
  | 'reverse'
  /** A Draw Two laid: the next seat takes two and sits out. */
  | 'draw2'
  /** A Wild or a Wild Draw Four laid: a colour is to be named. */
  | 'wild'
  /** The colour named after a Wild Draw Four: four cards to the next seat, who sits out. */
  | 'wild4'
  /** The two or four cards landed in MY hand. */
  | 'penalty'
  /** A new game dealt (Play again). */
  | 'deal';

export const CUES: Readonly<Record<Cue | 'tap', CueSpec>> = {
  ...SHELL_CUES,
  play: { cue: 'move', buzz: 15 },
  // The stock is face down: the font's falling draw, not the tock of a card laid.
  draw: { cue: 'draw', buzz: 10 },
  skip: { cue: 'neutral.skip', buzz: [25, 25] },
  reverse: { cue: 'neutral.reverse', buzz: [25, 25, 25] },
  // A stake raised against the next seat: the font's challenge (an octave leap).
  draw2: { cue: 'challenge.draw2', buzz: [40, 40, 60] },
  wild: { cue: 'move.wild', buzz: 20 },
  wild4: { cue: 'challenge.wild4', buzz: [40, 40, 40, 40, 90] },
  // The cards are mine: the font's bad notice, and the buzz the penalised player feels.
  penalty: { cue: 'bad.penalty', buzz: [60, 40, 60] },
  deal: { cue: 'start.deal', buzz: [30, 40, 30] },
};

/** The row a card just laid plays: a number is a plain play, each action card its own notice. */
const PLAY_CUE: Readonly<Record<Kind, Cue>> = {
  number: 'play',
  skip: 'skip',
  reverse: 'reverse',
  draw2: 'draw2',
  wild: 'wild',
  wild4: 'wild',
};

/** How many cards MY hand grew by between the two views (`View.seat` is this device's seat). */
const myGain = (prev: View, next: View): number =>
  (next.counts[next.seat] ?? 0) - (prev.counts[prev.seat] ?? 0);

/** The table's sting, or the penalty when the cards landed in my hand. */
const stingOrPenalty = (prev: View, next: View, sting: Cue): ReadonlyArray<Cue> => [
  myGain(prev, next) >= 2 ? 'penalty' : sting,
];

/**
 * The cues for the change from `prev` to `next`: a new deal; the win or the loss (pass-and-play
 * hears the winner's, the view being the holder's); a card laid, by its kind (a Draw Two is the
 * penalty on the device that took the cards); the colour named after a Wild Draw Four (its four
 * cards land then, not at the play); else one card drawn from the stock by any seat. The engine
 * applies one intent between two views, so at most one row fires, and a repaint (`prev` equal to
 * `next`) fires none.
 */
export const cuesBetween = (prev: View, next: View): ReadonlyArray<Cue> => {
  if (next.startedAt !== prev.startedAt) return ['deal'];
  if (next.winner !== null && prev.winner === null)
    return [next.winner === next.seat ? 'win' : 'lose'];
  if (next.top.id !== prev.top.id) {
    const cue = PLAY_CUE[next.top.kind];
    return cue === 'draw2' ? stingOrPenalty(prev, next, 'draw2') : [cue];
  }
  const named = prev.phase === 'color' && next.phase !== 'color';
  if (named && next.top.kind === 'wild4') return stingOrPenalty(prev, next, 'wild4');
  return next.drawCount < prev.drawCount ? ['draw'] : [];
};
