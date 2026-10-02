import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../../shared/lib/rng.ts';
import {
  QUEEN_BY,
  apply,
  heightAt,
  legalMoves,
  legalPlacements,
  legalTurns,
  mustPass,
  newGame,
  occupied,
  placeableBugs,
  placementHexes,
  queenAt,
  stackAt,
  tilesOn,
  type Board,
  type Game,
  type Intent,
} from './engine.ts';
import { ORIGIN, isConnected, keyOf, neighbours, type Hex } from './hex.ts';
import {
  BUG,
  BUGS,
  SIDES,
  TILES_PER_SIDE,
  handSize,
  type Bug,
  type Hand,
  type Side,
  type Tile,
} from './pieces.ts';

const NAMES = { white: 'Ari', black: 'Bea' } as const;
const h = (q: number, r: number): Hex => ({ q, r });
const keys = (hexes: ReadonlyArray<Hex>): ReadonlyArray<string> => hexes.map(keyOf).sort();

const LETTER: Readonly<Record<string, Bug>> = {
  Q: 'queen',
  B: 'beetle',
  G: 'grasshopper',
  S: 'spider',
  A: 'ant',
};
const tile = (code: string): Tile => ({
  side: code.startsWith('w') ? 'white' : 'black',
  bug: LETTER[code.slice(1)] ?? 'queen',
});

/**
 * A game over these stacks (`"q,r"` -> codes, bottom first): each hand holds what is not on the
 * board, and each side has taken a turn per tile it has down.
 */
const position = (
  stacks: Readonly<Record<string, ReadonlyArray<string>>>,
  turn: Side = 'white',
): Game => {
  const board: Board = Object.fromEntries(
    Object.entries(stacks).map(([key, codes]) => [key, codes.map(tile)]),
  );
  const down = Object.values(board).flat();
  const handOf = (side: Side): Hand =>
    Object.fromEntries(
      BUGS.map((bug) => [
        bug,
        BUG[bug].count - down.filter((t) => t.side === side && t.bug === bug).length,
      ]),
    ) as Hand;
  return {
    ...newGame(NAMES),
    board,
    hands: { white: handOf('white'), black: handOf('black') },
    turn,
    turns: { white: tilesOn(board, 'white'), black: tilesOn(board, 'black') },
  };
};

const place = (bug: Bug, to: Hex): Intent => ({ type: 'place', bug, to });
const move = (from: Hex, to: Hex): Intent => ({ type: 'move', from, to });
const play = (game: Game, intents: ReadonlyArray<Intent>): Game => intents.reduce(apply, game);

describe('placing (§4.1)', () => {
  test("White's first tile goes at the origin, Black's first touches it, then each touches its own colour only", () => {
    const start = newGame(NAMES);
    expect(start.turn).toBe('white');
    expect(legalPlacements(start).map((p) => p.bug)).toEqual(BUGS);
    expect(legalPlacements(start).every((p) => keyOf(p.to) === keyOf(ORIGIN))).toBe(true);
    const one = apply(start, place('spider', ORIGIN));
    expect(one.turn).toBe('black');
    expect(one.note).toBe('Ari placed a Spider.');
    expect(keys(placementHexes(one))).toEqual(keys(neighbours(ORIGIN)));
    const two = apply(one, place('queen', h(1, 0)));
    expect(keys(placementHexes(two))).toEqual(['-1,0', '-1,1', '0,-1']);
    expect(legalPlacements(two).every((p) => heightAt(two.board, p.to) === 0)).toBe(true);
    const refused = apply(two, place('ant', h(2, 0)));
    expect(refused.board).toBe(two.board);
    expect(refused.turn).toBe('white');
    expect(refused.note).toBe('A new tile must touch your own tiles and none of the other colour.');
  });

  test('a stack is the colour of its top tile: a white Ant under a black Beetle counts as black', () => {
    const game = position({ '0,0': ['wQ'], '1,0': ['bQ'], '-1,0': ['wA', 'bB'] });
    expect(placementHexes(game)).toEqual([]);
    expect(keys(placementHexes({ ...game, turn: 'black' }))).toEqual([
      '-1,-1',
      '-2,0',
      '-2,1',
      '1,1',
      '2,-1',
      '2,0',
    ]);
  });

  test('a bug with none left in hand is refused', () => {
    const game = position({ '0,0': ['wQ'], '1,0': ['bQ'] });
    expect(placeableBugs(game)).not.toContain('queen');
    expect(apply(game, place('queen', h(-1, 0))).note).toBe('No Queen Bee left to place.');
  });
});

