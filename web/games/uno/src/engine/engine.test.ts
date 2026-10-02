import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { COLORS, idsOf, makeDeck, type Card, type Cards } from './cards.ts';
import {
  DEFAULT_TARGET,
  HAND_SIZE,
  MAX_PLAYERS,
  apply,
  cardCount,
  cardName,
  currentHand,
  deal,
  handOf,
  nextSeat,
  playableIds,
  seatAfter,
  topOf,
  type Game,
} from './engine.ts';

const DECK = makeDeck();
const byId = (id: string): Card => {
  const card = DECK.find((c) => c.id === id);
  if (card === undefined) throw new Error(`no card ${id}`);
  return card;
};
const cards = (...ids: ReadonlyArray<string>): Cards => ids.map(byId);

/** A hand-built position: hands by id, the top discard, the active colour, the turn and the pile. */
const scenario = (
  over: Omit<Partial<Game>, 'hands'> &
    Readonly<{ hands: ReadonlyArray<ReadonlyArray<string>>; top: string }>,
): Game => {
  const names = over.names ?? over.hands.map((_, i) => `P${String(i + 1)}`);
  const { hands, top: topId, ...rest } = over;
  const top = byId(topId);
  return {
    names,
    hands: hands.map((ids) => cards(...ids)),
    draw: cards('g5a', 'y9b', 'b2a', 'r3a'),
    discard: [top],
    color: top.color ?? 'red',
    turn: 0,
    direction: 1,
    phase: { kind: 'turn' },
    scores: names.map(() => 0),
    target: DEFAULT_TARGET,
    round: 1,
    note: '',
    ...rest,
  };
};

const rng = mulberry32(7);

describe('deal (§3)', () => {
  test('seven cards each, one card opens the pile, the rest is the draw pile, 108 in all', () => {
    const game = deal(['Ari', 'Bea', 'Cy'], mulberry32(1));
    expect(game.hands.map((h) => h.length)).toEqual([7, 7, 7]);
    expect(game.discard).toHaveLength(1);
    expect(game.draw).toHaveLength(108 - 21 - 1);
    expect(cardCount(game)).toBe(108);
    expect(
      new Set([...game.hands.flat(), ...game.draw, ...game.discard].map((c) => c.id)).size,
    ).toBe(108);
    expect(game.round).toBe(1);
    expect(game.scores).toEqual([0, 0, 0]);
  });

  test('twelve players, the largest table: 84 cards dealt, the opener, a stock of 23', () => {
    expect(MAX_PLAYERS).toBe(12);
    const names = Array.from({ length: MAX_PLAYERS }, (_, i) => `P${String(i + 1)}`);
    const game = deal(names, mulberry32(4));
    expect(game.hands.map((h) => h.length)).toEqual(names.map(() => HAND_SIZE));
    expect(game.draw.length + game.discard.length).toBe(108 - 84);
    expect(cardCount(game)).toBe(108);
  });

  test('the opener is never a Wild Draw Four, over many shuffles; its colour is the active one', () => {
    Array.from({ length: 200 }, (_, seed) => deal(['A', 'B'], mulberry32(seed))).forEach((game) => {
      expect(topOf(game).kind).not.toBe('wild4');
      if (topOf(game).color !== null) expect(game.color).toBe(topOf(game).color);
      expect(cardCount(game)).toBe(108);
    });
  });

  test('the opener puts a Wild Draw Four back: the first other card opens and the four stays in the pile', () => {
    // Find a seed whose first post-deal card is a Wild Draw Four and check it was skipped over.
    const seeds = Array.from({ length: 2000 }, (_, i) => i);
    const found = seeds.find((seed) => {
      const sorted = [...makeDeck()];
      const game = deal(['A', 'B'], mulberry32(seed));
      return (
        sorted.length === 108 &&
        game.draw.filter((c) => c.kind === 'wild4').length === 4 &&
        topOf(game).kind !== 'wild4'
      );
    });
    expect(found).toBeDefined();
  });

  test('a first-card Skip skips the first player', () => {
    const skipFirst = Array.from({ length: 3000 }, (_, i) => i).find((seed) => {
      const g = deal(['A', 'B', 'C'], mulberry32(seed));
      return topOf(g).kind === 'skip';
    });
    expect(skipFirst).toBeDefined();
    const game = deal(['A', 'B', 'C'], mulberry32(skipFirst ?? 0));
    expect(game.turn).toBe(1);
    expect(game.note).toContain('Skip');
  });

  test('a first-card Reverse makes the dealer (the last seat) first and turns play around; at two players the other starts', () => {
    const seedFor = (names: ReadonlyArray<string>): number | undefined =>
      Array.from({ length: 3000 }, (_, i) => i).find(
        (seed) => topOf(deal(names, mulberry32(seed))).kind === 'reverse',
      );
    const three = deal(['A', 'B', 'C'], mulberry32(seedFor(['A', 'B', 'C']) ?? 0));
    expect(three.turn).toBe(2);
    expect(three.direction).toBe(-1);
    const two = deal(['A', 'B'], mulberry32(seedFor(['A', 'B']) ?? 0));
    expect(two.turn).toBe(1);
    expect(two.direction).toBe(1);
  });

  test('a first-card Draw Two deals the first player two and skips them', () => {
    const seed = Array.from({ length: 3000 }, (_, i) => i).find(
      (s) => topOf(deal(['A', 'B', 'C'], mulberry32(s))).kind === 'draw2',
    );
    const game = deal(['A', 'B', 'C'], mulberry32(seed ?? 0));
    expect(handOf(game, 0)).toHaveLength(9);
    expect(game.turn).toBe(1);
    expect(cardCount(game)).toBe(108);
  });

  test('a first-card Wild asks the first player for the colour, who then plays', () => {
    const seed = Array.from({ length: 3000 }, (_, i) => i).find(
      (s) => topOf(deal(['A', 'B'], mulberry32(s))).kind === 'wild',
    );
    const game = deal(['A', 'B'], mulberry32(seed ?? 0));
    expect(game.phase).toEqual({ kind: 'color', card: topOf(game) });
    expect(playableIds(game)).toEqual([]);
    const named = apply(game, { type: 'color', color: 'blue' }, rng);
    expect(named.color).toBe('blue');
    expect(named.turn).toBe(0);
    expect(named.phase).toEqual({ kind: 'turn' });
  });
});

