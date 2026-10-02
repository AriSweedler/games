import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { makeDeck, type Card, type Cards } from './cards.ts';
import {
  DEFAULT_TARGET,
  activeSeats,
  apply,
  canHit,
  canStay,
  cardCount,
  deal,
  hasSecondChance,
  isActive,
  lineScore,
  nextActive,
  seatOf,
  type Game,
  type Seat,
} from './engine.ts';

const DECK = makeDeck();
const byId = (id: string): Card => {
  const card = DECK.find((c) => c.id === id);
  if (card === undefined) throw new Error(`no card ${id}`);
  return card;
};
const cards = (...ids: ReadonlyArray<string>): Cards => ids.map(byId);
const rng = mulberry32(5);

type SeatSpec = Readonly<{ name?: string; line?: ReadonlyArray<string>; status?: Seat['status'] }>;

/**
 * A hand-built position past the opening deal: the seats' lines and statuses, the draw pile top
 * LAST (so `draw: ['n5-1', 'n9-1']` deals the 9 first), seat 0 to act unless said otherwise.
 */
const scenario = (
  seats: ReadonlyArray<SeatSpec>,
  draw: ReadonlyArray<string>,
  over: Partial<Omit<Game, 'seats' | 'draw'>> = {},
): Game => ({
  seats: seats.map((s, i) => ({
    name: s.name ?? `P${String(i + 1)}`,
    line: cards(...(s.line ?? [])),
    status: s.status ?? 'active',
  })),
  draw: cards(...draw),
  discard: [],
  dealer: seats.length - 1,
  turn: 0,
  opening: 0,
  flip3: null,
  pending: [],
  phase: { kind: 'turn' },
  scores: seats.map(() => 0),
  target: DEFAULT_TARGET,
  round: 1,
  note: '',
  ...over,
});

describe('deal and the opening (§3)', () => {
  test('a new game: the whole deck shuffled, every seat active and empty, the first seat owed its card', () => {
    const game = deal(['Ari', 'Bea', 'Cy'], mulberry32(1));
    expect(cardCount(game)).toBe(94);
    expect(game.seats.map((s) => s.line.length)).toEqual([0, 0, 0]);
    expect(game.opening).toBe(3);
    expect(game.turn).toBe(0);
    expect(game.dealer).toBe(2);
    expect(canHit(game)).toBe(true);
    expect(canStay(game)).toBe(false);
    expect(apply(game, { type: 'stay' }, rng).note).toBe('The deal comes first.');
  });

  test('the opening deals one card to each seat in order, then play starts left of the dealer', () => {
    const game = scenario([{}, {}, {}], ['n7-1', 'n8-1', 'n9-1'], { opening: 3, turn: 0 });
    const one = apply(game, { type: 'hit' }, rng);
    expect(one.seats[0]?.line.map((c) => c.value)).toEqual([9]);
    expect(one.turn).toBe(1);
    expect(one.opening).toBe(2);
    const two = apply(one, { type: 'hit' }, rng);
    const three = apply(two, { type: 'hit' }, rng);
    expect(three.opening).toBe(0);
    expect(three.turn).toBe(0);
    expect(canStay(three)).toBe(true);
    expect(three.note).toContain('P1 to play');
  });

  test('a Freeze dealt in the opening is given away; a frozen seat is skipped for its card', () => {
    // Seat 0 draws Freeze; the only choices are the three active seats, so the engine asks.
    const game = scenario([{}, {}, {}], ['n1-1', 'n2-1', 'freeze-1'], { opening: 3 });
    const asked = apply(game, { type: 'hit' }, rng);
    expect(asked.phase).toMatchObject({ kind: 'target', from: 0, choices: [0, 1, 2] });
    const given = apply(asked, { type: 'give', seat: 1 }, rng);
    expect(seatOf(given, 1).status).toBe('frozen');
    // Seat 1 is skipped: seat 2 gets the next card.
    expect(given.turn).toBe(2);
    expect(apply(given, { type: 'hit' }, rng).seats[2]?.line.map((c) => c.value)).toEqual([2]);
  });
});

