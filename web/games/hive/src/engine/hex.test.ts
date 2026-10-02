import { describe, expect, test } from 'vitest';

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
  ring,
  sameHex,
  scale,
  sharedNeighbours,
  walkEnds,
  walks,
  type Hex,
} from './hex.ts';

const h = (q: number, r: number): Hex => ({ q, r });
const keys = (hexes: ReadonlyArray<Hex>): ReadonlyArray<string> => hexes.map(keyOf).sort();
/** A height function over a few stacks: `"q,r"` -> height, every other hex empty. */
const heights =
  (stacks: Readonly<Record<string, number>>) =>
  (x: Hex): number =>
    stacks[keyOf(x)] ?? 0;

describe('coordinates', () => {
  test('a key round-trips, negatives included; a malformed key reads as the origin', () => {
    [h(0, 0), h(3, -2), h(-5, 7)].forEach((x) => {
      expect(hexOf(keyOf(x))).toEqual(x);
    });
    expect(keyOf(h(-1, 2))).toBe('-1,2');
    expect(hexOf('x,y')).toEqual(ORIGIN);
    expect(keyOf(scale(h(0, 1), -0))).toBe('0,0');
  });

  test('the six directions are unit steps in turning order: each touches the next, the last the first', () => {
    expect(DIRECTIONS).toHaveLength(6);
    expect(new Set(DIRECTIONS.map(keyOf)).size).toBe(6);
    DIRECTIONS.forEach((d, i) => {
      expect(distance(ORIGIN, d)).toBe(1);
      expect(distance(d, DIRECTIONS[(i + 1) % 6] ?? ORIGIN)).toBe(1);
    });
  });

  test('neighbours, distance and sameness', () => {
    expect(neighbours(h(2, -1)).map((n) => distance(n, h(2, -1)))).toEqual([1, 1, 1, 1, 1, 1]);
    expect(distance(h(0, 0), h(2, -1))).toBe(2);
    expect(distance(h(-2, 3), h(1, -1))).toBe(4);
    expect(sameHex(add(h(1, 2), h(-1, -2)), ORIGIN)).toBe(true);
    expect(sameHex(h(1, 0), h(0, 1))).toBe(false);
  });

  test('dedupe keeps each hex once, in first-seen order', () => {
    expect(dedupe([h(1, 0), h(0, 1), h(1, 0)])).toEqual([h(1, 0), h(0, 1)]);
  });
});

describe('rings', () => {
  test('radius 0 is the center; radius r holds 6r hexes, all r away, each touching the next', () => {
    const center = h(2, -3);
    expect(ring(center, 0)).toEqual([center]);
    expect(keys(ring(center, 1))).toEqual(keys(neighbours(center)));
    [1, 2, 3].forEach((radius) => {
      const walk = ring(center, radius);
      expect(walk).toHaveLength(6 * radius);
      expect(new Set(walk.map(keyOf)).size).toBe(6 * radius);
      walk.forEach((x, i) => {
        expect(distance(x, center)).toBe(radius);
        expect(distance(x, walk[(i + 1) % walk.length] ?? center)).toBe(1);
      });
    });
  });
});

