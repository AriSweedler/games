// The engine as the shared shell plays it (docs/design/uno.md §9; web/shared/ui/shell.ts
// `ShellConfig.engine`): the host (the dealer) holds the whole `State`, every seat sees its own
// `View` (its hand, the others' card counts), and an action arrives with the seat that sent it.
// `State` wraps the engine's `Game` with the deal's clock (the finished game's key in the device's
// history). An `Action` is an engine intent without a seat (n-seat-sessions.md D1: the host knows
// a guest's seat by its channel); `applyAction` gives the UNO call and the call-out the sender's
// seat, refuses any other action out of turn, and turns the engine's refusal (the state with only
// its note rewritten) into an error the shell toasts; Play again may come from any seat, since
// the game is over for everyone, and restarts the deal's clock. The decoders are the trust
// boundary for the wire (a guest's action, the host's view) and the save (docs/ARCHITECTURE.md
// "Module boundaries").
import {
  arrayOf,
  boolean,
  integer,
  literal,
  map,
  nullable,
  object,
  optional,
  string,
  taggedUnion,
  type Decoder,
} from '../../../../shared/lib/json.ts';
import { err, ok, type Result } from '../../../../shared/lib/result.ts';
import type { Rng } from '../../../../shared/lib/rng.ts';
import { COLORS, type Card, type Cards, type Color } from './cards.ts';
import {
  apply,
  deal,
  handOf,
  mayCallOut,
  mayCallUno,
  playableIds,
  topOf,
  type Game,
  type Intent,
  type Phase,
  type UnoCall,
} from './engine.ts';

/** The tables the shell seats (n-seat-sessions.md §7): two to twelve players (engine.ts MAX_PLAYERS). */
export const SEAT_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type SeatCount = (typeof SEAT_COUNTS)[number];

export type State = Readonly<{ game: Game; startedAt: number }>;
/** The engine's intents as the wire carries them: the UNO call and the call-out without their seat. */
export type Action =
  | Exclude<Intent, { type: 'uno' } | { type: 'callOut' }>
  | Readonly<{ type: 'uno' }>
  | Readonly<{ type: 'callOut' }>;
export type PhaseKind = Phase['kind'];

/** The engine's intent for `seat`'s action: the two calls take the seat, the rest are the turn's. */
export const intentOf = (seat: number, action: Action): Intent =>
  action.type === 'uno' || action.type === 'callOut' ? { type: action.type, seat } : action;

/** One seat's picture of the table: its own hand, everyone's card count, never another hand. */
export type View = Readonly<{
  seat: number;
  names: ReadonlyArray<string>;
  counts: ReadonlyArray<number>;
  hand: Cards;
  top: Card;
  color: Color;
  turn: number;
  direction: 1 | -1;
  phase: PhaseKind;
  /** The seat that went out and won (`gameOver`), else null. */
  winner: number | null;
  /** The card I just drew that plays (`drawn`, my turn only), else null. */
  drawn: Card | null;
  /** The UNO call in the air (engine.ts §7), or null; everyone sees it. */
  uno: UnoCall | null;
  /** I may call UNO now: at two cards on my turn, or my window still open. */
  canUno: boolean;
  /** I may call out the seat at one card that has not called. */
  canCallOut: boolean;
  note: string;
  drawCount: number;
  startedAt: number;
  /** The ids I may play now (empty off my turn). */
  playable: ReadonlyArray<string>;
}>;

/** A fresh game for the seated names (the host first), round 1 dealt. */
export const createState = (names: ReadonlyArray<string>, rng: Rng, now: () => number): State => ({
  game: deal(names, rng),
  startedAt: now(),
});

export const NOT_YOUR_TURN_MSG = 'Not your turn.';

/** The actions any seat may send off its turn: Play again (the game is over for everyone) and the two UNO calls (the engine seats them). */
const offTurn = (action: Action): boolean =>
  action.type === 'again' || action.type === 'uno' || action.type === 'callOut';

/**
 * One seat's action. Every engine success writes a new `phase` object or a new `uno` (the two
 * calls), and its refusal only rewrites the note (engine.ts `refuse`), so a state whose phase
 * and call are both unchanged is a refusal and its note the reason.
 */
export const applyAction = (
  state: State,
  seat: number,
  action: Action,
  rng: Rng,
  now: () => number,
): Result<State, string> => {
  const game = state.game;
  if (!offTurn(action) && seat !== game.turn) return err(NOT_YOUR_TURN_MSG);
  const next = apply(game, intentOf(seat, action), rng);
  if (next.phase === game.phase && next.uno === game.uno) return err(next.note);
  return ok({ game: next, startedAt: action.type === 'again' ? now() : state.startedAt });
};

