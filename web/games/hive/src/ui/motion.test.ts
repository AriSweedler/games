import { describe, expect, test } from 'vitest';

import { ORIGIN, type Hex } from '../engine/hex.ts';
import { HEX_W, centerOf } from './board.ts';
import { hopOffsets, hopStops } from './motion.ts';

const h = (q: number, r: number): Hex => ({ q, r });

/** The Spider at (-1,0) walks (0,-1), (1,-1), (2,-1): a path from engine.test.ts's hand-built position. */
const FROM = h(-1, 0);
const PATH: ReadonlyArray<Hex> = [h(0, -1), h(1, -1), h(2, -1)];

describe("the Spider's hop", () => {
  test('the stops are where it stood then each hex of its path; the two ends alone under reduced motion', () => {
    expect(hopStops({ from: FROM, path: PATH, reduced: false })).toEqual([FROM, ...PATH]);
    expect(hopStops({ from: FROM, path: PATH, reduced: true })).toEqual([FROM, h(2, -1)]);
    expect(hopStops({ from: FROM, path: [], reduced: false })).toEqual([FROM]);
  });

  test('the offsets put the resting tile at each stop: the last is zero, each leg is one hex long', () => {
    const offsets = hopOffsets([FROM, ...PATH]);
    expect(offsets).toHaveLength(4);
    expect(offsets[3]).toEqual({ x: 0, y: 0 });
    const rest = centerOf(h(2, -1));
    const start = centerOf(FROM);
    expect(offsets[0]).toEqual({ x: start.x - rest.x, y: start.y - rest.y });
    offsets.slice(1).forEach((o, i) => {
      const prev = offsets[i] ?? { x: 0, y: 0 };
      expect(Math.hypot(o.x - prev.x, o.y - prev.y)).toBeCloseTo(HEX_W, 6);
    });
    expect(hopOffsets([])).toEqual([]);
    expect(hopOffsets([ORIGIN])).toEqual([{ x: 0, y: 0 }]);
  });
});