describe('Freedom to Move, one step', () => {
  test('the gap of a step is the two hexes touching both ends; none for hexes that are not neighbours', () => {
    expect(keys(sharedNeighbours(h(0, 0), h(1, 0)))).toEqual(['0,1', '1,-1']);
    DIRECTIONS.forEach((d) => {
      sharedNeighbours(ORIGIN, d).forEach((x) => {
        expect(distance(x, ORIGIN)).toBe(1);
        expect(distance(x, d)).toBe(1);
      });
    });
    expect(sharedNeighbours(h(0, 0), h(2, 0))).toEqual([]);
    expect(canStep(heights({}), h(0, 0), h(2, 0))).toBe(false);
  });

  test('on the ground a slide needs exactly one side of the gap occupied: touching, never squeezed', () => {
    // From (0,0) to (1,0) the gap is (0,1) and (1,-1).
    expect(canStep(heights({ '0,1': 1 }), h(0, 0), h(1, 0))).toBe(true);
    expect(canStep(heights({ '0,1': 1, '1,-1': 1 }), h(0, 0), h(1, 0))).toBe(false);
    expect(canStep(heights({ '-1,0': 1 }), h(0, 0), h(1, 0))).toBe(false);
  });

  test('up on the hive the gap is closed only by two stacks taller than the level crossed', () => {
    // Climbing onto (1,0) between two single tiles: the level is 1, the gap 1 and 1.
    expect(canStep(heights({ '1,0': 1, '0,1': 1, '1,-1': 1 }), h(0, 0), h(1, 0))).toBe(true);
    // Between two stacks of two, from a tile (height 1 once lifted) onto a tile: blocked.
    expect(canStep(heights({ '0,0': 1, '1,0': 1, '0,1': 2, '1,-1': 2 }), h(0, 0), h(1, 0))).toBe(
      false,
    );
    // The same gap onto a stack of two: the level is 2, so it opens.
    expect(canStep(heights({ '0,0': 1, '1,0': 2, '0,1': 2, '1,-1': 2 }), h(0, 0), h(1, 0))).toBe(
      true,
    );
    // Dropping from a tile into a hole with a tile on each side of the gap: open at level 1.
    expect(canStep(heights({ '0,0': 1, '0,1': 1, '1,-1': 1 }), h(0, 0), h(1, 0))).toBe(true);
  });
});

describe('walking the hive', () => {
  const line = [h(0, 0), h(1, 0), h(2, 0)];

  test('flood reaches through the steps given, the starts included', () => {
    const inLine = (x: Hex): ReadonlyArray<Hex> =>
      neighbours(x).filter((n) => line.some((c) => sameHex(c, n)));
    expect(keys([...flood([h(0, 0)], inLine).values()])).toEqual(keys(line));
    expect(flood([h(5, 5)], () => []).size).toBe(1);
  });

  test('one hive: connected, or not; no tiles is one hive', () => {
    expect(isConnected([])).toBe(true);
    expect(isConnected(line)).toBe(true);
    expect(isConnected([h(0, 0), h(2, 0)])).toBe(false);
    expect(isConnected(ring(ORIGIN, 2))).toBe(true);
  });

  test('walks of an exact length never enter a hex twice', () => {
    expect(walkEnds(ORIGIN, 0, neighbours)).toEqual([ORIGIN]);
    expect(keys(walkEnds(ORIGIN, 1, neighbours))).toEqual(keys(neighbours(ORIGIN)));
    const two = walkEnds(ORIGIN, 2, neighbours);
    expect(two.some((x) => sameHex(x, ORIGIN))).toBe(false);
    expect(keys(two)).toEqual(keys([...ring(ORIGIN, 1), ...ring(ORIGIN, 2)]));
  });

  test('each walk is the hexes stepped on, in order, each a step from the last, none twice; the ends are walkEnds', () => {
    expect(walks(ORIGIN, 0, neighbours)).toEqual([[]]);
    expect(walks(ORIGIN, 1, neighbours)).toEqual(neighbours(ORIGIN).map((n) => [n]));
    const three = walks(ORIGIN, 3, neighbours);
    // Six first steps, five onward (never back to the start), then four or five: 6 * 5 * (4|5).
    expect(three.length).toBeGreaterThan(6 * 5 * 4);
    expect(three.length).toBeLessThanOrEqual(6 * 5 * 5);
    three.forEach((path) => {
      expect(path).toHaveLength(3);
      expect(new Set([ORIGIN, ...path].map(keyOf)).size).toBe(4);
      [ORIGIN, ...path].slice(1).forEach((x, i) => {
        expect(distance([ORIGIN, ...path][i] ?? ORIGIN, x)).toBe(1);
      });
    });
    expect(keys(walkEnds(ORIGIN, 3, neighbours))).toEqual(
      keys(dedupe(three.map((path) => path[2] ?? ORIGIN))),
    );
  });
});
