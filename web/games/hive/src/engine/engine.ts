// The Hive engine (docs/design/hive.md §4): a pure game for two on a grid with no edges. The state
// is the board (the stack of tiles on each occupied hex, bottom first), both hands, whose turn it
// is, how many turns each side has taken and the result. `legalPlacements` and `legalMoves` list
// what the side to move may do, and `apply` plays one intent (place, move, pass, resign) and returns
// the next state with a one-line note for the paint; an intent that does not apply leaves the
// state as it was and says why in the note. No randomness: the tests' bots bring their own Rng.
// Not here (§2): the expansions, the tournament opening rule, a draw by repetition (the page's
// draw button, a follow-up).
import {
  DIRECTIONS,
  ORIGIN,
  add,
  canStep,
  dedupe,
  distance,
  flood,
  hexOf,
  isConnected,
  keyOf,
  neighbours,
  route,
  sameHex,
  scale,
  walkEnds,
  walks,
  type Hex,
} from './hex.ts';
import {
  BUG,
  BUGS,
  FULL_HAND,
  SIDES,
  TILES_PER_SIDE,
  handSize,
  other,
  type Bug,
  type Hand,
  type Side,
  type Tile,
} from './pieces.ts';

/** The tiles on one hex, bottom first; the board never holds an empty one. */
export type Stack = ReadonlyArray<Tile>;

/** The occupied hexes, keyed `"q,r"` (hex.ts keyOf). */
export type Board = Readonly<Record<string, Stack>>;

export type Outcome =
  | Readonly<{ kind: 'win'; winner: Side; by: 'surround' | 'resign' }>
  /** Both Queens surrounded by the same turn. */
  | Readonly<{ kind: 'draw' }>;

export type Game = Readonly<{
  names: Readonly<Record<Side, string>>;
  board: Board;
  hands: Readonly<Record<Side, Hand>>;
  /** The side to move. */
  turn: Side;
  /** The turns each side has taken: placements, moves and passes. */
  turns: Readonly<Record<Side, number>>;
  /** Null while the game is on. */
  result: Outcome | null;
  /** What just happened, or why an intent was refused, for the status line. */
  note: string;
}>;

export type Place = Readonly<{ type: 'place'; bug: Bug; to: Hex }>;
export type Move = Readonly<{ type: 'move'; from: Hex; to: Hex }>;
export type Intent = Place | Move | Readonly<{ type: 'pass' }> | Readonly<{ type: 'resign' }>;

/** §4.2: a side's fourth tile is its Queen Bee if she is still in hand. */
export const QUEEN_BY = 4;

/** §4.6: the Spider's walk. */
export const SPIDER_STEPS = 3;

export const newGame = (names: Readonly<Record<Side, string>>): Game => ({
  names,
  board: {},
  hands: { white: FULL_HAND, black: FULL_HAND },
  turn: 'white',
  turns: { white: 0, black: 0 },
  result: null,
  note: '',
});

export const stackAt = (board: Board, h: Hex): Stack => board[keyOf(h)] ?? [];

export const heightAt = (board: Board, h: Hex): number => stackAt(board, h).length;

/** The tile on top of a hex: the one that moves and the one whose colour the stack is. */
export const topAt = (board: Board, h: Hex): Tile | undefined => stackAt(board, h).at(-1);

export const occupied = (board: Board): ReadonlyArray<Hex> => Object.keys(board).map(hexOf);

/** Every tile of `side` on the board, at any height. */
export const tilesOn = (board: Board, side: Side): number =>
  Object.values(board).reduce((n, stack) => n + stack.filter((t) => t.side === side).length, 0);

/** The hex holding `side`'s Queen Bee, at any height; none while she is in hand. */
export const queenAt = (board: Board, side: Side): Hex | undefined => {
  const found = Object.entries(board).find(([, stack]: readonly [string, Stack]) =>
    stack.some((t) => t.side === side && t.bug === 'queen'),
  );
  return found === undefined ? undefined : hexOf(found[0]);
};

/** All six neighbours occupied. */
export const isSurrounded = (board: Board, h: Hex): boolean =>
  neighbours(h).every((n) => heightAt(board, n) > 0);