describe('the Queen Bee by the fourth tile (§4.2)', () => {
  test('three tiles without her: the fourth must be the Queen, and nothing moves before she is down', () => {
    const three = play(newGame(NAMES), [
      place('spider', h(0, 0)),
      place('spider', h(1, 0)),
      place('ant', h(-1, 0)),
      place('ant', h(2, 0)),
      place('grasshopper', h(-2, 0)),
      place('grasshopper', h(3, 0)),
    ]);
    expect(three.turns).toEqual({ white: 3, black: 3 });
    expect(QUEEN_BY).toBe(4);
    expect(placeableBugs(three)).toEqual(['queen']);
    expect(legalPlacements(three).length).toBeGreaterThan(0);
    expect(legalPlacements(three).every((p) => p.bug === 'queen')).toBe(true);
    expect(apply(three, place('beetle', h(-3, 0))).note).toBe(
      'Your fourth tile must be your Queen Bee.',
    );
    // The Grasshopper could jump the row, but no tile of White's moves before her Queen is down.
    expect(legalMoves(three, h(-2, 0))).toEqual([]);
    expect(apply(three, move(h(-2, 0), h(4, 0))).note).toBe(
      'Place your Queen Bee before you move.',
    );
    const four = apply(three, place('queen', h(-3, 0)));
    expect(queenAt(four.board, 'white')).toEqual(h(-3, 0));
    expect(placeableBugs(four)).toEqual(['queen']);
  });
});

describe('each bug moves its own way (§4.5-§4.6)', () => {
  test('the Queen Bee slides one hex', () => {
    const game = position({ '0,0': ['wQ'], '1,0': ['bQ'] });
    expect(keys(legalMoves(game, h(0, 0)))).toEqual(['0,1', '1,-1']);
    const moved = apply(game, move(h(0, 0), h(0, 1)));
    expect(moved.note).toBe('Ari moved a Queen Bee.');
    expect(queenAt(moved.board, 'white')).toEqual(h(0, 1));
  });

  test('the Beetle steps one hex or climbs on, pinning the tile below; the stack is then its colour', () => {
    const game = position({ '-1,0': ['wB'], '0,0': ['wQ'], '1,0': ['bQ'] });
    expect(keys(legalMoves(game, h(-1, 0)))).toEqual(['-1,1', '0,-1', '0,0']);
    const up = apply(game, move(h(-1, 0), h(0, 0)));
    expect(stackAt(up.board, h(0, 0)).map((t) => t.bug)).toEqual(['queen', 'beetle']);
    expect(heightAt(up.board, h(-1, 0))).toBe(0);
    // Black's turn: the stack is White's now, so Black may not move it, and Black's Queen sees it.
    expect(legalMoves(up, h(0, 0))).toEqual([]);
    // A black Beetle on the white Queen: White cannot move that stack at all.
    const pinned = position({ '0,0': ['wQ', 'bB'], '1,0': ['bQ'], '-1,0': ['wA'] });
    expect(legalMoves(pinned, h(0, 0))).toEqual([]);
    expect(apply(pinned, move(h(0, 0), h(0, 1))).note).toBe('Move a tile of your own colour.');
  });

  test('on top the Beetle crosses the hive and drops in anywhere, except between two taller stacks', () => {
    const game = position({
      '0,0': ['wQ', 'wB'],
      '0,-1': ['bA', 'bB'],
      '-1,1': ['bG', 'bB'],
      '-1,0': ['wA'],
      '1,0': ['bQ'],
    });
    // (-1,0) lies between the two stacks of two: the Beetle at level 1 cannot pass.
    expect(keys(legalMoves(game, h(0, 0)))).toEqual(['-1,1', '0,-1', '0,1', '1,-1', '1,0']);
  });

  test('the Grasshopper jumps a straight row of tiles to the first empty hex, and never just steps', () => {
    const game = position({
      '-1,0': ['wG'],
      '0,0': ['wQ'],
      '1,0': ['bQ'],
      '2,0': ['bA'],
      '0,-1': ['wB'],
    });
    expect(keys(legalMoves(game, h(-1, 0)))).toEqual(['1,-2', '3,0']);
  });

  test('the Spider walks exactly three hexes around the hive and never back', () => {
    const game = position({ '-1,0': ['wS'], '0,0': ['wQ'], '1,0': ['bQ'] });
    expect(keys(legalMoves(game, h(-1, 0)))).toEqual(['1,1', '2,-1']);
  });

  test('the Soldier Ant goes anywhere around the hive it can slide to', () => {
    const game = position({ '-1,0': ['wA'], '0,0': ['wQ'], '1,0': ['bQ'] });
    expect(keys(legalMoves(game, h(-1, 0)))).toEqual([
      '-1,1',
      '0,-1',
      '0,1',
      '1,-1',
      '1,1',
      '2,-1',
      '2,0',
    ]);
  });
});