describe('seats', () => {
  test('seatAfter wraps both ways', () => {
    const game = scenario({ hands: [['r1a'], ['r1b'], ['r2a']], top: 'r5a' });
    expect(seatAfter(game, 2)).toBe(0);
    expect(seatAfter(game, 0, 2)).toBe(2);
    expect(seatAfter({ ...game, direction: -1 }, 0)).toBe(2);
    expect(nextSeat({ ...game, turn: 1, direction: -1 })).toBe(0);
  });
});

describe('playing a card (§3, §4)', () => {
  test('a matching number passes the turn and recolours the pile', () => {
    const game = scenario({
      hands: [
        ['b5a', 'r7a'],
        ['y1a', 'y2a'],
      ],
      top: 'r5a',
    });
    expect(playableIds(game)).toEqual(['b5a', 'r7a']);
    const next = apply(game, { type: 'play', id: 'b5a' }, rng);
    expect(topOf(next).id).toBe('b5a');
    expect(next.color).toBe('blue');
    expect(next.turn).toBe(1);
    expect(idsOf(handOf(next, 0))).toEqual(['r7a']);
    expect(next.note).toBe('P1 played blue 5.');
  });

  test('a card that does not match is refused with a note and nothing moves', () => {
    const game = scenario({ hands: [['g2a', 'y3a'], ['y1a']], top: 'r5a' });
    const next = apply(game, { type: 'play', id: 'g2a' }, rng);
    expect(next.hands).toEqual(game.hands);
    expect(next.turn).toBe(0);
    expect(next.note).toBe('green 2 does not match.');
    expect(apply(game, { type: 'play', id: 'y1a' }, rng).note).toBe(
      'That card is not in your hand.',
    );
  });

  test('Skip jumps the next seat', () => {
    const game = scenario({ hands: [['rSa', 'r1a'], ['y1a'], ['y2a']], top: 'r5a' });
    const next = apply(game, { type: 'play', id: 'rSa' }, rng);
    expect(next.turn).toBe(2);
    expect(next.note).toBe('P1 played red Skip: P2 is skipped.');
  });

  test('Reverse turns the direction at three; at two it is a Skip', () => {
    const three = scenario({ hands: [['rRa', 'r1a'], ['y1a'], ['y2a']], top: 'r5a' });
    const turned = apply(three, { type: 'play', id: 'rRa' }, rng);
    expect(turned.direction).toBe(-1);
    expect(turned.turn).toBe(2);
    const two = scenario({ hands: [['rRa', 'r1a'], ['y1a']], top: 'r5a' });
    const again = apply(two, { type: 'play', id: 'rRa' }, rng);
    expect(again.turn).toBe(0);
    expect(again.direction).toBe(1);
    expect(again.note).toContain('goes again');
  });

  test('Draw Two deals the next seat two and skips it; the pile shrinks by two', () => {
    const game = scenario({ hands: [['rDa', 'r1a'], ['y1a'], ['y2a']], top: 'r5a' });
    const next = apply(game, { type: 'play', id: 'rDa' }, rng);
    expect(handOf(next, 1)).toHaveLength(3);
    expect(next.draw).toHaveLength(2);
    expect(next.turn).toBe(2);
    expect(cardCount(next)).toBe(cardCount(game));
  });

  test('a Wild waits for its colour; the named colour rules and the turn passes', () => {
    const game = scenario({ hands: [['W1', 'r1a'], ['y1a'], ['y2a']], top: 'g5a', color: 'green' });
    const waiting = apply(game, { type: 'play', id: 'W1' }, rng);
    expect(waiting.phase).toEqual({ kind: 'color', card: byId('W1') });
    expect(waiting.turn).toBe(0);
    expect(waiting.color).toBe('green');
    expect(playableIds(waiting)).toEqual([]);
    // Other intents wait too.
    expect(apply(waiting, { type: 'draw' }, rng).note).toBe('Not now.');
    expect(apply(waiting, { type: 'play', id: 'r1a' }, rng).note).toBe('Not now.');
    const named = apply(waiting, { type: 'color', color: 'yellow' }, rng);
    expect(named.color).toBe('yellow');
    expect(named.turn).toBe(1);
    expect(named.phase).toEqual({ kind: 'turn' });
    expect(playableIds(named)).toEqual(['y1a']);
  });

  test('Wild Draw Four: the colour is named, then the next seat draws four and is skipped', () => {
    const game = scenario({
      hands: [['F1', 'r1a'], ['y1a'], ['y2a']],
      top: 'g5a',
      color: 'green',
      draw: cards('b1a', 'b2a', 'b3a', 'b4a', 'b6a'),
    });
    const named = apply(
      apply(game, { type: 'play', id: 'F1' }, rng),
      { type: 'color', color: 'red' },
      rng,
    );
    expect(named.color).toBe('red');
    expect(handOf(named, 1)).toHaveLength(5);
    expect(named.draw).toHaveLength(1);
    expect(named.turn).toBe(2);
    expect(named.note).toBe('P1 named red: P2 draws four and is skipped.');
  });

  test('naming a colour with no wild waiting is refused', () => {
    const game = scenario({ hands: [['r1a'], ['y1a']], top: 'r5a' });
    expect(apply(game, { type: 'color', color: 'red' }, rng).note).toBe('No colour to name.');
  });

  test('cardName spells every kind', () => {
    expect(['r0', 'rSa', 'rRa', 'rDa', 'W1', 'F1'].map((id) => cardName(byId(id)))).toEqual([
      'red 0',
      'red Skip',
      'red Reverse',
      'red Draw Two',
      'Wild',
      'Wild Draw Four',
    ]);
  });
});

