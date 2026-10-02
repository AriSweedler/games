// The board's geometry (docs/design/hive.md §7): axial hexes onto a pointy-top SVG plane, the
// cells a paint draws (the occupied hexes, the hexes the picked tile may reach, and the origin on
// an empty board so there is always something to tap), the cells the viewBox fits (the hive and
// the ring around it, so a pick never rescales the board: `fitCells`) and the viewBox itself.
// Pure: the painter (render.ts) spells the markup from these numbers.
import { occupied, type Board } from '../engine/engine.ts';
import { ORIGIN, dedupe, keyOf, neighbours, type Hex } from '../engine/hex.ts';

/** A hex's circumradius in viewBox units; a hex is `2 * SIZE` tall and `SQRT3 * SIZE` wide. */
export const SIZE = 10;
const SQRT3 = Math.sqrt(3);
export const HEX_W = SQRT3 * SIZE;
export const HEX_H = 2 * SIZE;

export type Point = Readonly<{ x: number; y: number }>;

/** The centre of a hex: pointy-top axial layout. */
export const centerOf = (h: Hex): Point => ({
  x: HEX_W * (h.q + h.r / 2),
  y: SIZE * 1.5 * h.r,
});

/** The six corners of the hex at `c`, as an SVG `points` attribute. */
export const cornersOf = (c: Point, inset = 0.6): string =>
  [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const angle = (Math.PI / 180) * (60 * i - 30);
      const r = SIZE - inset;
      return `${(c.x + r * Math.cos(angle)).toFixed(2)},${(c.y + r * Math.sin(angle)).toFixed(2)}`;
    })
    .join(' ');

export type ViewBox = Readonly<{ x: number; y: number; w: number; h: number }>;

/**
 * The viewBox that fits `cells` with three quarters of a hex of air around, never smaller than
 * four hexes across. The paint fits `fitCells`, which already carries the ring around the hive, so
 * the air is mostly the ring's and this margin keeps its outer edges off the frame.
 */
export const viewBoxOf = (cells: ReadonlyArray<Hex>): ViewBox => {
  const centres = (cells.length === 0 ? [ORIGIN] : cells).map(centerOf);
  const xs = centres.map((c) => c.x);
  const ys = centres.map((c) => c.y);
  const minX = Math.min(...xs) - HEX_W * 0.75;
  const maxX = Math.max(...xs) + HEX_W * 0.75;
  const minY = Math.min(...ys) - HEX_H * 0.75;
  const maxY = Math.max(...ys) + HEX_H * 0.75;
  const w = Math.max(maxX - minX, HEX_W * 4);
  const h = Math.max(maxY - minY, HEX_H * 3.5);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
};

export const viewBoxAttr = (v: ViewBox): string =>
  [v.x, v.y, v.w, v.h].map((n) => n.toFixed(2)).join(' ');

/** The hive as drawn: every occupied hex, or the origin alone when the board is empty. */
const hiveOf = (board: Board): ReadonlyArray<Hex> => {
  const filled = occupied(board);
  return filled.length === 0 ? [ORIGIN] : filled;
};

/** The cells a paint draws: every occupied hex, every `reachable` hex, and the origin when the board is empty. */
export const cellsOf = (board: Board, reachable: ReadonlyArray<Hex>): ReadonlyArray<Hex> =>
  dedupe([...hiveOf(board), ...reachable]);

/**
 * The cells the viewBox fits (the owner, 2026-10-02: "preshrink the board so there is no jarring
 * visual movement when you select or deselect stuff"): the hive and the ring of hexes around it,
 * every hex beside a tile. Every placement and every move lands there (engine.ts `placementHexes`
 * and `legalMoves`: a tile only ever comes down or steps to a hex beside the rest of the hive; a
 * Beetle's climb lands on a tile), so lighting the picked tile's hexes adds no cell outside the
 * fit, and the scale and the pan hold through the pick and its clearing; only a tile that
 * extends the ring moves them, once, after it is played.
 */
export const fitCells = (board: Board): ReadonlyArray<Hex> => {
  const hive = hiveOf(board);
  return dedupe([...hive, ...hive.flatMap(neighbours)]);
};

/** The hexes in `hexes`, keyed for a constant-time "is this one reachable". */
export const keySet = (hexes: ReadonlyArray<Hex>): ReadonlySet<string> => new Set(hexes.map(keyOf));
