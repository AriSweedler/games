import { describe, expect, test } from 'vitest';

import {
  DECK,
  QUEEN_OF_SPADES,
  TOTAL_POINTS,
  TWO_OF_DIAMONDS,
  deckFor,
  highest,
  isCard,
  pointsIn,
  pointsOf,
  rankOf,
  sortHand,
  suitOf,
} from './cards.ts';

describe('Hearts: the cards', () => {
  test('52 cards; 51 at three seats with the 2♦ out; every point adds to 26', () => {
    expect(DECK).toHaveLength(52);
    expect(deckFor(4)).toHaveLength(52);
    expect(deckFor(3)).toHaveLength(51);
    expect(deckFor(3)).not.toContain(TWO_OF_DIAMONDS);
    expect(pointsIn(DECK)).toBe(TOTAL_POINTS);
    expect(pointsIn(deckFor(3))).toBe(TOTAL_POINTS);
  });

  test('the ace is high, a heart is 1, the queen of spades 13', () => {
    expect(rankOf('AS')).toBe(14);
    expect(rankOf('10H')).toBe(10);
    expect(rankOf('2C')).toBe(2);
    expect(suitOf('10H')).toBe('H');
    expect(pointsOf('7H')).toBe(1);
    expect(pointsOf(QUEEN_OF_SPADES)).toBe(13);
    expect(pointsOf('KS')).toBe(0);
    expect(isCard('QS')).toBe(true);
    expect(isCard('1S')).toBe(false);
  });

  test('a hand sorts clubs, diamonds, spades, hearts, low to high; the highest three are the plain pass', () => {
    expect(sortHand(['AH', '2C', 'QS', '10D', '3C'])).toEqual(['2C', '3C', '10D', 'QS', 'AH']);
    expect(highest(['2C', 'AH', 'QS', 'KD', '3C'], 3)).toEqual(['AH', 'KD', 'QS']);
  });
});
