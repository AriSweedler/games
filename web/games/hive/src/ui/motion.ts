// The Spider's hop (docs/design/hive.md §7; the owner: "the spider's moves must show the '1-2-3'
// when it moves, as a special case"): a Spider's move lands as a `Hop` (ui/state.ts `spiderHop`),
// and after the repaint puts its tile at the destination this module carries it there the way it
// went, three hexes along its path, one short glide per hop, rather than in one jump. The recipe
// is the motion kernel's glide (web/shared/edge/motion.ts: a run of inline styles around one
// forced layout read), written here for a chain of legs rather than one: the cell is put back
// over where the Spider stood with a translate under no transition, laid out there, then released
// to each stop in turn under the transition, and its inline styles clear when the last leg ends
// (or the fallback timer fires, HOP_MS + GLIDE_SLACK_MS a leg). The translate is in the board's
// own units: a CSS px on an SVG element without a layout box is one user unit of its viewBox, so
// the offsets come straight off ui/board.ts `centerOf`, no screen rect needed. Under reduced
// motion (the reducer read it: `Hop.reduced`) the tile takes one step, from where it stood to the
// destination; the numerals along the way (render.ts's trail) are drawn either way, and the paint
// clears them when `onDone` fires. The DOM only through the shared edge; `hopStops` and
// `hopOffsets` are pure for the tests.
import {
  addClass,
  afterTransition,
  queryIn,
  rectOf,
  removeClass,
  setStyle,
  type Element,
} from '../../../../shared/edge/dom.ts';
import { GLIDE_SLACK_MS } from '../../../../shared/edge/motion.ts';
import { ORIGIN, keyOf, type Hex } from '../engine/hex.ts';
import { centerOf, type Hop, type Point } from './board.ts';

/** One leg's length: three legs make a move about as long as backgammon's one flight and a half. */
export const HOP_MS = 150;
export const HOP_EASE = 'cubic-bezier(0.25, 0.1, 0.25, 1)';

/**
 * Where the tile stops: where it stood, then each hex of its path, the destination last; the two
 * ends alone under reduced motion (one step). The start alone for a hop with no path.
 */
export const hopStops = (hop: Pick<Hop, 'from' | 'path' | 'reduced'>): ReadonlyArray<Hex> => {
  const last = hop.path[hop.path.length - 1];
  if (last === undefined) return [hop.from];
  return hop.reduced ? [hop.from, last] : [hop.from, ...hop.path];
};

/**
 * Each stop as the translate that puts the resting tile (drawn at the last stop) there, in
 * viewBox units: the last is zero, the first is where the Spider stood relative to where it is.
 */
export const hopOffsets = (stops: ReadonlyArray<Hex>): ReadonlyArray<Point> => {
  const rest = centerOf(stops[stops.length - 1] ?? ORIGIN);
  return stops.map((h) => {
    const c = centerOf(h);
    return { x: c.x - rest.x, y: c.y - rest.y };
  });
};

const translate = (p: Point): string => `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px)`;

/**
 * Carry the destination's cell (`[data-hex]` in `board`) along `hop`'s stops, then `onDone`. The
 * cell wears `hopping` on the way (theme.css: no pointer events, so a tap under the flight meets
 * the board). Nothing to carry (a fake, a board repainted without the cell) is `onDone` at once.
 */
export const hopAlong = (board: Element, hop: Hop, onDone: () => void): void => {
  const cell = queryIn(board, `[data-hex="${keyOf(hop.path[hop.path.length - 1] ?? hop.from)}"]`);
  const [start, ...legs] = hopOffsets(hopStops(hop));
  if (cell === null || start === undefined || legs.length === 0) {
    onDone();
    return;
  }
  addClass(cell, 'hopping');
  setStyle(cell, 'transition', 'none');
  setStyle(cell, 'transform', translate(start));
  // A layout read: the cell is laid out over where the Spider stood before the first leg transitions.
  rectOf(cell);
  const run = (rest: ReadonlyArray<Point>): void => {
    const [next, ...more] = rest;
    if (next === undefined) {
      setStyle(cell, 'transition', '');
      setStyle(cell, 'transform', '');
      removeClass(cell, 'hopping');
      onDone();
      return;
    }
    setStyle(cell, 'transition', `transform ${String(HOP_MS)}ms ${HOP_EASE}`);
    setStyle(cell, 'transform', translate(next));
    afterTransition(
      cell,
      () => {
        run(more);
      },
      HOP_MS + GLIDE_SLACK_MS,
    );
  };
  run(legs);
};