describe('hitting and staying (§3, §4)', () => {
  test('a new number joins the line and the turn moves to the next active seat', () => {
    const game = scenario([{ line: ['n3-1'] }, { line: ['n4-1'] }], ['n6-1']);
    const next = apply(game, { type: 'hit' }, rng);
    expect(next.seats[0]?.line.map((c) => c.value)).toEqual([3, 6]);
    expect(next.turn).toBe(1);
    expect(next.note).toBe('P1 drew a 6.');
    expect(cardCount(next)).toBe(cardCount(game));
  });

  test('a duplicate busts: the seat is out, the line scores nothing', () => {
    const game = scenario([{ line: ['n3-1', 'plus10'] }, { line: ['n4-1'] }], ['n3-2']);
    const bust = apply(game, { type: 'hit' }, rng);
    expect(seatOf(bust, 0).status).toBe('busted');
    expect(lineScore(seatOf(bust, 0))).toBe(0);
    expect(bust.note).toBe('P1 drew another 3 and busts.');
    expect(bust.turn).toBe(1);
    expect(isActive(bust, 0)).toBe(false);
  });

  test('a Second Chance saves one duplicate: both cards leave the line', () => {
    const game = scenario([{ line: ['n3-1', 'second-1'] }, { line: ['n4-1'] }], ['n3-2']);
    const saved = apply(game, { type: 'hit' }, rng);
    expect(seatOf(saved, 0).status).toBe('active');
    expect(seatOf(saved, 0).line.map((c) => c.id)).toEqual(['n3-1']);
    expect(saved.discard.map((c) => c.id).sort()).toEqual(['n3-2', 'second-1']);
    expect(saved.note).toContain('Second Chance takes it');
    expect(cardCount(saved)).toBe(cardCount(game));
  });

  test('stay banks the line; the round ends when nobody is active, the lines left on the table until the next deal', () => {
    const game = scenario(
      [{ line: ['n10-1', 'n12-1', 'times2'] }, { line: ['n4-1'], status: 'stayed' }],
      ['n1-1'],
    );
    const over = apply(game, { type: 'stay' }, rng);
    expect(over.phase).toEqual({ kind: 'roundOver' });
    expect(over.scores).toEqual([44, 4]);
    expect(over.seats.map((s) => s.line.length)).toEqual([3, 1]);
    expect(over.discard).toHaveLength(0);
    expect(over.note).toContain('P1 +44, P2 +4');
    const next = apply(over, { type: 'nextRound' }, rng);
    expect(next.seats.every((s) => s.line.length <= 1)).toBe(true);
    expect(cardCount(next)).toBe(cardCount(over));
  });

  test('a bust by the last active seat also ends the round, scoring the others', () => {
    const game = scenario([{ line: ['n3-1'] }, { line: ['n4-1'], status: 'stayed' }], ['n3-2']);
    const over = apply(game, { type: 'hit' }, rng);
    expect(over.phase).toEqual({ kind: 'roundOver' });
    expect(over.scores).toEqual([0, 4]);
    expect(over.note).toContain('P1 busts, P2 +4');
  });

  test('seven distinct numbers end the round at once for everyone, with the bonus', () => {
    const game = scenario(
      [{ line: ['n1-1', 'n2-1', 'n3-1', 'n4-1', 'n5-1', 'n6-1'] }, { line: ['n9-1'] }],
      ['n7-1'],
    );
    const over = apply(game, { type: 'hit' }, rng);
    expect(over.phase).toEqual({ kind: 'roundOver' });
    // 1+2+3+4+5+6+7 = 28, plus 15; the other seat banks its 9.
    expect(over.scores).toEqual([43, 9]);
    expect(over.note).toContain('flipped seven');
  });

  test('a modifier joins the line and is worth its bonus', () => {
    const game = scenario([{ line: ['n3-1'] }, {}], ['plus4']);
    const next = apply(game, { type: 'hit' }, rng);
    expect(lineScore(seatOf(next, 0))).toBe(7);
    expect(next.note).toBe('P1 drew +4.');
  });

  test('hit or stay out of turn is refused', () => {
    const game = scenario([{ status: 'stayed' }, {}], ['n1-1'], { turn: 0 });
    expect(apply(game, { type: 'hit' }, rng).note).toBe('Not now.');
    expect(apply(game, { type: 'stay' }, rng).note).toBe('Not now.');
    expect(apply(game, { type: 'give', seat: 1 }, rng).note).toBe('Nothing to give.');
    expect(apply(game, { type: 'nextRound' }, rng).note).toBe('The round is not over.');
  });
});

