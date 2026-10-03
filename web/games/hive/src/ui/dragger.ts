// A tile dragged by hand (docs/design/hive.md §7 "Drag"; the owner, 2026-10-02: "The tiles must be
// click-and-draggable instead of just click-and-click to move"): what Hive tells the shared
// pointer-drag kernel (web/shared/edge/drag.ts, docs/design/dry-round-2.md E1; the gesture, the
// ghost, the capture and the landing are its). Tap-tap stays as the fallback (keyboards, assistive
// tech; ui/state.ts `pick/hand`, `tap/hex`); this is the second input, bound once to the two trays
// and the board. A press on a playable tray tile or on one of my movable board tiles starts a
// session; past DRAG_THRESHOLD `drag/start {picked}` goes out (the reducer picks the tile, so the
// hexes it may reach light and the source dims as `dragging`) and the ghost follows the pointer:
// a tray tile's clone, or the clone of the `svg.lift` the paint lays over a picked board tile
// (render.ts `liftHtml`; a `g` cloned onto the body would not render, a nested `<svg>` does). Every
// move looks for the lit hex nearest the pointer within SNAP of a hex's width (`nearestLit`), none
// while the tile's own place is nearer still, and says when that changes (`drag/over`; the painter
// marks it `drop`); on a board the paint marked `free` (the hints hidden: render.ts) every cell is
// a target, since the drop is a proposal the player confirms. On release over one `drag/end` plays the tile at once; off every one the ghost
// glides back first (LAND_MS) and the end drops the pick. The click a release fires is the
// reducer's to ignore while its `drag` stands. Only the DOM edge is reached.
import {
  closestFrom,
  dataOf,
  hasClass,
  queryAllIn,
  queryIn,
  rectOf,
  requireId,
  type Element,
  type PageLike,
} from '../../../../shared/edge/dom.ts';
import {
  DRAG_THRESHOLD,
  LAND_MS,
  bindDrag as bindDragKernel,
  type Point,
  type Rect,
} from '../../../../shared/edge/drag.ts';
import { hexOf, type Hex } from '../engine/hex.ts';
import { BUGS, type Bug } from '../engine/pieces.ts';

/**
 * What a press picks up: ui/state.ts `Picked`, spelled again here because that module is out of
 * this one's reach (it is compiled DOM-free, tsconfig.node.json; this one is the DOM edge's).
 */
export type Picked = Readonly<{ kind: 'hand'; bug: Bug }> | Readonly<{ kind: 'hex'; hex: Hex }>;

/** The intents the drag raises; ui/state.ts's `TableIntent` includes them. */
export type DragIntent =
  | Readonly<{ type: 'drag/start'; picked: Picked }>
  | Readonly<{ type: 'drag/over'; hex: Hex | null }>
  | Readonly<{ type: 'drag/end' }>;
export type DragDispatch = (intent: DragIntent) => void;

/** The kernel's: pixels before a press is a drag, and the ghost's glide back on a release over no hex. */
export { DRAG_THRESHOLD, LAND_MS };

/**
 * The snap radius as a share of a lit hex's width: the pointer need not be inside the hex, the
 * nearest lit one this close takes the drop (a thumb covers the hex it is over).
 */
export const SNAP = 0.9;

export type Target<K> = Readonly<{ key: K; rect: Rect }>;

const centre = (r: Rect): Point => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

const distance = (r: Rect, p: Point): number => Math.hypot(centre(r).x - p.x, centre(r).y - p.y);

/**
 * The target whose centre is nearest `p`, within SNAP of its own width (a rect with no size, a
 * fake's or an unmeasured element's, is never near), or null. `home` is where the tile was lifted
 * from (the kernel's `base`: a board cell, or the tray tile's slot): while the pointer is nearer
 * the home's centre than the nearest target's, nothing takes the drop. Neighbouring hex centres
 * sit one width apart, so without it a lit neighbour took the drop (and lit as `drop`) as soon as
 * the finger was a tenth of a hex off the lifted tile's own centre, still over the tile.
 */
