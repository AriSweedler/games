import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { Element } from '../../../../shared/edge/dom.ts';
import { ORIGIN, type Hex } from '../engine/hex.ts';
import { HEX_H, HEX_W, centerOf, type Hop } from './board.ts';
import {
  HOP_ARC,
  HOP_GAP_MS,
  HOP_LIFT,
  HOP_MS,
  HOP_SCALE,
  arcAt,
  hopAlong,
  hopOffsets,
  hopStops,
  trayOffset,
} from './motion.ts';

const h = (q: number, r: number): Hex => ({ q, r });

/** The Spider at (-1,0) walks (0,-1), (1,-1), (2,-1): a path from engine.test.ts's hand-built position. */
const FROM = h(-1, 0);
const PATH: ReadonlyArray<Hex> = [h(0, -1), h(1, -1), h(2, -1)];
const hop = (over: Partial<Hop>): Hop => ({
  key: 'k',
  bug: 'spider',
  side: 'white',
  from: FROM,
  path: PATH,
  reduced: false,
  ...over,
});

describe('the stops and offsets of a crawl', () => {
  test('the stops are where it stood then each hex of its path; the destination alone when snapping or placed', () => {
    expect(hopStops(hop({}))).toEqual([FROM, ...PATH]);
    expect(hopStops(hop({ reduced: true }))).toEqual([h(2, -1)]);
    expect(hopStops(hop({ from: null, path: [ORIGIN] }))).toEqual([ORIGIN]);
    expect(hopStops(hop({ path: [] }))).toEqual([FROM]);
    expect(hopStops(hop({ from: null, path: [] }))).toEqual([]);
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

  test("an Ant's long way is one leg a hex too, however far it slides", () => {
    const way = [h(-2, 1), h(-2, 2), h(-1, 2), h(0, 2), h(1, 1), h(2, 0), h(3, -1)];
    const offsets = hopOffsets(way);
    expect(offsets).toHaveLength(way.length);
    offsets.slice(1).forEach((o, i) => {
      const prev = offsets[i] ?? { x: 0, y: 0 };
      expect(Math.hypot(o.x - prev.x, o.y - prev.y)).toBeCloseTo(HEX_W, 6);
    });
  });

  test('a placement starts over the tray tile, in board units by the cell’s own size', () => {
    // The cell is drawn twice as large as a hex's units: 40 px wide for HEX_W units.
    const cell = { left: 100, top: 200, width: HEX_W * 2, height: HEX_H * 2 };
    const tray = { left: 20, top: 400, width: 44, height: 44 };
    const start = trayOffset(tray, cell);
    expect(start?.x).toBeCloseTo((20 + 22 - (100 + HEX_W)) / 2, 6);
    expect(start?.y).toBeCloseTo((400 + 22 - (200 + HEX_H)) / 2, 6);
    expect(trayOffset({ left: 0, top: 0, width: 0, height: 0 }, cell)).toBeNull();
    expect(trayOffset(tray, { left: 0, top: 0, width: 0, height: 0 })).toBeNull();
  });

  test('the arc is flat at both ends and highest and largest at mid-hop', () => {
    expect(arcAt(0).lift).toBeCloseTo(0, 9);
    expect(arcAt(0).scale).toBe(1);
    expect(arcAt(1).lift).toBeCloseTo(0, 9);
    expect(arcAt(1).scale).toBeCloseTo(1, 9);
    expect(arcAt(0.5)).toEqual({ lift: -HOP_LIFT, scale: HOP_SCALE });
    expect(arcAt(0.25).lift).toBeLessThan(0);
    expect(arcAt(0.25).lift).toBeGreaterThan(-HOP_LIFT);
    expect(arcAt(2)).toEqual(arcAt(1));
    expect(HOP_MS).toBeGreaterThan(200);
    expect(HOP_GAP_MS).toBeGreaterThan(0);
  });
});

/** A cell with the surface `hopAlong` touches: classes, inline styles (in order), rects and transitionend. */
type StubCell = Element &
  Readonly<{
    styles: ReadonlyArray<readonly [string, string]>;
    classes: Set<string>;
    layouts: () => number;
    end: () => void;
  }>;

const stubCell = (rect = { left: 0, top: 0, width: 0, height: 0 }): StubCell => {
  const styles: (readonly [string, string])[] = [];
  const classes = new Set<string>();
  const listeners: (() => void)[] = [];
  const counter = { layouts: 0 };
  const el = {
    styles,
    classes,
    layouts: () => counter.layouts,
    end: () => {
      const fns = listeners.splice(0);
      fns.forEach((fn) => {
        fn();
      });
    },
    classList: {
      add: (...names: string[]) => {
        names.forEach((n) => classes.add(n));
      },
      remove: (...names: string[]) => {
        names.forEach((n) => classes.delete(n));
      },
      toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
      contains: (name: string) => classes.has(name),
    },
    style: {
      setProperty: (prop: string, value: string) => {
        styles.push([prop, value] as const);
      },
    },
    getBoundingClientRect: () => {
      counter.layouts += 1;
      return rect;
    },
    addEventListener: (_type: string, fn: () => void) => {
      listeners.push(fn);
    },
    removeEventListener: () => undefined,
    querySelector: () => null,
  };
  return el as unknown as StubCell;
};

const boardWith = (cell: Element | null): Element =>
  ({ querySelector: () => cell }) as unknown as Element;

const transforms = (cell: StubCell): ReadonlyArray<string> =>
  cell.styles.filter(([p]) => p === 'transform').map(([, v]) => v);

describe('the crawl over a cell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('a move: put back where it stood, then one hop a hex with the arc each leg, then cleared', () => {
    const cell = stubCell();
    const done = vi.fn();
    hopAlong(boardWith(cell), null, hop({}), done);
    expect(cell.classes.has('hopping')).toBe(true);
    const [start, first] = hopOffsets([FROM, ...PATH]);
    const t = (p: { x: number; y: number } | undefined): string =>
      `translate(${(p?.x ?? 0).toFixed(2)}px, ${(p?.y ?? 0).toFixed(2)}px)`;
    expect(transforms(cell)).toEqual([t(start), t(first)]);
    // The transition carries the beat, then the hop; the arc reads the lift and scale off the cell.
    expect(cell.styles).toContainEqual(['--hop-lift', `${String(-HOP_LIFT)}px`]);
    expect(cell.styles).toContainEqual(['--hop-scale', String(HOP_SCALE)]);
    const transition = cell.styles.find(([p, v]) => p === 'transition' && v !== 'none')?.[1];
    expect(transition).toBe(
      `transform ${String(HOP_MS)}ms cubic-bezier(0.25, 0.1, 0.25, 1) ${String(HOP_GAP_MS)}ms`,
    );
    const arc = cell.styles.find(([p, v]) => p === 'animation' && v !== 'none')?.[1];
    expect(arc).toContain(HOP_ARC);
    expect(arc).toContain(`${String(HOP_MS)}ms`);
    // Each leg ends on transitionend; the last clears the inline styles and the class.
    cell.end();
    cell.end();
    expect(transforms(cell)).toHaveLength(4);
    expect(done).not.toHaveBeenCalled();
    cell.end();
    expect(transforms(cell)).toEqual([
      t(start),
      t(first),
      t(hopOffsets([FROM, ...PATH])[2]),
      t({ x: 0, y: 0 }),
      '',
    ]);
    expect(cell.classes.has('hopping')).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
    expect(cell.layouts()).toBeGreaterThanOrEqual(4);
  });

  test('a leg that never ends is carried on by the fallback timer', () => {
    const cell = stubCell();
    const done = vi.fn();
    hopAlong(boardWith(cell), null, hop({ path: [h(0, -1)] }), done);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(HOP_MS + HOP_GAP_MS + 60);
    expect(done).toHaveBeenCalledTimes(1);
    expect(cell.classes.has('hopping')).toBe(false);
  });

  test('snapping carries nothing: no class, no style, done at once', () => {
    const cell = stubCell();
    const done = vi.fn();
    hopAlong(boardWith(cell), null, hop({ reduced: true }), done);
    expect(cell.styles).toEqual([]);
    expect(cell.classes.size).toBe(0);
    expect(done).toHaveBeenCalledTimes(1);
  });

  test('a placement glides in from the tray tile, one leg; a tray that cannot be measured is done at once', () => {
    const cell = stubCell({ left: 100, top: 200, width: HEX_W * 2, height: HEX_H * 2 });
    const tray = stubCell({ left: 20, top: 400, width: 44, height: 44 });
    const done = vi.fn();
    hopAlong(boardWith(cell), tray, hop({ from: null, path: [ORIGIN] }), done);
    expect(transforms(cell)).toHaveLength(2);
    expect(transforms(cell)[1]).toBe('translate(0.00px, 0.00px)');
    expect(transforms(cell)[0]).not.toBe('translate(0.00px, 0.00px)');
    cell.end();
    expect(done).toHaveBeenCalledTimes(1);
    const flat = stubCell();
    const quick = vi.fn();
    hopAlong(boardWith(flat), stubCell(), hop({ from: null, path: [ORIGIN] }), quick);
    expect(quick).toHaveBeenCalledTimes(1);
    expect(flat.styles).toEqual([]);
    const noTray = vi.fn();
    hopAlong(boardWith(cell), null, hop({ from: null, path: [ORIGIN] }), noTray);
    expect(noTray).toHaveBeenCalledTimes(1);
  });

  test('nothing to carry (no cell, no path) is done at once', () => {
    const done = vi.fn();
    hopAlong(boardWith(null), null, hop({}), done);
    hopAlong(boardWith(stubCell()), null, hop({ path: [] }), done);
    hopAlong(boardWith(stubCell()), null, hop({ from: null, path: [] }), done);
    expect(done).toHaveBeenCalledTimes(3);
  });
});
