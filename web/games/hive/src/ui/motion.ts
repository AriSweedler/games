// The crawl (docs/design/hive.md §7; the owner: "the tiles move too fast... have them move in
// little jumps", and for the Spider "the spider's moves must show the '1-2-3' when it moves"):
// every tile that lands does so as a `Hop` (ui/state.ts `moveHop`), and after the repaint puts its
// tile at the destination this module carries it there the way it went, one short hop per hex of
// its path, slow enough to read as a creature walking: each hop a `translate` transition of
// HOP_MS after a beat of HOP_GAP_MS, with a small arc over it (a lift of HOP_LIFT units at
// mid-hop and a scale of HOP_SCALE: theme.css's `hive-hop` keyframes read the two off the cell's
// custom properties, written here). The recipe is the motion kernel's glide (web/shared/edge/
// motion.ts: a run of inline styles around one forced layout read), written here for a chain of
// legs: the cell is put back over where the tile stood with a translate under no transition, laid
// out there, then released to each stop in turn, and its inline styles clear when the last leg
// ends (or the fallback timer fires, HOP_MS + HOP_GAP_MS + GLIDE_SLACK_MS a leg). The translate
// is in the board's own units: a CSS px on an SVG element without a layout box is one user unit
// of its viewBox, so the offsets come straight off ui/board.ts `centerOf`, no screen rect needed.
// A placement has no hex to come from: it glides in from the tray tile's rect, one hop, the
// tray's centre put into board units by the cell's own on-screen size. Snapping (`Hop.reduced`:
// the page prefers reduced motion, or the player chose `snap`) carries nothing: the tile is where
// the repaint put it, and `onDone` fires at once. The numerals along the Spider's way (render.ts's
// trail) are drawn either way and clear when `onDone` fires. The DOM only through the shared
// edge; `hopStops`, `hopOffsets`, `trayOffset` and `arcAt` are pure for the tests.
import {
  addClass,
  afterTransition,
  queryIn,
  rectOf,
  removeClass,
  setStyle,
  type Element,
  type Rect,
} from '../../../../shared/edge/dom.ts';
import { GLIDE_SLACK_MS } from '../../../../shared/edge/motion.ts';
import { ORIGIN, keyOf, type Hex } from '../engine/hex.ts';
import { HEX_W, centerOf, type Hop, type Point } from './board.ts';

/** One hop's length: a crawl, not a flight (the Spider's three legs took 150 ms each before). */
export const HOP_MS = 260;
/** The beat between hops: the creature gathers itself. */
export const HOP_GAP_MS = 60;
/** How high a tile rises at mid-hop, in viewBox units (a hex is 20 tall). */
export const HOP_LIFT = 3;
/** How much larger a tile reads at mid-hop: nearer the eye. */
export const HOP_SCALE = 1.08;
export const HOP_EASE = 'cubic-bezier(0.25, 0.1, 0.25, 1)';
/** The theme's keyframes (theme.css) for the arc over one hop: `--hop-lift` and `--hop-scale` are its. */
export const HOP_ARC = 'hive-hop';

/**
 * Where the tile stops: where it stood, then each hex of its path, the destination last; the
 * destination alone when snapping (nothing to carry: the tile is there) or for a hop with no
 * path. A placement (no `from`) stops at its hex alone: `trayOffset` gives its start.
 */
export const hopStops = (hop: Pick<Hop, 'from' | 'path' | 'reduced'>): ReadonlyArray<Hex> => {
  const last = hop.path[hop.path.length - 1];
  if (last === undefined) return hop.from === null ? [] : [hop.from];
  return hop.reduced || hop.from === null ? [last] : [hop.from, ...hop.path];
};

/**
 * Each stop as the translate that puts the resting tile (drawn at the last stop) there, in
 * viewBox units: the last is zero, the first is where the tile stood relative to where it is.
 */
export const hopOffsets = (stops: ReadonlyArray<Hex>): ReadonlyArray<Point> => {
  const rest = centerOf(stops[stops.length - 1] ?? ORIGIN);
  return stops.map((h) => {
    const c = centerOf(h);
    return { x: c.x - rest.x, y: c.y - rest.y };
  });
};