const pushTile = (board: Board, h: Hex, tile: Tile): Board => ({
  ...board,
  [keyOf(h)]: [...stackAt(board, h), tile],
});

/** The board with the top tile of `h` lifted off (the hex left empty when it was alone). */
const liftTop = (board: Board, h: Hex): Board => {
  const key = keyOf(h);
  const stack = stackAt(board, h);
  return stack.length > 1
    ? { ...board, [key]: stack.slice(0, -1) }
    : Object.fromEntries(
        Object.entries(board).filter(([k]: readonly [string, Stack]) => k !== key),
      );
};

const queenDown = (game: Game, side: Side): boolean => game.hands[side].queen === 0;

/** §4.1: the empty hexes the side to move may place on. */
export const placementHexes = (game: Game): ReadonlyArray<Hex> => {
  const cells = occupied(game.board);
  if (cells.length === 0) return [ORIGIN];
  const empty = dedupe(cells.flatMap(neighbours)).filter((h) => heightAt(game.board, h) === 0);
  // A side's first tile only has to touch the hive: Black's first tile touches White's.
  if (handSize(game.hands[game.turn]) === TILES_PER_SIDE) return empty;
  const touches = (h: Hex, side: Side): boolean =>
    neighbours(h).some((n) => topAt(game.board, n)?.side === side);
  return empty.filter((h) => touches(h, game.turn) && !touches(h, other(game.turn)));
};

/** §4.2: the bugs the side to move may place: any left in hand, or the Queen alone on the fourth tile. */
export const placeableBugs = (game: Game): ReadonlyArray<Bug> => {
  const hand = game.hands[game.turn];
  const placed = TILES_PER_SIDE - handSize(hand);
  if (hand.queen > 0 && placed >= QUEEN_BY - 1) return ['queen'];
  return BUGS.filter((bug) => hand[bug] > 0);
};

/** Every placement the side to move may make (none once the game is over). */
export const legalPlacements = (game: Game): ReadonlyArray<Place> => {
  if (game.result !== null) return [];
  const bugs = placeableBugs(game);
  if (bugs.length === 0) return [];
  return placementHexes(game).flatMap((to) =>
    bugs.map((bug): Place => ({ type: 'place', bug, to })),
  );
};

/** The first empty hex past at least one tile, straight along `d` from `h`; none when `h` is empty. */
const jumpEnd = (board: Board, h: Hex, d: Hex, jumped: boolean): Hex | undefined => {
  if (heightAt(board, h) > 0) return jumpEnd(board, add(h, d), d, true);
  return jumped ? h : undefined;
};

const heightOn =
  (board: Board) =>
  (h: Hex): number =>
    heightAt(board, h);

/** The ground-level slides off `h` over `board`: the empty neighbours a tile may step to (hex.ts `canStep`). */
const slidesOn =
  (board: Board) =>
  (h: Hex): ReadonlyArray<Hex> =>
    neighbours(h).filter((n) => heightAt(board, n) === 0 && canStep(heightOn(board), h, n));

/** §4.5-§4.6: where a `bug` lifted off `from` may go over the board left behind. */
const destinations = (board: Board, from: Hex, bug: Bug): ReadonlyArray<Hex> => {
  const height = heightOn(board);
  const slides = slidesOn(board);
  switch (bug) {
    case 'queen':
      return slides(from);
    case 'beetle':
      return neighbours(from).filter((n) => canStep(height, from, n));
    case 'grasshopper':
      return DIRECTIONS.flatMap((d) => {
        const end = jumpEnd(board, add(from, d), d, false);
        return end === undefined ? [] : [end];
      });
    case 'spider':
      return walkEnds(from, SPIDER_STEPS, slides);
    case 'ant':
      return [...flood([from], slides).values()].filter((h) => !sameHex(h, from));
    default: {
      const never: never = bug;
      return never;
    }
  }
};

/**
 * §4.3-§4.6's gate on a move: the top tile at `from` and the board with it lifted off, when the
 * side to move may lift it: it is the mover's, the mover's Queen is down and lifting it leaves
 * one hive (§4.3: the hive never splits, not even mid-move; a Beetle lifted off a stack leaves
 * the stack, so it never splits it). None otherwise.
 */
