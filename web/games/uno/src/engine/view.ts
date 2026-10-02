// The engine as the shared shell plays it (docs/design/uno.md §9; web/shared/ui/shell.ts
// `ShellConfig.engine`): the host (the dealer) holds the whole `State`, every seat sees its own
// `View` (its hand, the others' card counts), and an action arrives with the seat that sent it.
// `State` wraps the engine's `Game` with the deal's clock (the finished game's key in the device's
// history). `applyAction` refuses a play out of turn and turns the engine's refusal (the state
// with only its note rewritten) into an error the shell toasts; Play again may come from any
// seat, since the game is over for everyone, and restarts the deal's clock. The decoders are the trust boundary for the wire
// (a guest's action, the host's view) and the save (docs/ARCHITECTURE.md "Module boundaries").
import {
  arrayOf,
  integer,
  literal,
  nullable,
  object,
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
  playableIds,
  topOf,
  type Game,
  type Intent,
  type Phase,
} from './engine.ts';

/** The tables the shell seats (n-seat-sessions.md §7): two to twelve players (engine.ts MAX_PLAYERS). */
export const SEAT_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type SeatCount = (typeof SEAT_COUNTS)[number];

export type State = Readonly<{ game: Game; startedAt: number }>;
export type Action = Intent;
export type PhaseKind = Phase['kind'];

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

/**
 * One seat's action. Every engine success writes a new `phase` object, and its refusal only
 * rewrites the note (engine.ts `refuse`), so an unchanged phase is a refusal and its note the
 * reason.
 */
export const applyAction = (
  state: State,
  seat: number,
  action: Action,
  rng: Rng,
  now: () => number,
): Result<State, string> => {
  const game = state.game;
  if (action.type !== 'again' && seat !== game.turn) return err(NOT_YOUR_TURN_MSG);
  const next = apply(game, action, rng);
  if (next.phase === game.phase) return err(next.note);
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
    note: game.note,
    drawCount: game.draw.length,
    startedAt: state.startedAt,
    playable: mine ? playableIds(game) : [],
  };
};

/** What a guest may send: the engine's five intents. */
export const legalActions = (view: View): ReadonlyArray<Action> => {
  if (view.phase === 'gameOver') return [{ type: 'again' }];
  if (view.seat !== view.turn) return [];
  switch (view.phase) {
    case 'turn':
      return [...view.playable.map((id): Action => ({ type: 'play', id })), { type: 'draw' }];
    case 'drawn':
      return [...view.playable.map((id): Action => ({ type: 'play', id })), { type: 'pass' }];
    case 'color':
      return COLORS.map((color): Action => ({ type: 'color', color }));
  }
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

export const decodeAction: Decoder<Action> = taggedUnion('type', {
  play: object({ type: literal('play'), id: string }),
  color: object({ type: literal('color'), color }),
  draw: object({ type: literal('draw') }),
  pass: object({ type: literal('pass') }),
  again: object({ type: literal('again') }),
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

const decodeGame: Decoder<Game> = object({
  names: arrayOf(string),
  hands: arrayOf(cards),
  draw: cards,
  discard: cards,
  color,
  turn: seat,
  direction: literal(1, -1),
  phase: decodePhase,
  note: string,
});

/** The save's game and `position/load`'s hand-made object: the engine's state and the deal's clock. */
export const decodeState: Decoder<State> = object({ game: decodeGame, startedAt: integer(0) });