/**
 * The translate, in viewBox units, that puts a cell over the centre of the tray tile it came
 * from: the two rects are on screen, so the difference of their centres is scaled by the cell's
 * own width against a hex's (`HEX_W`). Null where either cannot be measured (a fake, a hidden tray).
 */
export const trayOffset = (tray: Rect, cell: Rect): Point | null => {
  if (tray.width <= 0 || cell.width <= 0) return null;
  const perUnit = cell.width / HEX_W;
  return {
    x: (tray.left + tray.width / 2 - (cell.left + cell.width / 2)) / perUnit,
    y: (tray.top + tray.height / 2 - (cell.top + cell.height / 2)) / perUnit,
  };
};

/** The arc at `t` of one hop (0 at lift-off, 1 at landing): the lift, up, and the scale, both a half sine. */
export const arcAt = (t: number): Readonly<{ lift: number; scale: number }> => {
  const bulge = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  return { lift: -HOP_LIFT * bulge, scale: 1 + (HOP_SCALE - 1) * bulge };
};

const translate = (p: Point): string => `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px)`;

/** The transition of one hop: the beat first, then the translate. */
const LEG_TRANSITION = `transform ${String(HOP_MS)}ms ${HOP_EASE} ${String(HOP_GAP_MS)}ms`;
/** The arc's animation over one hop, timed with its transition. */
const LEG_ARC = `${HOP_ARC} ${String(HOP_MS)}ms ease-in-out ${String(HOP_GAP_MS)}ms`;
const LEG_FALLBACK_MS = HOP_MS + HOP_GAP_MS + GLIDE_SLACK_MS;

/**
 * Carry `cell` from `start` through `legs` (the last zero, where it rests), one hop a leg, then
 * clear its inline styles and `hopping`, then `onDone`.
 */
const carry = (
  cell: Element,
  start: Point,
  legs: ReadonlyArray<Point>,
  onDone: () => void,
): void => {
  addClass(cell, 'hopping');
  setStyle(cell, '--hop-lift', `${String(-HOP_LIFT)}px`);
  setStyle(cell, '--hop-scale', String(HOP_SCALE));
  setStyle(cell, 'transition', 'none');
  setStyle(cell, 'animation', 'none');
  setStyle(cell, 'transform', translate(start));
  // A layout read: the cell is laid out over where the tile stood before the first leg transitions.
  rectOf(cell);
  const run = (rest: ReadonlyArray<Point>): void => {
    const [next, ...more] = rest;
    if (next === undefined) {
      ['transition', 'animation', 'transform', '--hop-lift', '--hop-scale'].forEach((prop) => {
        setStyle(cell, prop, '');
      });
      removeClass(cell, 'hopping');
      onDone();
      return;
    }
    // The arc restarts each leg: its animation off, a layout read, then on again with the leg.
    setStyle(cell, 'animation', 'none');
    rectOf(cell);
    setStyle(cell, 'transition', LEG_TRANSITION);
    setStyle(cell, 'animation', LEG_ARC);
    setStyle(cell, 'transform', translate(next));
    afterTransition(
      cell,
      () => {
        run(more);
      },
      LEG_FALLBACK_MS,
    );
  };
  run(legs);
};

/**
 * Crawl the destination's cell (`[data-hex]` in `board`) along `hop`'s stops, or glide it in
 * from `tray` (the tile it was placed from) for a placement, then `onDone`. The cell wears
 * `hopping` on the way (theme.css: no pointer events, so a tap under the flight meets the board).
 * Nothing to carry (snapping, a fake, a board repainted without the cell, a tray that cannot be
 * measured) is `onDone` at once.
 */
export const hopAlong = (
  board: Element,
  tray: Element | null,
  hop: Hop,
  onDone: () => void,
): void => {
  const last = hop.path[hop.path.length - 1] ?? hop.from;
  const cell = last === null ? null : queryIn(board, `[data-hex="${keyOf(last)}"]`);
  if (cell === null || hop.reduced) {
    onDone();
    return;
  }
  if (hop.from === null) {
    const start = tray === null ? null : trayOffset(rectOf(tray), rectOf(cell));
    if (start === null) onDone();
    else carry(cell, start, [{ x: 0, y: 0 }], onDone);
    return;
  }
  const [start, ...legs] = hopOffsets(hopStops(hop));
  if (start === undefined || legs.length === 0) {
    onDone();
    return;
  }
  carry(cell, start, legs, onDone);
};