const lifted = (game: Game, from: Hex): Readonly<{ tile: Tile; board: Board }> | undefined => {
  const tile = topAt(game.board, from);
  if (game.result !== null || tile?.side !== game.turn) return undefined;
  if (!queenDown(game, game.turn)) return undefined;
  const board = liftTop(game.board, from);
  if (heightAt(board, from) === 0 && !isConnected(occupied(board))) return undefined;
  return { tile, board };
};

/** §4.3-§4.6: where the top tile at `from` may move (`lifted`'s gate, then the bug's own reach). */
export const legalMoves = (game: Game, from: Hex): ReadonlyArray<Hex> => {
  const lift = lifted(game, from);
  return lift === undefined ? [] : destinations(lift.board, from, lift.tile.bug);
};

/**
 * §4.6: the Spider's walks off `from`, keyed by where they end (hex.ts `keyOf`): the three hexes
 * it steps on, in order, the last the destination; where several walks reach one hex, the first
 * found. Its keys are exactly `legalMoves(game, from)`; empty unless a Spider the side to move
 * may lift stands at `from`. The page reads the path to show 1-2-3 and to hop the tile along it.
 */
export const spiderPaths = (game: Game, from: Hex): ReadonlyMap<string, ReadonlyArray<Hex>> => {
  const lift = lifted(game, from);
  return lift?.tile.bug === 'spider' ? spiderWalks(lift.board, from) : new Map();
};

/** `spiderPaths` over the board with the Spider lifted off `from`, with no gate on whose turn it is. */
const spiderWalks = (board: Board, from: Hex): ReadonlyMap<string, ReadonlyArray<Hex>> => {
  const paths = walks(from, SPIDER_STEPS, slidesOn(board));
  const endOf = (path: ReadonlyArray<Hex>): string => keyOf(path[path.length - 1] ?? from);
  const firsts = paths.filter((path, i) => paths.findIndex((p) => endOf(p) === endOf(path)) === i);
  return new Map(firsts.map((path) => [endOf(path), path] as const));
};

/** The hexes a Grasshopper jumps over from `from` to `to`, a straight line along one of DIRECTIONS; none off a line. */
const crossed = (from: Hex, to: Hex): ReadonlyArray<Hex> => {
  const n = distance(from, to);
  if (n < 2) return [];
  const d = { q: (to.q - from.q) / n, r: (to.r - from.r) / n };
  if (!DIRECTIONS.some((dir) => sameHex(dir, d))) return [];
  return Array.from({ length: n - 1 }, (_, i) => add(from, scale(d, i + 1)));
};

/**
 * The hexes a move of `bug` from `from` to `to` walks, `from` first and `to` last, over `game`'s
 * board with the tile lifted off (the position the move was played from): the Spider's three-hex
 * path (`spiderPaths`); a Queen's or Beetle's one step (a Beetle's lands on top of whatever is
 * there); the Ant's shortest slide round the hive (hex.ts `route` over the same slides its reach
 * uses); the Grasshopper's straight line over every tile it jumps. `[from, to]` when no way is
 * found (a move the engine would not have allowed), so a caller always has the two ends. The page
 * crawls the tile along it (ui/motion.ts), one hop a hex.
 */
export const pathOf = (game: Game, from: Hex, to: Hex, bug: Bug): ReadonlyArray<Hex> => {
  const board = liftTop(game.board, from);
  const ends: ReadonlyArray<Hex> = [from, to];
  switch (bug) {
    case 'queen':
    case 'beetle':
      return ends;
    case 'grasshopper':
      return [from, ...crossed(from, to), to];
    case 'spider': {
      const path = spiderWalks(board, from).get(keyOf(to));
      return path === undefined ? ends : [from, ...path];
    }
    case 'ant':
      return route(from, to, slidesOn(board)) ?? ends;
    default: {
      const never: never = bug;
      return never;
    }
  }
};

/** Every placement and then every move the side to move may make. */
export const legalTurns = (game: Game): ReadonlyArray<Place | Move> => [
  ...legalPlacements(game),
  ...occupied(game.board).flatMap((from) =>
    legalMoves(game, from).map((to): Move => ({ type: 'move', from, to })),
  ),
];