describe('Freedom to Move: no squeezing through a gap (§4.4)', () => {
  // A cup of five tiles around (0,0), open at (0,1): the two tiles beside the opening touch
  // both (0,0) and (0,1), so nothing slides in or out between them.
  const cup = { '1,0': ['wQ'], '1,-1': ['bQ'], '0,-1': ['bG'], '-1,0': ['bS'], '-1,1': ['wB'] };

  test('an Ant goes all the way around the cup but cannot slide into it', () => {
    const game = position({ ...cup, '2,0': ['wA'] });
    const reach = keys(legalMoves(game, h(2, 0)));
    expect(reach).toHaveLength(11);
    expect(reach).toContain('0,1');
    expect(reach).not.toContain('0,0');
  });

  test('a Queen in the cup cannot slide out; a Beetle there cannot either, but climbs out', () => {
    const queen = position({ ...cup, '1,0': ['wA'], '0,0': ['wQ'] });
    expect(legalMoves(queen, h(0, 0))).toEqual([]);
    const beetle = position({ ...cup, '0,0': ['wB'] });
    expect(keys(legalMoves(beetle, h(0, 0)))).toEqual(['-1,0', '-1,1', '0,-1', '1,-1', '1,0']);
  });
});

describe('One Hive (§4.3)', () => {
  test('a tile whose lifting splits the hive cannot move, even to a hex that would join it again', () => {
    // The Ant at (1,0) holds (0,0) and (1,1) together; (0,1) touches both.
    const game = position({ '0,0': ['wQ'], '1,0': ['wA'], '1,1': ['bQ'] });
    expect(isConnected([h(0, 0), h(1, 1), h(0, 1)])).toBe(true);
    expect(legalMoves(game, h(1, 0))).toEqual([]);
    expect(apply(game, move(h(1, 0), h(0, 1))).note).toBe('The Soldier Ant cannot go there.');
    // The Queen at the end of the line is free to go.
    expect(legalMoves(game, h(0, 0)).length).toBeGreaterThan(0);
  });
});

describe('passing (§4.7)', () => {
  test('no tile to place and none to move: the side passes; with a play left, a pass is refused', () => {
    // The white Queen sits in a black cup: her one empty neighbour is too narrow to slide to, and
    // every hex next to her touches black.
    const stuck = position({
      '0,0': ['wQ'],
      '1,0': ['bQ'],
      '1,-1': ['bB'],
      '0,-1': ['bG'],
      '-1,0': ['bS'],
      '-1,1': ['bA'],
    });
    expect(legalTurns(stuck)).toEqual([]);
    expect(mustPass(stuck)).toBe(true);
    const passed = apply(stuck, { type: 'pass' });
    expect(passed.turn).toBe('black');
    expect(passed.turns.white).toBe(stuck.turns.white + 1);
    expect(passed.note).toBe('Ari cannot play and passes.');
    const fresh = newGame(NAMES);
    expect(mustPass(fresh)).toBe(false);
    expect(apply(fresh, { type: 'pass' })).toEqual({
      ...fresh,
      note: 'You can still play: pass only with no tile to place and none to move.',
    });
  });
});

