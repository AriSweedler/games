// The engine as the shared shell plays it (docs/design/hive.md §7; web/shared/ui/shell.ts
// `ShellConfig.engine`): the host (or the phone) holds the whole `State`, and every seat sees the
// same board, since Hive hides nothing. Seat 0 is White (the host, or the first name typed), seat 1
// Black. `State` wraps the engine's `Game` with the game's clock (the finished game's key in the
// device's history). `applyAction` refuses a play out of turn and turns the engine's refusal (the
// state with only its note rewritten) into an error the shell toasts; `again` may come from either
// seat once the game is over and starts the clock anew. The decoders are the trust boundary for
// the wire (a guest's action, the host's view) and the save (docs/ARCHITECTURE.md "Module
// boundaries").
import {
  arrayOf,
  integer,
  literal,
  nullable,
  object,
  record,
  string,
  taggedUnion,
  type Decoder,
} from '../../../../shared/lib/json.ts';
import { err, ok, type Result } from '../../../../shared/lib/result.ts';
import {
  apply,
  legalMoves,
  legalPlacements,
  mustPass,
  newGame,
  occupied,
  type Board,
  type Game,
  type Intent,
  type Move,
  type Outcome,
  type Place,
} from './engine.ts';
import { keyOf, type Hex } from './hex.ts';
import { BUGS, SIDES, type Bug, type Side, type Tile } from './pieces.ts';

/** The shell's two seats: White is seat 0, Black seat 1. */
export type Seat = 0 | 1;

export const sideOf = (seat: Seat): Side => (seat === 0 ? 'white' : 'black');
export const seatOf = (side: Side): Seat => (side === 'white' ? 0 : 1);

export type State = Readonly<{ game: Game; startedAt: number }>;
export type Action = Intent | Readonly<{ type: 'again' }>;

/** A tile of mine that may move, and where. */
export type Movable = Readonly<{ from: Hex; to: ReadonlyArray<Hex> }>;

/**
 * One seat's picture of the table: the whole game (nothing is hidden), and what the seat may do
 * now (empty off its turn): its placements, its movable tiles and whether it must pass.
 */
export type View = Readonly<{
  seat: Seat;
  names: Readonly<[string, string]>;
  game: Game;
  startedAt: number;
  placements: ReadonlyArray<Place>;
  movable: ReadonlyArray<Movable>;
  canPass: boolean;
}>;

export const namesOf = (names: Readonly<[string, string]>): Readonly<Record<Side, string>> => ({
  white: names[0],
  black: names[1],
});

/** A fresh game: White (the first name) to place first. */
export const createState = (names: Readonly<[string, string]>, now: () => number): State => ({
  game: newGame(namesOf(names)),
  startedAt: now(),
});

export const NOT_YOUR_TURN_MSG = 'Not your turn.';

/**
 * One seat's action. Every engine success advances a turn count or sets the result, and its
 * refusal only rewrites the note (engine.ts `refuse`), so an unchanged turn count and result is a
 * refusal and its note the reason.
 */
export const applyAction = (
  state: State,
  seat: Seat,
  action: Action,
  now: () => number,
): Result<State, string> => {
  const game = state.game;
  if (action.type === 'again') {
    if (game.result === null) return err('The game is still on.');
    return ok({ game: newGame(game.names), startedAt: now() });
  }
  if (sideOf(seat) !== game.turn) return err(NOT_YOUR_TURN_MSG);
  const next = apply(game, action);
  const moved =
    next.result !== game.result ||
    next.turns.white !== game.turns.white ||
    next.turns.black !== game.turns.black;
  if (!moved) return err(next.note);
  return ok({ game: next, startedAt: state.startedAt });
};

/** The tiles the side to move may lift, each with its destinations (none while its Queen is in hand). */
const movableOf = (game: Game): ReadonlyArray<Movable> =>
  occupied(game.board)
    .map((from): Movable => ({ from, to: legalMoves(game, from) }))
    .filter((m) => m.to.length > 0);

