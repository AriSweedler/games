// The Hearts engine (docs/design/hearts.md §2-§6): the rules one case each from hand-built
// positions, and whole bot games at three and four seats with every card accounted for at every
// step (AGENT.md "A new game" step 2).
import { describe, expect, test } from 'vitest';

import { must } from '../../../../../test/shared/engine-helpers.ts';
import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { DECK, deckFor, pointsIn, sortHand } from './cards.ts';
import {
  GAME_END,
  actorOf,
  apply,
  deal,
  directionFor,
  isLegalPass,
  legalIntents,
  legalPlays,
  newGame,
  passSourceOf,
  passTargetOf,
  takerOf,
  winnersOf,
  type Game,
  type Intent,
} from './engine.ts';

const FOUR = ['Ann', 'Bob', 'Cat', 'Dan'] as const;
const THREE = ['Ann', 'Bob', 'Cat'] as const;

/** Every card of the table's deck is in exactly one place: a hand, the trick, or a taken pile. */
const everyCardOnce = (game: Game): void => {
  const all = [...game.hands.flat(), ...game.trick.plays.map((p) => p.card), ...game.taken.flat()];
  const deck = deckFor(game.names.length);
  expect(all).toHaveLength(deck.length);
  expect(new Set(all).size).toBe(deck.length);
};

/** The first legal intent of the seat to act (any seat's between hands). */
const botIntent = (game: Game): Intent => {
  const seat = actorOf(game) ?? 0;
  const first = legalIntents(game, seat)[0];
  if (first === undefined)
    throw new Error(`seat ${String(seat)} has nothing to do in ${game.phase}`);
  return first;
};

/** Plays on until the game is over, checking the counts at every step; `steps` guards a runaway. */
const botGame = (names: ReadonlyArray<string>, seed: number): Game => {
  const rng = mulberry32(seed);
  const play = (game: Game, steps: number): Game => {
    if (game.phase === 'gameOver') return game;
    if (steps === 0) throw new Error('the bot game did not end');
    if (game.phase !== 'handOver') everyCardOnce(game);
    return play(must(apply(game, botIntent(game), rng)), steps - 1);
  };
  return play(newGame(names, rng), 20_000);
};

/** A playing position built by hand: the hands given, the first trick open, hearts unbroken. */
const position = (hands: ReadonlyArray<ReadonlyArray<string>>, turn: number): Game => ({
  names: FOUR.slice(0, hands.length),
  phase: 'playing',
  round: 1,
  direction: 'left',
  hands: hands.map(sortHand),
  passes: hands.map(() => null),
  trick: { leader: turn, plays: [] },
  lastTrick: null,
  taken: hands.map(() => []),
  heartsBroken: false,
  turn,
  scores: hands.map(() => 0),
  handScores: null,
  moon: null,
  note: '',
});

const rng = mulberry32(3);

