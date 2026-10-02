import { describe, expect, test } from 'vitest';

import {
  COLORS,
  findCard,
  idsOf,
  isWild,
  makeDeck,
  playableOn,
  pointsOf,
  pointsOfHand,
  without,
  type Card,
} from './cards.ts';

const card = (over: Partial<Card> & Pick<Card, 'kind'>): Card => ({
  id: over.id ?? 'x',
  kind: over.kind,
  color: over.color ?? null,
  value: over.value ?? null,
});

describe('the deck (docs/design/uno.md §2)', () => {
  const deck = makeDeck();

  test('108 cards with unique ids', () => {
    expect(deck).toHaveLength(108);
    expect(new Set(idsOf(deck)).size).toBe(108);
  });

  test('per colour: one 0, two of 1-9, two Skip, two Reverse, two Draw Two', () => {
    COLORS.forEach((color) => {
      const own = deck.filter((c) => c.color === color);
      expect(own).toHaveLength(25);
      expect(own.filter((c) => c.kind === 'number' && c.value === 0)).toHaveLength(1);
      Array.from({ length: 9 }, (_, i) => i + 1).forEach((value) => {
        expect(own.filter((c) => c.kind === 'number' && c.value === value)).toHaveLength(2);
      });
      expect(own.filter((c) => c.kind === 'skip')).toHaveLength(2);
      expect(own.filter((c) => c.kind === 'reverse')).toHaveLength(2);
      expect(own.filter((c) => c.kind === 'draw2')).toHaveLength(2);
    });
  });

  test('four Wild and four Wild Draw Four, no colour', () => {
    expect(deck.filter((c) => c.kind === 'wild')).toHaveLength(4);
    expect(deck.filter((c) => c.kind === 'wild4')).toHaveLength(4);
    deck.filter(isWild).forEach((c) => {
      expect(c.color).toBeNull();
      expect(c.value).toBeNull();
    });
  });

  test('the whole deck scores 1,240 points (§6)', () => {
    // 4 colours x (0 + 2 x (1+...+9)) = 4 x 90 = 360; 24 action cards x 20 = 480; 8 wilds x 50 = 400.
    expect(pointsOfHand(deck)).toBe(360 + 480 + 400);
  });
});

describe('points (§6)', () => {
  test('a number is its face, an action 20, a wild 50', () => {
    expect(pointsOf(card({ kind: 'number', color: 'red', value: 7 }))).toBe(7);
    expect(pointsOf(card({ kind: 'number', color: 'red', value: 0 }))).toBe(0);
    expect(pointsOf(card({ kind: 'skip', color: 'blue' }))).toBe(20);
    expect(pointsOf(card({ kind: 'reverse', color: 'blue' }))).toBe(20);
    expect(pointsOf(card({ kind: 'draw2', color: 'blue' }))).toBe(20);
    expect(pointsOf(card({ kind: 'wild' }))).toBe(50);
    expect(pointsOf(card({ kind: 'wild4' }))).toBe(50);
  });

  test('a number card with no value counts zero (never built by makeDeck)', () => {
    expect(pointsOf(card({ kind: 'number', color: 'red' }))).toBe(0);
  });
});

describe('playableOn (§3)', () => {
  const top = card({ id: 't', kind: 'number', color: 'green', value: 4 });

  test('a wild always plays', () => {
    expect(playableOn(card({ kind: 'wild' }), top, 'green')).toBe(true);
    expect(playableOn(card({ kind: 'wild4' }), top, 'blue')).toBe(true);
  });

  test('the active colour plays, whatever the top card', () => {
    expect(playableOn(card({ kind: 'skip', color: 'green' }), top, 'green')).toBe(true);
    expect(playableOn(card({ kind: 'number', color: 'green', value: 9 }), top, 'green')).toBe(true);
    // After a wild the active colour is the named one, not the top card's.
    expect(
      playableOn(card({ kind: 'number', color: 'red', value: 1 }), card({ kind: 'wild' }), 'red'),
    ).toBe(true);
    expect(playableOn(card({ kind: 'number', color: 'green', value: 4 }), top, 'red')).toBe(true);
  });

  test('the same number plays across colours; the same symbol too', () => {
    expect(playableOn(card({ kind: 'number', color: 'red', value: 4 }), top, 'green')).toBe(true);
    expect(playableOn(card({ kind: 'number', color: 'red', value: 5 }), top, 'green')).toBe(false);
    const skipTop = card({ kind: 'skip', color: 'yellow' });
    expect(playableOn(card({ kind: 'skip', color: 'blue' }), skipTop, 'yellow')).toBe(true);
    expect(playableOn(card({ kind: 'reverse', color: 'blue' }), skipTop, 'yellow')).toBe(false);
    // A number never matches an action by "value".
    expect(playableOn(card({ kind: 'number', color: 'blue', value: 2 }), skipTop, 'yellow')).toBe(
      false,
    );
  });
});

describe('hand helpers', () => {
  const hand = [
    card({ id: 'a', kind: 'wild' }),
    card({ id: 'b', kind: 'number', color: 'red', value: 1 }),
  ];

  test('findCard and without', () => {
    expect(findCard(hand, 'b')?.value).toBe(1);
    expect(findCard(hand, 'zzz')).toBeUndefined();
    expect(idsOf(without(hand, 'a'))).toEqual(['b']);
    expect(idsOf(without(hand, 'nope'))).toEqual(['a', 'b']);
  });
});
