// Hearts's engine as the shared shell plays it (docs/design/hearts.md §7; web/shared/ui/shell.ts
// `ShellConfig.engine`): the host (or the phone) holds the whole `State`, each seat gets its own
// `View`: its hand, the trick on the table, the trick just taken with who took which points,
// every seat's card count and score, who has passed, and what it may do now; never another
// seat's hand (AGENT.md "Hidden hands"). `State` wraps the engine's `Game` with the game's clock
// (the finished game's key in the device's history). An `Action` is an intent without a seat
// (n-seat-sessions.md D1: the host knows a guest's seat by its channel): `applyAction` seats the
// pass from the sender, refuses a play out of turn, and lets Next hand and Play again in from any
// seat. The decoders are the trust boundary for the wire and the save (docs/ARCHITECTURE.md
// "Module boundaries").
import {
  arrayOf,
  boolean,
  integer,
  literal,
  nullable,
  object,
  refine,
  string,
  taggedUnion,
  type Decoder,
} from '../../../../shared/lib/json.ts';
import type { Rng } from '../../../../shared/lib/rng.ts';
import { err, ok, type Result } from '../../../../shared/lib/result.ts';
import { isCard, type Cards } from './cards.ts';
import {
  MAX_SEATS,
  MIN_SEATS,
  NOT_YOUR_TURN_MSG,
  SEAT_COUNTS,
  actorOf,
  apply,
  handOf,
  legalIntents,
  newGame,
  winnersOf,
  type Game,
  type Intent,
  type Names,
  type PassDirection,
  type Phase,
  type Play,
  type Trick,
  type TrickResult,
} from './engine.ts';

export { MAX_SEATS, MIN_SEATS, NOT_YOUR_TURN_MSG, SEAT_COUNTS, actorOf, type Names, type Phase };
export type { SeatCount } from './engine.ts';

/** A seat index: 0 to 3 (the shell's own two and the table's extra two, ui/state.ts `HeartsSeat`). */
export type Seat = number;

export type State = Readonly<{ game: Game; startedAt: number }>;

/** The engine's intents as the wire carries them: the pass without its seat. */
export type Action =
  | Readonly<{ type: 'pass'; ids: Cards }>
  | Readonly<{ type: 'play'; id: string }>
  | Readonly<{ type: 'nextHand' }>
  | Readonly<{ type: 'playAgain' }>;

/** The engine's intent for `seat`'s action: the pass takes the seat, the rest are as sent. */
export const intentOf = (seat: Seat, action: Action): Intent =>
  action.type === 'pass' ? { type: 'pass', seat, ids: action.ids } : action;

/** The wire's action for an engine intent (the bot's and the hook's `legal()`). */
export const actionOf = (intent: Intent): Action =>
  intent.type === 'pass' ? { type: 'pass', ids: intent.ids } : intent;

/** One seat's picture of the table (§7): its own hand and everyone's public state. */
export type View = Readonly<{
  seat: Seat;
  names: Names;
  phase: Phase;
  /** The hand number, from 1. */
  round: number;
  direction: PassDirection;
  /** My cards, in `sortHand` order. */
  hand: Cards;
  /** Every seat's cards in hand. */
  counts: ReadonlyArray<number>;
  /** Who has chosen their pass (all false outside the pass). */
  passed: ReadonlyArray<boolean>;
  /** The three I chose, while the others still choose; null otherwise. */
  myPass: Cards | null;
  trick: Trick;
  /** The trick just taken, who took it and its points: the table's pause when the points are not 0. */
  lastTrick: TrickResult | null;
  heartsBroken: boolean;
  /** The seat to act, or null when any seat may (between hands, after the game). */
  turn: Seat | null;
  scores: ReadonlyArray<number>;
  /** The hand just scored (`handOver`, `gameOver`), the moon applied; null while a hand is on. */
  handScores: ReadonlyArray<number> | null;
  moon: Seat | null;
  /** The seats on the lowest score once the game is over; empty before. */
  winners: ReadonlyArray<Seat>;
  /** What I may send now (the pass listed once, as the three highest: any three are legal). */
  legal: ReadonlyArray<Action>;
  note: string;
  startedAt: number;
}>;

/** A fresh game for the seated names (the host first), hand 1 dealt. */
export const createState = (names: Names, rng: Rng, now: () => number): State => ({
  game: newGame(names, rng),
  startedAt: now(),
});