describe('drawing (§3)', () => {
  test('a drawn card that plays may be played, and only it', () => {
    const game = scenario({ hands: [['g2a'], ['y1a']], top: 'r5a', draw: cards('r9a') });
    const drawn = apply(game, { type: 'draw' }, rng);
    expect(drawn.phase).toEqual({ kind: 'drawn', card: byId('r9a') });
    expect(playableIds(drawn)).toEqual(['r9a']);
    expect(apply(drawn, { type: 'play', id: 'g2a' }, rng).note).toBe(
      'Play the card you drew, or pass.',
    );
    const played = apply(drawn, { type: 'play', id: 'r9a' }, rng);
    expect(topOf(played).id).toBe('r9a');
    expect(played.turn).toBe(1);
  });

  test('a drawn card may be kept: pass ends the turn', () => {
    const game = scenario({ hands: [['g2a'], ['y1a']], top: 'r5a', draw: cards('r9a') });
    const kept = apply(apply(game, { type: 'draw' }, rng), { type: 'pass' }, rng);
    expect(idsOf(handOf(kept, 0))).toEqual(['g2a', 'r9a']);
    expect(kept.turn).toBe(1);
    expect(kept.note).toBe('P1 keeps the card and passes.');
  });

  test('a drawn card that does not play ends the turn at once', () => {
    const game = scenario({ hands: [['g2a'], ['y1a']], top: 'r5a', draw: cards('b9a') });
    const drawn = apply(game, { type: 'draw' }, rng);
    expect(drawn.phase).toEqual({ kind: 'turn' });
    expect(drawn.turn).toBe(1);
    expect(idsOf(handOf(drawn, 0))).toEqual(['g2a', 'b9a']);
  });

  test('pass without a drawn card is refused', () => {
    const game = scenario({ hands: [['g2a'], ['y1a']], top: 'r5a' });
    expect(apply(game, { type: 'pass' }, rng).note).toBe('Draw first.');
  });

  test('an empty draw pile reshuffles the discards under the top card', () => {
    const game = scenario({
      hands: [['g2a'], ['y1a']],
      top: 'r5a',
      draw: [],
      discard: cards('b1a', 'b2a', 'b3a', 'r5a'),
    });
    const drawn = apply(game, { type: 'draw' }, mulberry32(3));
    expect(topOf(drawn).id).toBe('r5a');
    expect(drawn.discard).toHaveLength(1);
    expect(handOf(drawn, 0)).toHaveLength(2);
    expect(drawn.draw).toHaveLength(2);
    expect(cardCount(drawn)).toBe(cardCount(game));
  });

  test('nothing left to draw at all: the turn passes', () => {
    const game = scenario({
      hands: [['g2a'], ['y1a']],
      top: 'r5a',
      draw: [],
      discard: cards('r5a'),
    });
    const next = apply(game, { type: 'draw' }, rng);
    expect(next.turn).toBe(1);
    expect(next.note).toBe('No cards left to draw: P1 passes.');
    expect(cardCount(next)).toBe(cardCount(game));
  });
});