/** §4.7: no legal placement and no legal move: the side to move passes. */
export const mustPass = (game: Game): boolean =>
  game.result === null && legalTurns(game).length === 0;

/** §4.8: a surrounded Queen loses; both surrounded by one turn is a draw. */
const outcomeOf = (board: Board): Outcome | null => {
  const lost = SIDES.filter((side) => {
    const queen = queenAt(board, side);
    return queen !== undefined && isSurrounded(board, queen);
  });
  const loser = lost[0];
  if (loser === undefined) return null;
  return lost.length > 1 ? { kind: 'draw' } : { kind: 'win', winner: other(loser), by: 'surround' };
};

const outcomeNote = (game: Game, result: Outcome): string =>
  result.kind === 'draw'
    ? 'Both Queens are surrounded: a draw.'
    : `${game.names[result.winner]} wins.`;

const refuse = (game: Game, note: string): Game => ({ ...game, note });

/** The turn is over: the other side moves next, unless the board has just ended the game. */
const endTurn = (game: Game, board: Board, hands: Game['hands'], note: string): Game => {
  const result = outcomeOf(board);
  const turns =
    game.turn === 'white'
      ? { ...game.turns, white: game.turns.white + 1 }
      : { ...game.turns, black: game.turns.black + 1 };
  return {
    ...game,
    board,
    hands,
    turn: other(game.turn),
    turns,
    result,
    note: result === null ? note : `${note} ${outcomeNote(game, result)}`,
  };
};

const placeRefusal = (game: Game, bug: Bug): string => {
  if (game.hands[game.turn][bug] === 0) return `No ${BUG[bug].name} left to place.`;
  if (!placeableBugs(game).includes(bug)) return 'Your fourth tile must be your Queen Bee.';
  return 'A new tile must touch your own tiles and none of the other colour.';
};

const place = (game: Game, bug: Bug, to: Hex): Game => {
  if (!legalPlacements(game).some((p) => p.bug === bug && sameHex(p.to, to))) {
    return refuse(game, placeRefusal(game, bug));
  }
  const hand = game.hands[game.turn];
  const spent: Hand = { ...hand, [bug]: hand[bug] - 1 };
  const hands =
    game.turn === 'white' ? { ...game.hands, white: spent } : { ...game.hands, black: spent };
  const board = pushTile(game.board, to, { side: game.turn, bug });
  return endTurn(game, board, hands, `${game.names[game.turn]} placed a ${BUG[bug].name}.`);
};

const moveRefusal = (game: Game, tile: Tile | undefined): string => {
  if (tile?.side !== game.turn) return 'Move a tile of your own colour.';
  if (!queenDown(game, game.turn)) return 'Place your Queen Bee before you move.';
  return `The ${BUG[tile.bug].name} cannot go there.`;
};

const move = (game: Game, from: Hex, to: Hex): Game => {
  const tile = topAt(game.board, from);
  if (tile === undefined || !legalMoves(game, from).some((h) => sameHex(h, to))) {
    return refuse(game, moveRefusal(game, tile));
  }
  const board = pushTile(liftTop(game.board, from), to, tile);
  return endTurn(
    game,
    board,
    game.hands,
    `${game.names[game.turn]} moved a ${BUG[tile.bug].name}.`,
  );
};

const pass = (game: Game): Game => {
  if (!mustPass(game))
    return refuse(game, 'You can still play: pass only with no tile to place and none to move.');
  return endTurn(game, game.board, game.hands, `${game.names[game.turn]} cannot play and passes.`);
};

const resign = (game: Game): Game => ({
  ...game,
  result: { kind: 'win', winner: other(game.turn), by: 'resign' },
  note: `${game.names[game.turn]} resigned. ${game.names[other(game.turn)]} wins.`,
});

/** One intent by the side to move; one that does not apply leaves the state and sets the note. */
export const apply = (game: Game, intent: Intent): Game => {
  if (game.result !== null) return refuse(game, 'The game is over.');
  switch (intent.type) {
    case 'place':
      return place(game, intent.bug, intent.to);
    case 'move':
      return move(game, intent.from, intent.to);
    case 'pass':
      return pass(game);
    case 'resign':
      return resign(game);
    default: {
      const never: never = intent;
      return never;
    }
  }
};