describe('the action cards (§4)', () => {
  test('Freeze with a choice asks; given to oneself it ends the turn frozen', () => {
    const game = scenario([{ line: ['n3-1'] }, { line: ['n4-1'] }], ['freeze-1']);
    const asked = apply(game, { type: 'hit' }, rng);
    expect(asked.phase).toEqual({
      kind: 'target',
      card: byId('freeze-1'),
      from: 0,
      choices: [0, 1],
    });
    expect(canHit(asked)).toBe(false);
    expect(apply(asked, { type: 'hit' }, rng).note).toBe('Not now.');
    expect(apply(asked, { type: 'give', seat: 5 }, rng).note).toBe(' cannot take it.');
    const self = apply(asked, { type: 'give', seat: 0 }, rng);
    expect(seatOf(self, 0).status).toBe('frozen');
    expect(self.turn).toBe(1);
    expect(self.note).toBe('P1 is frozen and banks 3.');
    expect(self.discard.map((c) => c.id)).toEqual(['freeze-1']);
  });

  test('Freeze given to the other seat: it banks, the drawer plays on next time round', () => {
    const game = scenario(
      [{ line: ['n3-1'] }, { line: ['n4-1'] }, { line: ['n5-1'] }],
      ['freeze-1'],
    );
    const given = apply(apply(game, { type: 'hit' }, rng), { type: 'give', seat: 1 }, rng);
    expect(seatOf(given, 1).status).toBe('frozen');
    expect(given.turn).toBe(2);
    expect(activeSeats(given)).toEqual([0, 2]);
  });

  test('the only active seat must take its own Freeze; the round then ends', () => {
    const game = scenario([{ line: ['n3-1'] }, { line: ['n4-1'], status: 'stayed' }], ['freeze-1']);
    const over = apply(game, { type: 'hit' }, rng);
    expect(over.phase).toEqual({ kind: 'roundOver' });
    expect(over.scores).toEqual([3, 4]);
  });

  test('Flip Three deals three cards to its taker, then the turn moves on', () => {
    const game = scenario(
      [{ line: ['n1-1'] }, { line: ['n2-1'] }],
      ['n5-1', 'n6-1', 'n7-1', 'flip3-1'],
    );
    const asked = apply(game, { type: 'hit' }, rng);
    const flipped = apply(asked, { type: 'give', seat: 0 }, rng);
    expect(seatOf(flipped, 0).line.map((c) => c.value)).toEqual([1, 7, 6, 5]);
    expect(flipped.flip3).toBeNull();
    expect(flipped.turn).toBe(1);
    expect(flipped.discard.map((c) => c.id)).toEqual(['flip3-1']);
    expect(cardCount(flipped)).toBe(cardCount(game));
  });

  test('Flip Three stops at a bust and at a Flip 7', () => {
    const bust = scenario(
      [{ line: ['n2-1'] }, { line: ['n3-1'] }],
      ['n9-1', 'n2-2', 'n6-1', 'flip3-1'],
    );
    const busted = apply(apply(bust, { type: 'hit' }, rng), { type: 'give', seat: 0 }, rng);
    expect(seatOf(busted, 0).status).toBe('busted');
    // Two cards flipped (6, then the duplicate 1); the 9 stays in the pile.
    expect(busted.draw.map((c) => c.id)).toEqual(['n9-1']);
    const seven = scenario(
      [{ line: ['n1-1', 'n2-1', 'n3-1', 'n4-1', 'n5-1'] }, { line: ['n9-1'] }],
      ['n12-1', 'n7-1', 'n6-1', 'flip3-1'],
    );
    const over = apply(apply(seven, { type: 'hit' }, rng), { type: 'give', seat: 0 }, rng);
    expect(over.phase).toEqual({ kind: 'roundOver' });
    expect(over.scores).toEqual([1 + 2 + 3 + 4 + 5 + 6 + 7 + 15, 9]);
    expect(over.draw.map((c) => c.id)).toEqual(['n12-1']);
  });

  test('an action drawn inside a Flip Three waits until the three are flipped, then is given', () => {
    const game = scenario(
      [{ line: ['n1-1'] }, { line: ['n2-1'] }, { line: ['n3-1'] }],
      ['n8-1', 'freeze-1', 'n6-1', 'flip3-1'],
    );
    const flipped = apply(apply(game, { type: 'hit' }, rng), { type: 'give', seat: 0 }, rng);
    expect(seatOf(flipped, 0).line.map((c) => c.value)).toEqual([1, 6, 8]);
    expect(flipped.phase).toMatchObject({ kind: 'target', card: byId('freeze-1'), from: 0 });
    const done = apply(flipped, { type: 'give', seat: 2 }, rng);
    expect(seatOf(done, 2).status).toBe('frozen');
    expect(done.turn).toBe(1);
  });

  test('a Second Chance is kept when the seat has none, given away when it has one, discarded when nobody can take it', () => {
    const keep = apply(scenario([{ line: ['n1-1'] }, {}], ['second-1']), { type: 'hit' }, rng);
    expect(hasSecondChance(seatOf(keep, 0))).toBe(true);
    expect(keep.note).toBe('P1 drew a Second Chance.');
    const giveAway = apply(
      scenario([{ line: ['second-1'] }, {}, {}], ['second-2']),
      { type: 'hit' },
      rng,
    );
    expect(giveAway.phase).toMatchObject({ kind: 'target', choices: [1, 2] });
    const taken = apply(giveAway, { type: 'give', seat: 2 }, rng);
    expect(hasSecondChance(seatOf(taken, 2))).toBe(true);
    expect(taken.note).toBe('P3 takes the Second Chance.');
    const nobody = apply(
      scenario([{ line: ['second-1'] }, { line: ['second-2'] }], ['second-3']),
      { type: 'hit' },
      rng,
    );
    expect(nobody.phase).toEqual({ kind: 'turn' });
    expect(nobody.discard.map((c) => c.id)).toEqual(['second-3']);
    expect(nobody.note).toContain('Nobody can take the Second Chance');
  });

  test('a second Second Chance with one other seat lacking one goes there without asking', () => {
    const game = scenario([{ line: ['second-1'] }, {}], ['second-2']);
    const given = apply(game, { type: 'hit' }, rng);
    expect(given.phase).toEqual({ kind: 'turn' });
    expect(hasSecondChance(seatOf(given, 1))).toBe(true);
  });
});