describe('the end (§4.8)', () => {
  test('a surrounded Queen loses, and nothing applies after', () => {
    const game = position(
      {
        '0,0': ['wQ'],
        '1,0': ['bQ'],
        '1,-1': ['bB'],
        '0,-1': ['bG'],
        '-1,0': ['bS'],
        '-1,1': ['bA'],
        '2,0': ['bA'],
      },
      'black',
    );
    const over = apply(game, move(h(2, 0), h(0, 1)));
    expect(over.result).toEqual({ kind: 'win', winner: 'black', by: 'surround' });
    expect(over.note).toBe('Bea moved a Soldier Ant. Bea wins.');
    expect(legalTurns(over)).toEqual([]);
    expect(mustPass(over)).toBe(false);
    expect(apply(over, { type: 'resign' })).toEqual({ ...over, note: 'The game is over.' });
  });

  test('both Queens surrounded by one move is a draw', () => {
    const game = position({
      '0,0': ['wQ'],
      '1,0': ['bQ'],
      '1,-1': ['wB'],
      '0,-1': ['wG'],
      '-1,0': ['wG'],
      '-1,1': ['wS'],
      '2,0': ['bG'],
      '2,-1': ['bA'],
      '1,1': ['bS'],
      '0,2': ['wA'],
    });
    const over = apply(game, move(h(0, 2), h(0, 1)));
    expect(over.result).toEqual({ kind: 'draw' });
    expect(over.note).toBe('Ari moved a Soldier Ant. Both Queens are surrounded: a draw.');
  });

  test('resigning hands the game to the other side', () => {
    const game = apply(newGame(NAMES), place('ant', ORIGIN));
    const over = apply(game, { type: 'resign' });
    expect(over.result).toEqual({ kind: 'win', winner: 'white', by: 'resign' });
    expect(over.note).toBe('Bea resigned. Ari wins.');
  });
});

describe('a seeded random bot game stays legal for 200 turns', () => {
  const CAP = 200;
  /** Seed 8's game ends in a surround before the cap; the others run to it. */
  const SEEDS = [1, 2, 8];
  type Step = Readonly<{ before: Game; intent: Intent; after: Game }>;

  /** The bot: any legal placement or move, uniformly; a pass when there is none. */
  const botGame = (seed: number): ReadonlyArray<Step> => {
    const rng = mulberry32(seed);
    return Array.from({ length: CAP }).reduce<ReadonlyArray<Step>>((steps) => {
      const before = steps[steps.length - 1]?.after ?? newGame(NAMES);
      if (before.result !== null) return steps;
      const options = legalTurns(before);
      const intent: Intent = options[Math.floor(rng() * options.length)] ?? { type: 'pass' };
      return [...steps, { before, intent, after: apply(before, intent) }];
    }, []);
  };
  const GAMES = SEEDS.map(botGame);

  test.each(SEEDS.map((seed, i) => [seed, GAMES[i] ?? []] as const))(
    'seed %i: every turn legal, every tile kept, one hive throughout',
    (_seed, steps) => {
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.length).toBeLessThanOrEqual(CAP);
      steps.forEach(({ before, intent, after }) => {
        // The intent came off the legal lists (a pass only when they were empty) and was taken.
        if (intent.type === 'pass') expect(mustPass(before)).toBe(true);
        else expect(legalTurns(before)).toContainEqual(intent);
        expect(after.turns[before.turn]).toBe(before.turns[before.turn] + 1);
        expect(after.turn).not.toBe(before.turn);
        SIDES.forEach((side) => {
          expect(tilesOn(after.board, side) + handSize(after.hands[side])).toBe(TILES_PER_SIDE);
          // The Queen is down by each side's fourth tile.
          if (TILES_PER_SIDE - handSize(after.hands[side]) >= QUEEN_BY) {
            expect(after.hands[side].queen).toBe(0);
          }
        });
        expect(isConnected(occupied(after.board))).toBe(true);
        Object.values(after.board).forEach((stack) => {
          expect(stack.length).toBeGreaterThan(0);
          // Only Beetles climb: every tile above the ground is one.
          expect(stack.slice(1).every((t) => t.bug === 'beetle')).toBe(true);
        });
      });
      const last = steps[steps.length - 1]?.after;
      expect(last?.result !== null || steps.length === CAP).toBe(true);
    },
  );

  test('the bots play whole games: every tile goes down, tiles move and climb, and a game ends', () => {
    const lasts = GAMES.map((steps) => steps[steps.length - 1]?.after ?? newGame(NAMES));
    const kinds = new Set(GAMES.flat().map((step) => step.intent.type));
    expect(kinds).toEqual(new Set(['place', 'move']));
    expect(lasts.every((g) => SIDES.every((side) => handSize(g.hands[side]) === 0))).toBe(true);
    expect(lasts.some((g) => Object.values(g.board).some((stack) => stack.length > 1))).toBe(true);
    expect(lasts.map((g) => g.result)).toEqual([
      null,
      null,
      { kind: 'win', winner: 'white', by: 'surround' },
    ]);
  });
});
