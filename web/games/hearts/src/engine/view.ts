// Hearts's engine as the shared shell plays it (docs/design/hearts.md §3; web/shared/ui/shell.ts
// `ShellConfig.engine`): the host (or the phone) holds the whole `State`, each seat gets its `View`
// (the whole game here; a game that hides a hand cuts the other seat's out of `viewFor`). `State`
// wraps the engine's `Game` with the game's clock (the finished game's key in the device's history).
// `applyAction` refuses a play out of turn; `again` may come from either seat once the game is
// over. The decoders are the trust boundary for the wire and the save (docs/ARCHITECTURE.md
// "Module boundaries").
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
import type { Rng } from '../../../../shared/lib/rng.ts';
import { err, ok, type Result } from '../../../../shared/lib/result.ts';
import {
  apply,
  legalIntents,
  newGame,
  type Game,
  type Intent,
  type Names,
  type Outcome,
  type Seat,
} from './engine.ts';

export type { Seat };

export type State = Readonly<{ game: Game; startedAt: number }>;
export type Action = Intent | Readonly<{ type: 'again' }>;

/** One seat's picture of the table: the whole game, and what the seat may do now (empty off its turn). */
export type View = Readonly<{
  seat: Seat;
  names: Names;
  game: Game;
  startedAt: number;
  legal: ReadonlyArray<Intent>;
}>;

export const createState = (names: Names, now: () => number): State => ({
  game: newGame(names),
  startedAt: now(),
});

export const NOT_YOUR_TURN_MSG = 'Not your turn.';

export const applyAction = (
  state: State,
  seat: Seat,
  action: Action,
  rng: Rng,
  now: () => number,
): Result<State, string> => {
  const game = state.game;
  if (action.type === 'again') {
    if (game.result === null) return err('The game is still on.');
    return ok({ game: newGame(game.names), startedAt: now() });
  }
  if (game.result !== null) return err('The game is over.');
  if (seat !== game.turn) return err(NOT_YOUR_TURN_MSG);
  const next = apply(game, action, rng);
  return next.ok ? ok({ game: next.value, startedAt: state.startedAt }) : next;
};

export const viewFor = (state: State, seat: Seat): View => {
  const game = state.game;
  const mine = seat === game.turn && game.result === null;
  return {
    seat,
    names: game.names,
    game,
    startedAt: state.startedAt,
    legal: mine ? legalIntents(game) : [],
  };
};

/** The seat whose turn it is, or null once the game is over. */
export const turnSeat = (game: Game): Seat | null => (game.result === null ? game.turn : null);

/** The winning seat, or null (the game on, or drawn). */
export const winnerSeat = (result: Outcome | null): Seat | null =>
  result?.kind === 'win' ? result.winner : null;

/** What a guest may send: its legal intents, Play again once over. */
export const legalActions = (view: View): ReadonlyArray<Action> =>
  view.game.result !== null ? [{ type: 'again' }] : view.legal;

// ---- the decoders ---------------------------------------------------------------------------

const seat: Decoder<Seat> = literal(0, 1);

/** The two names, seat 0's first. */
const names: Decoder<Names> = (input) => {
  const pair = arrayOf(string)(input);
  if (!pair.ok) return pair;
  const [a, b] = pair.value;
  return a !== undefined && b !== undefined && pair.value.length === 2
    ? ok([a, b] as const)
    : err({ path: [], expected: 'two names' });
};

const outcome: Decoder<Outcome> = taggedUnion('kind', {
  win: object({ kind: literal('win'), winner: seat, by: literal('resign', 'luck') }),
  draw: object({ kind: literal('draw') }),
});

const intent: Decoder<Intent> = taggedUnion('type', {
  pass: object({ type: literal('pass') }),
  resign: object({ type: literal('resign') }),
});

export const decodeAction: Decoder<Action> = taggedUnion('type', {
  pass: object({ type: literal('pass') }),
  resign: object({ type: literal('resign') }),
  again: object({ type: literal('again') }),
});

const game: Decoder<Game> = object({
  names,
  turn: seat,
  turns: integer(0),
  result: nullable(outcome),
  note: string,
});

export const decodeView: Decoder<View> = object({
  seat,
  names,
  game,
  startedAt: integer(0),
  legal: arrayOf(intent),
});

/** The save's game and `position/load`'s hand-made object: the engine's state and the game's clock. */
export const decodeState: Decoder<State> = object({ game, startedAt: integer(0) });