/** The actions any seat may send off its turn: the pass (the engine checks the seat), Next hand and Play again. */
const offTurn = (action: Action): boolean => action.type !== 'play';

export const applyAction = (
  state: State,
  seat: Seat,
  action: Action,
  rng: Rng,
  now: () => number,
): Result<State, string> => {
  const game = state.game;
  if (!offTurn(action) && (game.phase !== 'playing' || seat !== game.turn))
    return err(NOT_YOUR_TURN_MSG);
  const next = apply(game, intentOf(seat, action), rng);
  if (!next.ok) return next;
  return ok({ game: next.value, startedAt: action.type === 'playAgain' ? now() : state.startedAt });
};

export const viewFor = (state: State, seat: Seat): View => {
  const game = state.game;
  const passing = game.phase === 'passing';
  return {
    seat,
    names: game.names,
    phase: game.phase,
    round: game.round,
    direction: game.direction,
    hand: handOf(game, seat),
    counts: game.hands.map((hand) => hand.length),
    passed: game.passes.map((p) => p !== null),
    myPass: passing ? (game.passes[seat] ?? null) : null,
    trick: game.trick,
    lastTrick: game.lastTrick,
    heartsBroken: game.heartsBroken,
    turn: actorOf(game),
    scores: game.scores,
    handScores: game.handScores,
    moon: game.moon,
    winners: game.phase === 'gameOver' ? winnersOf(game.scores) : [],
    legal: legalIntents(game, seat).map(actionOf),
    note: game.note,
    startedAt: state.startedAt,
  };
};

/** The seat whose turn it is, or null when any seat may act or none (the shell's viewer and revealer). */
export const turnSeat = (game: Game): Seat | null => actorOf(game);

/** What a guest may send: the view's legal actions. */
export const legalActions = (view: View): ReadonlyArray<Action> => view.legal;

// ---- the decoders ---------------------------------------------------------------------------

const seat: Decoder<Seat> = integer(0, MAX_SEATS - 1);
const card: Decoder<string> = refine(string, isCard, 'a card id');
const cards = arrayOf(card);
const play: Decoder<Play> = object({ seat, card });
const trick: Decoder<Trick> = object({ leader: seat, plays: arrayOf(play) });
const trickResult: Decoder<TrickResult> = object({
  leader: seat,
  plays: arrayOf(play),
  taker: seat,
  points: integer(0, 26),
});
const phase: Decoder<Phase> = literal('passing', 'playing', 'handOver', 'gameOver');
const direction: Decoder<PassDirection> = literal('left', 'right', 'across', 'hold');

export const decodeAction: Decoder<Action> = taggedUnion('type', {
  pass: object({ type: literal('pass'), ids: cards }),
  play: object({ type: literal('play'), id: card }),
  nextHand: object({ type: literal('nextHand') }),
  playAgain: object({ type: literal('playAgain') }),
});

export const decodeView: Decoder<View> = object({
  seat,
  names: arrayOf(string),
  phase,
  round: integer(1),
  direction,
  hand: cards,
  counts: arrayOf(integer(0)),
  passed: arrayOf(boolean),
  myPass: nullable(cards),
  trick,
  lastTrick: nullable(trickResult),
  heartsBroken: boolean,
  turn: nullable(seat),
  scores: arrayOf(integer(0)),
  handScores: nullable(arrayOf(integer(0))),
  moon: nullable(seat),
  winners: arrayOf(seat),
  legal: arrayOf(decodeAction),
  note: string,
  startedAt: integer(0),
});

const decodeGame: Decoder<Game> = object({
  names: arrayOf(string),
  phase,
  round: integer(1),
  direction,
  hands: arrayOf(cards),
  passes: arrayOf(nullable(cards)),
  trick,
  lastTrick: nullable(trickResult),
  taken: arrayOf(cards),
  heartsBroken: boolean,
  turn: seat,
  scores: arrayOf(integer(0)),
  handScores: nullable(arrayOf(integer(0))),
  moon: nullable(seat),
  note: string,
});

/** The save's game and `position/load`'s hand-made object: the engine's state and the game's clock. */
export const decodeState: Decoder<State> = object({ game: decodeGame, startedAt: integer(0) });