export const viewFor = (state: State, seat: number): View => {
  const game = state.game;
  const mine = seat === game.turn;
  const phase = game.phase;
  return {
    seat,
    names: game.names,
    counts: game.hands.map((hand) => hand.length),
    hand: handOf(game, seat),
    top: topOf(game),
    color: game.color,
    turn: game.turn,
    direction: game.direction,
    phase: phase.kind,
    winner: phase.kind === 'gameOver' ? phase.winner : null,
    drawn: phase.kind === 'drawn' && mine ? phase.card : null,
    uno: game.uno,
    canUno: mayCallUno(game, seat),
    canCallOut: mayCallOut(game, seat),
    note: game.note,
    drawCount: game.draw.length,
    startedAt: state.startedAt,
    playable: mine ? playableIds(game) : [],
  };
};

/** The turn's actions, mine alone. */
const turnActions = (view: View): ReadonlyArray<Action> => {
  if (view.seat !== view.turn) return [];
  switch (view.phase) {
    case 'turn':
      return [...view.playable.map((id): Action => ({ type: 'play', id })), { type: 'draw' }];
    case 'drawn':
      return [...view.playable.map((id): Action => ({ type: 'play', id })), { type: 'pass' }];
    case 'color':
      return COLORS.map((color): Action => ({ type: 'color', color }));
    case 'gameOver':
      return [];
  }
};

/** What a seat may send: the turn's actions and, off the turn too, the UNO call and the call-out. */
export const legalActions = (view: View): ReadonlyArray<Action> => {
  if (view.phase === 'gameOver') return [{ type: 'again' }];
  const calls: ReadonlyArray<Action> = [
    ...(view.canUno ? [{ type: 'uno' } as const] : []),
    ...(view.canCallOut ? [{ type: 'callOut' } as const] : []),
  ];
  return [...turnActions(view), ...calls];
};

// ---- the decoders ---------------------------------------------------------------------------

const color: Decoder<Color> = literal(...COLORS);
const seat = integer(0, SEAT_COUNTS.length);

export const decodeCard: Decoder<Card> = object({
  id: string,
  kind: literal('number', 'skip', 'reverse', 'draw2', 'wild', 'wild4'),
  color: nullable(color),
  value: nullable(integer(0, 9)),
});
const cards = arrayOf(decodeCard);
const unoCall: Decoder<UnoCall> = object({ seat, called: boolean, open: boolean });

export const decodeAction: Decoder<Action> = taggedUnion('type', {
  play: object({ type: literal('play'), id: string }),
  color: object({ type: literal('color'), color }),
  draw: object({ type: literal('draw') }),
  pass: object({ type: literal('pass') }),
  again: object({ type: literal('again') }),
  uno: object({ type: literal('uno') }),
  callOut: object({ type: literal('callOut') }),
});

export const decodeView: Decoder<View> = object({
  seat,
  names: arrayOf(string),
  counts: arrayOf(integer(0)),
  hand: cards,
  top: decodeCard,
  color,
  turn: seat,
  direction: literal(1, -1),
  phase: literal('turn', 'drawn', 'color', 'gameOver'),
  winner: nullable(seat),
  drawn: nullable(decodeCard),
  uno: nullable(unoCall),
  canUno: boolean,
  canCallOut: boolean,
  note: string,
  drawCount: integer(0),
  startedAt: integer(0),
  playable: arrayOf(string),
});

const decodePhase: Decoder<Phase> = taggedUnion('kind', {
  turn: object({ kind: literal('turn') }),
  drawn: object({ kind: literal('drawn'), card: decodeCard }),
  color: object({ kind: literal('color'), card: decodeCard }),
  gameOver: object({ kind: literal('gameOver'), winner: seat }),
});

/** A save from before the UNO call (§7) has no `uno`: it reads as no call in the air. */
const decodeGame: Decoder<Game> = map(
  object({
    names: arrayOf(string),
    hands: arrayOf(cards),
    draw: cards,
    discard: cards,
    color,
    turn: seat,
    direction: literal(1, -1),
    phase: decodePhase,
    uno: optional(nullable(unoCall)),
    note: string,
  }),
  (game): Game => ({ ...game, uno: game.uno ?? null }),
);

/** The save's game and `position/load`'s hand-made object: the engine's state and the deal's clock. */
export const decodeState: Decoder<State> = object({ game: decodeGame, startedAt: integer(0) });
