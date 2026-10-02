// The engine as the shared shell takes it (docs/design/flip7.md §8; web/shared/ui/shell.ts
// `ShellConfig.engine`): the state is the engine's game plus the deal's clock (`startedAt`, the
// finished game's key in the recent games), an action is the engine's intent, and every action
// goes through `applyAction` with the seat that sent it, so turn authority lives here: the seat
// whose turn it is hits or stays, the seat that flipped an action card gives it, and the host
// (seat 0) deals the next round. Every card on the table is face up, so a seat's view is the
// whole table with the two piles cut to their counts (the draw pile's order is the one secret).
// The decoders read a save (`decodeState`) and the wire (`decodeView`, `decodeAction`).
import {
  arrayOf,
  integer,
  literal,
  nullable,
  number,
  object,
  string,
  taggedUnion,
  type Decoder,
} from '../../../../shared/lib/json.ts';
import { err, ok, type Result } from '../../../../shared/lib/result.ts';
import type { Rng } from '../../../../shared/lib/rng.ts';
import type { Card, Kind } from './cards.ts';
import {
  apply,
  canHit,
  canStay,
  deal,
  type Game,
  type Intent,
  type Pending,
  type Phase,
  type Seat,
  type Status,
} from './engine.ts';

export type { Game, Intent, Phase, Seat, Status };

/** A seat's name off anything with the seats: the state, or a view. */
export const nameOf = (table: Readonly<{ seats: ReadonlyArray<Seat> }>, seat: number): string =>
  table.seats[seat]?.name ?? '';

/** The seats a table holds online and on one phone (the shell's `seats`): two to twelve (the owner, 2026-10-02). */
export const SEAT_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type SeatCount = (typeof SEAT_COUNTS)[number];
export const MIN_SEATS = 2;
export const MAX_SEATS = 12;
/** The highest seat index. */
export const MAX_SEAT = MAX_SEATS - 1;

export type Action = Intent;
export type State = Game & Readonly<{ startedAt: number }>;

/** What one seat sees: everything but the piles' order, and which seat is mine. */
export type View = Omit<Game, 'draw' | 'discard'> &
  Readonly<{ me: number; drawCount: number; discardCount: number; startedAt: number }>;

/** The deal over `names` (the host first online), round 1 ready. */
export const createGame = (names: ReadonlyArray<string>, rng: Rng, now: () => number): State => ({
  ...deal(names, rng),
  startedAt: now(),
});

/** Who acts now: the turn's seat, the drawer of an action card that needs a taker, the host between rounds; nobody once the game is over. */
export const actorOf = (game: Pick<Game, 'phase' | 'turn'>): number | null => {
  switch (game.phase.kind) {
    case 'turn':
      return game.turn;
    case 'target':
      return game.phase.from;
    case 'roundOver':
      return 0;
    case 'gameOver':
      return null;
  }
};

export const NOT_YOUR_TURN_MSG = 'Not your turn.';

/** Why `action` does not apply now, or null when it does. */
const refusalOf = (game: Game, action: Action): string | null => {
  switch (action.type) {
    case 'hit':
      return canHit(game) ? null : 'Not now.';
    case 'stay':
      return canStay(game) ? null : game.opening > 0 ? 'The deal comes first.' : 'Not now.';
    case 'give':
      return game.phase.kind === 'target' && game.phase.choices.includes(action.seat)
        ? null
        : `${nameOf(game, action.seat)} cannot take it.`;
    case 'nextRound':
      return game.phase.kind === 'roundOver' ? null : 'The round is not over.';
  }
};

/** One seat's action: refused when it is not that seat's to take or does not apply now. */
export const applyAction = (
  game: State,
  seat: number,
  action: Action,
  rng: Rng,
): Result<State, string> => {
  if (actorOf(game) !== seat) return err(NOT_YOUR_TURN_MSG);
  const refused = refusalOf(game, action);
  if (refused !== null) return err(refused);
  return ok({ ...apply(game, action, rng), startedAt: game.startedAt });
};

export const viewFor = (game: State, seat: number): View => {
  const { draw, discard, ...open } = game;
  return { ...open, me: seat, drawCount: draw.length, discardCount: discard.length };
};

/** The view's own seat may act now. */
export const isMyTurn = (view: View): boolean => actorOf(view) === view.me;

// ---- the decoders (a save, the wire) ----------------------------------------------------------

const KINDS: ReadonlyArray<Kind> = ['number', 'freeze', 'flip3', 'second', 'plus', 'times2'];
const STATUSES: ReadonlyArray<Status> = ['active', 'stayed', 'frozen', 'busted', 'flip7'];
const seatIndex = integer(0, MAX_SEAT);

const card: Decoder<Card> = object({
  id: string,
  kind: literal(...KINDS),
  value: nullable(integer(0, 12)),
});
const cards = arrayOf(card);
const seat: Decoder<Seat> = object({ name: string, line: cards, status: literal(...STATUSES) });
const pending: Decoder<Pending> = object({ card, from: seatIndex });
const phase: Decoder<Phase> = taggedUnion('kind', {
  turn: object({ kind: literal('turn') }),
  target: object({
    kind: literal('target'),
    card,
    from: seatIndex,
    choices: arrayOf(seatIndex),
  }),
  roundOver: object({ kind: literal('roundOver') }),
  gameOver: object({ kind: literal('gameOver'), winner: seatIndex }),
});

const table = {
  seats: arrayOf(seat),
  dealer: seatIndex,
  turn: seatIndex,
  opening: integer(0, MAX_SEAT + 1),
  flip3: nullable(object({ seat: seatIndex, left: integer(0, 3) })),
  pending: arrayOf(pending),
  phase,
  scores: arrayOf(integer(0)),
  target: integer(1),
  round: integer(1),
  note: string,
  startedAt: number,
};

export const decodeState: Decoder<State> = object({ ...table, draw: cards, discard: cards });

export const decodeView: Decoder<View> = object({
  ...table,
  me: seatIndex,
  drawCount: integer(0),
  discardCount: integer(0),
});

export const decodeAction: Decoder<Action> = taggedUnion('type', {
  hit: object({ type: literal('hit') }),
  stay: object({ type: literal('stay') }),
  give: object({ type: literal('give'), seat: seatIndex }),
  nextRound: object({ type: literal('nextRound') }),
});

/** What the view's own seat may do now (the test hook's `legal()`): nothing when it is not mine. */
export const legalActions = (view: View): ReadonlyArray<Action> => {
  if (!isMyTurn(view)) return [];
  switch (view.phase.kind) {
    case 'turn':
      return view.opening > 0 ? [{ type: 'hit' }] : [{ type: 'hit' }, { type: 'stay' }];
    case 'target':
      return view.phase.choices.map((seat): Action => ({ type: 'give', seat }));
    case 'roundOver':
      return [{ type: 'nextRound' }];
    case 'gameOver':
      return [];
  }
};