describe('the round and the game (§5, §6)', () => {
  test('going out ends the round; the winner takes the others points', () => {
    const game = scenario({ hands: [['r1a'], ['y1a', 'ySa'], ['W1']], top: 'r5a' });
    const over = apply(game, { type: 'play', id: 'r1a' }, rng);
    expect(over.phase).toEqual({ kind: 'roundOver', winner: 0, gained: 1 + 20 + 50 });
    expect(over.scores).toEqual([71, 0, 0]);
    expect(over.note).toBe('P1 goes out and takes 71 points.');
    expect(playableIds(over)).toEqual([]);
    expect(apply(over, { type: 'draw' }, rng).note).toBe('Not now.');
  });

  test('going out on an action card scores before the action; a wild out needs no colour', () => {
    const game = scenario({ hands: [['W1'], ['y1a']], top: 'r5a' });
    const over = apply(game, { type: 'play', id: 'W1' }, rng);
    expect(over.phase.kind).toBe('roundOver');
    expect(over.scores).toEqual([1, 0]);
  });

  test('the next round deals again, keeps the scores, counts the round', () => {
    const game = scenario({ hands: [['r1a'], ['y1a']], top: 'r5a', names: ['Ari', 'Bea'] });
    const over = apply(game, { type: 'play', id: 'r1a' }, rng);
    const next = apply(over, { type: 'nextRound' }, mulberry32(9));
    expect(next.round).toBe(2);
    expect(next.scores).toEqual([1, 0]);
    expect(next.hands.map((h) => h.length)).toEqual([HAND_SIZE, HAND_SIZE]);
    expect(cardCount(next)).toBe(108);
    expect(next.names).toEqual(['Ari', 'Bea']);
    expect(apply(next, { type: 'nextRound' }, rng).note).toBe('The round is not over.');
  });

  test('reaching the target ends the game', () => {
    const game = scenario({ hands: [['r1a'], ['F1']], top: 'r5a', scores: [460, 0], target: 500 });
    const over = apply(game, { type: 'play', id: 'r1a' }, rng);
    expect(over.phase).toEqual({ kind: 'gameOver', winner: 0 });
    expect(over.scores).toEqual([510, 0]);
    expect(over.note).toBe('P1 wins the game with 510 points.');
  });
});

describe('a whole game plays out with a simple bot (every state consistent)', () => {
  /** Play the first playable card, else draw and play the drawn card if allowed, else pass. */
  const step = (game: Game, r: () => number): Game => {
    switch (game.phase.kind) {
      case 'turn': {
        const ids = playableIds(game);
        return ids.length > 0
          ? apply(game, { type: 'play', id: ids[0] ?? '' }, r)
          : apply(game, { type: 'draw' }, r);
      }
      case 'drawn':
        return apply(game, { type: 'play', id: game.phase.card.id }, r);
      case 'color': {
        const own = currentHand(game).find((c) => c.color !== null)?.color ?? COLORS[0];
        return apply(game, { type: 'color', color: own }, r);
      }
      case 'roundOver':
        return apply(game, { type: 'nextRound' }, r);
      case 'gameOver':
        return game;
      default: {
        const never: never = game.phase;
        return never;
      }
    }
  };

  test('two, three and five players to 200 points, never losing a card', () => {
    [2, 3, 5].forEach((n) => {
      const r = mulberry32(100 + n);
      const names = Array.from({ length: n }, (_, i) => `S${String(i)}`);
      const end = Array.from({ length: 20000 }).reduce<Game>(
        (game) => {
          if (game.phase.kind === 'gameOver') return game;
          const next = step(game, r);
          expect(cardCount(next)).toBe(108);
          return next;
        },
        deal(names, r, 200),
      );
      expect(end.phase.kind).toBe('gameOver');
      expect(Math.max(...end.scores)).toBeGreaterThanOrEqual(200);
    });
  });
});