export const viewFor = (state: State, seat: Seat): View => {
  const game = state.game;
  const mine = sideOf(seat) === game.turn && game.result === null;
  return {
    seat,
    names: [game.names.white, game.names.black],
    game,
    startedAt: state.startedAt,
    placements: mine ? legalPlacements(game) : [],
    movable: mine ? movableOf(game) : [],
    canPass: mine && mustPass(game),
  };
};

/** The seat whose turn it is, or null once the game is over. */
export const turnSeat = (game: Game): Seat | null =>
  game.result === null ? seatOf(game.turn) : null;

/** The winning seat, or null (the game on, or drawn). */
export const winnerSeat = (result: Outcome | null): Seat | null =>
  result?.kind === 'win' ? seatOf(result.winner) : null;

/** What a guest may send: its placements, its moves, a pass when it must, a resign, Play again once over. */
export const legalActions = (view: View): ReadonlyArray<Action> => {
  if (view.game.result !== null) return [{ type: 'again' }];
  if (sideOf(view.seat) !== view.game.turn) return [];
  const moves = view.movable.flatMap((m) =>
    m.to.map((to): Move => ({ type: 'move', from: m.from, to })),
  );
  return [
    ...view.placements,
    ...moves,
    ...(view.canPass ? [{ type: 'pass' } as const] : []),
    { type: 'resign' },
  ];
};

// ---- the decoders ---------------------------------------------------------------------------

const seat: Decoder<Seat> = literal(0, 1);
const side: Decoder<Side> = literal(...SIDES);
const bug: Decoder<Bug> = literal(...BUGS);
const hex: Decoder<Hex> = object({ q: integer(), r: integer() });
const tile: Decoder<Tile> = object({ side, bug });
const hand = object({
  queen: integer(0),
  beetle: integer(0),
  grasshopper: integer(0),
  spider: integer(0),
  ant: integer(0),
});
const bySide = <T>(d: Decoder<T>): Decoder<Readonly<Record<Side, T>>> =>
  object({ white: d, black: d }) as unknown as Decoder<Readonly<Record<Side, T>>>;

/** A board: every key spells its hex, every stack is non-empty. */
const board: Decoder<Board> = (input) => {
  const decoded = record(arrayOf(tile))(input);
  if (!decoded.ok) return decoded;
  const bad = Object.entries(decoded.value).find(
    ([key, stack]: readonly [string, ReadonlyArray<Tile>]) =>
      stack.length === 0 || !/^-?\d+,-?\d+$/.test(key),
  );
  return bad === undefined
    ? decoded
    : err({ path: [bad[0]], expected: 'a hex key "q,r" with a non-empty stack' });
};

const outcome: Decoder<Outcome> = taggedUnion('kind', {
  win: object({ kind: literal('win'), winner: side, by: literal('surround', 'resign') }),
  draw: object({ kind: literal('draw') }),
});

const place: Decoder<Place> = object({ type: literal('place'), bug, to: hex });
const move: Decoder<Move> = object({ type: literal('move'), from: hex, to: hex });

export const decodeAction: Decoder<Action> = taggedUnion('type', {
  place,
  move,
  pass: object({ type: literal('pass') }),
  resign: object({ type: literal('resign') }),
  again: object({ type: literal('again') }),
});

const game: Decoder<Game> = object({
  names: bySide(string),
  board,
  hands: bySide(hand),
  turn: side,
  turns: bySide(integer(0)),
  result: nullable(outcome),
  note: string,
});

/** The two names, White's first. */
const names: Decoder<Readonly<[string, string]>> = (input) => {
  const pair = arrayOf(string)(input);
  if (!pair.ok) return pair;
  const [w, b] = pair.value;
  return w !== undefined && b !== undefined && pair.value.length === 2
    ? ok([w, b] as const)
    : err({ path: [], expected: 'two names' });
};

export const decodeView: Decoder<View> = object({
  seat,
  names,
  game,
  startedAt: integer(0),
  placements: arrayOf(place),
  movable: arrayOf(object({ from: hex, to: arrayOf(hex) })),
  canPass: literal(true, false),
});

/** The save's game and `position/load`'s hand-made object: the engine's state and the game's clock. */
export const decodeState: Decoder<State> = object({ game, startedAt: integer(0) });

/** The key a hex's cell carries on the board (`data-hex`), hex.ts's. */
export { keyOf };