describe('Hearts: the deal and the pass', () => {
  test('four seats get 13 of 52; three get 17 of 51; the hands are sorted', () => {
    const four = newGame(FOUR, mulberry32(1));
    expect(four.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(four.hands.flat().sort()).toEqual([...DECK].sort());
    const three = newGame(THREE, mulberry32(1));
    expect(three.hands.map((h) => h.length)).toEqual([17, 17, 17]);
    expect(three.hands.flat()).not.toContain('2D');
    expect(four.hands[0]).toEqual(sortHand(four.hands[0] ?? []));
  });

  test('the rotation: left, right, across, hold at four; left, right, hold at three', () => {
    expect([1, 2, 3, 4, 5].map((r) => directionFor(4, r))).toEqual([
      'left',
      'right',
      'across',
      'hold',
      'left',
    ]);
    expect([1, 2, 3, 4].map((r) => directionFor(3, r))).toEqual(['left', 'right', 'hold', 'left']);
  });

  test('a hold hand skips the pass: the 2♣ holder leads at once', () => {
    const hold = deal(FOUR, mulberry32(2), 4, [0, 0, 0, 0]);
    expect(hold.direction).toBe('hold');
    expect(hold.phase).toBe('playing');
    expect(hold.hands[hold.turn]).toContain('2C');
    expect(legalPlays(hold, hold.turn)).toEqual(['2C']);
  });

  test('each seat passes three of its own, once; the cards land left, right or across, then the 2♣ leads', () => {
    const game = newGame(FOUR, mulberry32(5));
    expect(game.phase).toBe('passing');
    expect(game.direction).toBe('left');
    expect(passTargetOf(game, 3)).toBe(0);
    expect(passSourceOf(game, 0)).toBe(3);
    const hand0 = game.hands[0] ?? [];
    const ids = hand0.slice(0, 3);
    expect(isLegalPass(game, 0, ids)).toBe(true);
    expect(isLegalPass(game, 0, hand0.slice(0, 2))).toBe(false);
    expect(isLegalPass(game, 0, [ids[0] ?? '', ids[0] ?? '', ids[1] ?? ''])).toBe(false);
    expect(isLegalPass(game, 1, ids)).toBe(false);
    expect(apply(game, { type: 'play', id: ids[0] ?? '' }, rng)).toEqual({
      ok: false,
      error: 'No card is played now.',
    });
    const once = must(apply(game, { type: 'pass', seat: 0, ids }, rng));
    expect(once.passes[0]).toEqual(ids);
    expect(actorOf(once)).toBe(1);
    expect(apply(once, { type: 'pass', seat: 0, ids }, rng)).toEqual({
      ok: false,
      error: 'You have passed already.',
    });
    const all = [1, 2, 3].reduce<Game>((g) => must(apply(g, botIntent(g), rng)), once);
    expect(all.phase).toBe('playing');
    expect(all.hands[1]).toEqual(expect.arrayContaining(ids));
    expect(all.hands[0]).not.toEqual(expect.arrayContaining(ids));
    expect(all.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(all.hands[all.turn]).toContain('2C');
    expect(all.note).toBe(`${FOUR[all.turn] ?? ''} leads the 2♣.`);
  });
});

describe('Hearts: the play', () => {
  test('the 2♣ opens; no points on the first trick unless the hand holds nothing else', () => {
    const game = position(
      [
        ['2C', '5D', '9S', 'AH'],
        ['3C', 'QS', 'KH', '7D'],
        ['AH', 'KH', 'QS', 'JH'],
        ['4C', '8D', '6S', '2H'],
      ],
      0,
    );
    expect(legalPlays(game, 0)).toEqual(['2C']);
    expect(apply(game, { type: 'play', id: '5D' }, rng)).toEqual({
      ok: false,
      error: 'The 2♣ leads the first trick.',
    });
    const led = must(apply(game, { type: 'play', id: '2C' }, rng));
    expect(led.turn).toBe(1);
    expect(legalPlays(led, 1)).toEqual(['3C']);
    const two = must(apply(led, { type: 'play', id: '3C' }, rng));
    // Seat 2 has no club and only points: it may dump any of them.
    expect(legalPlays(two, 2)).toEqual(sortHand(['AH', 'KH', 'QS', 'JH']));
    const voidSeat = position(
      [
        ['2C', '5D'],
        ['3C', 'QS'],
        ['AH', '8D'],
        ['4C', '2H'],
      ],
      0,
    );
    const afterTwo = must(
      apply(
        must(apply(voidSeat, { type: 'play', id: '2C' }, rng)),
        { type: 'play', id: '3C' },
        rng,
      ),
    );
    expect(legalPlays(afterTwo, 2)).toEqual(['8D']);
    expect(apply(afterTwo, { type: 'play', id: 'AH' }, rng)).toEqual({
      ok: false,
      error: 'No points on the first trick.',
    });
  });

  test('follow suit when you can; a play out of turn or from outside the hand is refused', () => {
    const game = {
      ...position(
        [
          ['2C', '5D'],
          ['3C', 'QS'],
          ['AH', '8D'],
          ['4C', '2H'],
        ],
        0,
      ),
    };
    const led = must(apply(game, { type: 'play', id: '2C' }, rng));
    expect(apply(led, { type: 'play', id: 'QS' }, rng)).toEqual({
      ok: false,
      error: 'Follow suit.',
    });
    expect(apply(led, { type: 'play', id: 'AH' }, rng)).toEqual({
      ok: false,
      error: 'That card is not in your hand.',
    });
  });

  test('hearts may not be led until broken, unless only hearts remain; the highest of the suit led takes', () => {
    const base = position(
      [
        ['5D', 'AH', '2H'],
        ['KD', '3H', '4S'],
        ['9D', '5H', '6S'],
        ['2D', '7H', '8S'],
      ],
      0,
    );
    // Not the first trick any more: seat 0 took one.
    const game: Game = { ...base, taken: [['2C', '3C', '4C', '5C'], [], [], []] };
    expect(legalPlays(game, 0)).toEqual(['5D']);
    expect(apply(game, { type: 'play', id: 'AH' }, rng)).toEqual({
      ok: false,
      error: 'Hearts have not been broken.',
    });
    const trick = ['5D', 'KD', '9D', '2D'].reduce<Game>(
      (g, id) => must(apply(g, { type: 'play', id }, rng)),
      game,
    );
    expect(trick.lastTrick).toEqual({
      leader: 0,
      plays: [
        { seat: 0, card: '5D' },
        { seat: 1, card: 'KD' },
        { seat: 2, card: '9D' },
        { seat: 3, card: '2D' },
      ],
      taker: 1,
      points: 0,
    });
    expect(trick.turn).toBe(1);
    expect(trick.trick).toEqual({ leader: 1, plays: [] });
    expect(trick.note).toBe('Bob takes the trick.');
    // Seat 1 leads a heart? Not broken: only 4S. Seat 0 holding only hearts could lead one.
    expect(legalPlays(trick, 1)).toEqual(['4S']);
    const allHearts: Game = { ...trick, turn: 0, trick: { leader: 0, plays: [] } };
    expect(legalPlays(allHearts, 0)).toEqual(['2H', 'AH']);
    expect(
      takerOf([
        { seat: 2, card: '9D' },
        { seat: 3, card: 'AH' },
        { seat: 0, card: 'JD' },
      ]),
    ).toBe(0);
  });

  test('a heart dumped breaks hearts; a trick with points says who took what', () => {
    const base = position(
      [
        ['5D', '2S'],
        ['KD', '3S'],
        ['AH', '6S'],
        ['QS', '8S'],
      ],
      0,
    );
    const game: Game = { ...base, taken: [['2C', '3C', '4C', '5C'], [], [], []] };
    const trick = ['5D', 'KD', 'AH', 'QS'].reduce<Game>(
      (g, id) => must(apply(g, { type: 'play', id }, rng)),
      game,
    );
    expect(trick.heartsBroken).toBe(true);
    expect(trick.lastTrick?.taker).toBe(1);
    expect(trick.lastTrick?.points).toBe(14);
    expect(trick.taken[1]).toEqual(['5D', 'KD', 'AH', 'QS']);
    expect(trick.note).toBe('Bob takes the trick: 14 points.');
    expect(legalPlays(trick, 1)).toEqual(['3S']);
  });
});

describe("Hearts: the hand's end and the game's", () => {
  /** A one-trick hand: the last cards of each seat, the taken piles given. */
  const lastTrick = (
    hands: ReadonlyArray<ReadonlyArray<string>>,
    taken: ReadonlyArray<ReadonlyArray<string>>,
    scores: ReadonlyArray<number>,
  ): Game => ({ ...position(hands, 0), taken, scores, heartsBroken: true });

  test('the hand scores each heart 1 and the queen 13; Next hand deals on with the next direction', () => {
    const game = lastTrick(
      [['2H'], ['3H'], ['4H'], ['5H']],
      [['QS', '6H', '7H'], [], ['8H', '9H', '10H', 'JH', 'QH', 'KH', 'AH'], []],
      [10, 20, 30, 40],
    );
    const over = ['2H', '3H', '4H', '5H'].reduce<Game>(
      (g, id) => must(apply(g, { type: 'play', id }, rng)),
      game,
    );
    expect(over.phase).toBe('handOver');
    expect(over.handScores).toEqual([15, 0, 7, 4]);
    expect(over.scores).toEqual([25, 20, 37, 44]);
    expect(over.moon).toBeNull();
    expect(pointsIn(over.taken.flat())).toBe(26);
    expect(legalIntents(over, 2)).toEqual([{ type: 'nextHand' }]);
    expect(apply(over, { type: 'playAgain' }, rng)).toEqual({
      ok: false,
      error: 'The game is still on.',
    });
    const next = must(apply(over, { type: 'nextHand' }, mulberry32(9)));
    expect(next.round).toBe(2);
    expect(next.direction).toBe('right');
    expect(next.scores).toEqual([25, 20, 37, 44]);
    expect(next.handScores).toBeNull();
    expect(next.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
  });

  test('shooting the moon: 26 to every other seat, 0 to the shooter', () => {
    const game = lastTrick(
      [['AH'], ['3S'], ['4S'], ['5S']],
      [['QS', '2H', '3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H', 'JH', 'QH', 'KH'], [], [], []],
      [0, 0, 0, 0],
    );
    const over = ['AH', '3S', '4S', '5S'].reduce<Game>(
      (g, id) => must(apply(g, { type: 'play', id }, rng)),
      game,
    );
    expect(over.moon).toBe(0);
    expect(over.handScores).toEqual([0, 26, 26, 26]);
    expect(over.scores).toEqual([0, 26, 26, 26]);
    expect(over.note).toContain('Ann shot the moon!');
  });

  test('a seat at 100 ends the game; the lowest score wins, a tie shared; Play again starts over', () => {
    const game = lastTrick(
      [['2H'], ['3H'], ['4H'], ['5H']],
      [[], [], [], ['QS']],
      [50, 50, 90, GAME_END - 14],
    );
    const over = ['2H', '3H', '4H', '5H'].reduce<Game>(
      (g, id) => must(apply(g, { type: 'play', id }, rng)),
      game,
    );
    expect(over.phase).toBe('gameOver');
    expect(over.scores).toEqual([50, 50, 90, 103]);
    expect(winnersOf(over.scores)).toEqual([0, 1]);
    expect(over.note).toContain('Ann and Bob wins the game.');
    expect(legalIntents(over, 3)).toEqual([{ type: 'playAgain' }]);
    expect(apply(over, { type: 'nextHand' }, rng)).toEqual({
      ok: false,
      error: 'The hand is still on.',
    });
    const again = must(apply(over, { type: 'playAgain' }, mulberry32(4)));
    expect(again.round).toBe(1);
    expect(again.scores).toEqual([0, 0, 0, 0]);
    expect(again.phase).toBe('passing');
  });
});

describe('Hearts: whole bot games', () => {
  test.each([
    [4, 11],
    [4, 12],
    [3, 13],
    [3, 14],
  ])(
    '%i seats, seed %i: every card accounted for at every step, the same game for the same seed',
    (seats, seed) => {
      const names = seats === 3 ? THREE : FOUR;
      const game = botGame(names, seed);
      expect(game.phase).toBe('gameOver');
      expect(Math.max(...game.scores)).toBeGreaterThanOrEqual(GAME_END);
      expect(game.scores).toHaveLength(seats);
      expect(winnersOf(game.scores).length).toBeGreaterThan(0);
      expect(game.round).toBeGreaterThan(1);
      expect(botGame(names, seed)).toEqual(game);
    },
  );
});
