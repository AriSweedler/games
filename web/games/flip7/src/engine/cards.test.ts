import { describe, expect, test } from 'vitest';

import {
  ACTION_COPIES,
  FLIP7_BONUS,
  PLUS_VALUES,
  cardName,
  idsOf,
  isAction,
  isFlip7,
  isModifier,
  makeDeck,
  numbersOf,
  scoreLine,
  type Card,
} from './cards.ts';

const n = (value: number, copy = 1): Card => ({
  id: `n${String(value)}-${String(copy)}`,
  kind: 'number',
  value,
});
const plus = (value: number): Card => ({ id: `plus${String(value)}`, kind: 'plus', value });
const TIMES2: Card = { id: 'times2', kind: 'times2', value: null };
const SECOND: Card = { id: 'second-1', kind: 'second', value: null };

describe('the deck (docs/design/flip7.md §2)', () => {
  const deck = makeDeck();

  test('94 cards with unique ids: 79 numbers, 9 actions, 6 modifiers', () => {
    expect(deck).toHaveLength(94);
    expect(new Set(idsOf(deck)).size).toBe(94);
    expect(deck.filter((c) => c.kind === 'number')).toHaveLength(79);
    expect(deck.filter(isAction)).toHaveLength(9);
    expect(deck.filter(isModifier)).toHaveLength(6);
  });

  test('as many copies of a number as its value, and one 0', () => {
    expect(deck.filter((c) => c.kind === 'number' && c.value === 0)).toHaveLength(1);
    Array.from({ length: 12 }, (_, i) => i + 1).forEach((value) => {
      expect(
        deck.filter((c) => c.kind === 'number' && c.value === value),
        String(value),
      ).toHaveLength(value);
    });
  });

  test('three of each action; +2 +4 +6 +8 +10 and x2 once each', () => {
    (['freeze', 'flip3', 'second'] as const).forEach((kind) => {
      expect(deck.filter((c) => c.kind === kind)).toHaveLength(ACTION_COPIES);
    });
    expect(deck.filter((c) => c.kind === 'plus').map((c) => c.value)).toEqual([...PLUS_VALUES]);
    expect(deck.filter((c) => c.kind === 'times2')).toHaveLength(1);
  });
});

describe('scoring a line (§6)', () => {
  test('numbers add; x2 doubles the numbers alone; + bonuses add after', () => {
    expect(scoreLine([n(3), n(7), n(12)])).toBe(22);
    expect(scoreLine([n(3), n(7), TIMES2])).toBe(20);
    expect(scoreLine([n(3), n(7), TIMES2, plus(10)])).toBe(30);
    expect(scoreLine([plus(4)])).toBe(4);
    expect(scoreLine([])).toBe(0);
  });

  test('a held Second Chance is worth nothing', () => {
    expect(scoreLine([n(5), SECOND])).toBe(5);
  });

  test('seven distinct numbers add the bonus; a 0 counts as a number', () => {
    const seven = [0, 1, 2, 3, 4, 5, 6].map((v) => n(v));
    expect(isFlip7(seven)).toBe(true);
    expect(scoreLine(seven)).toBe(21 + FLIP7_BONUS);
    expect(isFlip7(seven.slice(1))).toBe(false);
    expect(numbersOf([n(9), plus(2), n(1)])).toEqual([9, 1]);
  });
});

describe('names', () => {
  test('every kind', () => {
    const kinds: ReadonlyArray<Card> = [
      n(12),
      { id: 'f', kind: 'freeze', value: null },
      { id: 'g', kind: 'flip3', value: null },
      SECOND,
      plus(8),
      TIMES2,
    ];
    expect(kinds.map(cardName)).toEqual([
      '12',
      'Freeze',
      'Flip Three',
      'Second Chance',
      '+8',
      'x2',
    ]);
  });
});