export const nearestLit = <K>(
  targets: ReadonlyArray<Target<K>>,
  p: Point,
  home: Rect | null = null,
): K | null => {
  const best = targets
    .map((t): Readonly<{ key: K; d: number; r: number }> => ({
      key: t.key,
      d: distance(t.rect, p),
      r: t.rect.width * SNAP,
    }))
    .filter((t) => t.r > 0 && t.d <= t.r)
    .reduce<Readonly<{ key: K; d: number }> | null>(
      (best, t) => (best === null || t.d < best.d ? t : best),
      null,
    );
  if (best === null) return null;
  const nearerHome = home !== null && home.width > 0 && distance(home, p) < best.d;
  return nearerHome ? null : best.key;
};

const isBug = (raw: string | null): raw is Bug => BUGS.some((bug) => bug === raw);

/** What a press picks up: one of my movable board tiles, or a playable tray tile. */
const pickAt = (
  e: Readonly<Event>,
  surface: Element,
  board: Element,
): Readonly<{ key: Picked; el: Element }> | null => {
  if (surface === board) {
    const cell = closestFrom(e, '.hex.movable');
    const key = cell === null ? null : dataOf(cell, 'hex');
    return cell === null || key === null || key === ''
      ? null
      : { key: { kind: 'hex', hex: hexOf(key) }, el: cell };
  }
  const tile = closestFrom(e, '.hand-tile.playable');
  const bug = tile === null ? null : dataOf(tile, 'bug');
  return tile === null || !isBug(bug) ? null : { key: { kind: 'hand', bug }, el: tile };
};

/** The drag over the two trays and the board, bound once at boot beside the taps. */
export const bindDrag = (doc: PageLike, dispatch: DragDispatch): void => {
  const board = requireId(doc, 'board');
  const hands = [requireId(doc, 'whiteHand'), requireId(doc, 'blackHand')];
  /** The lit hex nearest the pointer (its key), or null; none while the tile's own place is nearer. Every cell on a `free` board. */
  const targetAt = (p: Point, home: Rect): string | null =>
    nearestLit(
      queryAllIn(board, hasClass(board, 'free') ? 'g.hex' : '.hex.lit').map((el) => ({
        key: dataOf(el, 'hex') ?? '',
        rect: rectOf(el),
      })),
      p,
      home,
    );
  bindDragKernel<Picked, string, DragIntent>(doc, dispatch, {
    surfaces: [board, ...hands],
    pick: (e, surface) => pickAt(e, surface, board),
    // The paint rebuilt the trays and the board on `drag/start`: the tile pressed is detached, so
    // the ghost's source is found again, the tray tile by its bug, a board tile as the lift the
    // paint laid over it.
    source: (s) =>
      s.key.kind === 'hex'
        ? queryIn(board, 'svg.lift')
        : queryIn(s.surface, `.hand-tile[data-bug="${s.key.bug}"]`),
    // The session's `base` is the source's box when the ghost was made: the cell or the tray
    // slot the tile left, the home nothing takes the drop from while the pointer is nearer it.
    targetAt: (p, s) => targetAt(p, s.base),
    onStart: (s) => [{ type: 'drag/start', picked: s.key }],
    onOver: (s) => [{ type: 'drag/over', hex: s.over === null ? null : hexOf(s.over) }],
    onEnd: () => [{ type: 'drag/end' }],
    // Over a lit hex the repaint places the tile: no glide; off every one the ghost glides back
    // to where its tile sits.
    land: (s) => (s.over === null ? s.base : null),
    // The ghost sits on the body, outside the tray's `--tile-w`: it takes the tile's measured
    // width as its own. The lift's own class goes (its rule hides it); the press marks come off.
    ghost: { sizeVar: '--tile-w', strip: ['lift', 'playable', 'picked', 'dragging', 'movable'] },
  });
};