describe('the deck and the rounds (§3, §6)', () => {
  test('an empty draw pile reshuffles the discards', () => {
    const game = scenario([{ line: ['n1-1'] }, {}], [], { discard: cards('n4-1', 'n5-1', 'n6-1') });
    const next = apply(game, { type: 'hit' }, mulberry32(2));
    expect(seatOf(next, 0).line).toHaveLength(2);
    expect(next.draw.length + next.discard.length).toBe(2);
    expect(cardCount(next)).toBe(cardCount(game));
  });

  test('no card anywhere to draw: the round settles', () => {
    const game = scenario([{ line: ['n1-1'] }, {}], []);
    const over = apply(game, { type: 'hit' }, rng);
    expect(over.phase).toEqual({ kind: 'roundOver' });
    expect(over.scores).toEqual([1, 0]);
  });

  test('the next round rotates the dealer, clears the lines, deals again', () => {
    const game = scenario([{ line: ['n10-1'] }, { line: ['n4-1'], status: 'stayed' }], ['n1-1']);
    const over = apply(game, { type: 'stay' }, rng);
    const next = apply(over, { type: 'nextRound' }, rng);
    expect(next.round).toBe(2);
    expect(next.dealer).toBe(0);
    expect(next.turn).toBe(1);
    expect(next.opening).toBe(2);
    expect(next.seats.every((s) => s.status === 'active' && s.line.length === 0)).toBe(true);
    expect(next.scores).toEqual([10, 4]);
  });

  test('reaching the target alone wins; a shared top keeps the game going', () => {
    const win = scenario([{ line: ['n10-1'] }, { line: ['n4-1'], status: 'stayed' }], ['n1-1'], {
      scores: [190, 100],
    });
    const over = apply(win, { type: 'stay' }, rng);
    expect(over.phase).toEqual({ kind: 'gameOver', winner: 0 });
    expect(over.note).toContain('P1 wins the game with 200 points');
    const tie = scenario([{ line: ['n10-1'] }, { line: ['n4-1'], status: 'stayed' }], ['n1-1'], {
      scores: [190, 196],
    });
    const again = apply(tie, { type: 'stay' }, rng);
    expect(again.phase).toEqual({ kind: 'roundOver' });
    expect(again.scores).toEqual([200, 200]);
  });

  test('nextActive wraps and skips the seats that are out', () => {
    const game = scenario([{ status: 'busted' }, {}, { status: 'frozen' }], []);
    expect(nextActive(game, 1)).toBe(1);
    expect(nextActive(game, 2)).toBe(1);
    expect(nextActive(scenario([{ status: 'busted' }, { status: 'stayed' }], []), 0)).toBeNull();
  });
});

describe('a whole game with a careful bot (every state consistent)', () => {
  /** Hit with four numbers or fewer, else stay; give any action to the first choice. */
  const step = (game: Game, r: () => number): Game => {
    switch (game.phase.kind) {
      case 'turn': {
        const line = seatOf(game, game.turn).line.filter((c) => c.kind === 'number');
        return canStay(game) && line.length > 4
          ? apply(game, { type: 'stay' }, r)
          : apply(game, { type: 'hit' }, r);
      }
      case 'target':
        return apply(game, { type: 'give', seat: game.phase.choices[0] ?? 0 }, r);
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

  test('two, three and six seats to 200 points, never losing a card', () => {
    [2, 3, 6].forEach((n) => {
      const r = mulberry32(300 + n);
      const names = Array.from({ length: n }, (_, i) => `S${String(i)}`);
      const end = Array.from({ length: 20000 }).reduce<Game>(
        (game) => {
          if (game.phase.kind === 'gameOver') return game;
          const next = step(game, r);
          expect(cardCount(next)).toBe(94);
          return next;
        },
        deal(names, r),
      );
      expect(end.phase.kind).toBe('gameOver');
      expect(Math.max(...end.scores)).toBeGreaterThanOrEqual(200);
    });
  });
});
