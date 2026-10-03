// The engraving (docs/design/hive.md §7): how a bug's line art becomes a `<symbol>` and how a tile
// draws it as four `<use>`s (rim, shade, gleam, ink) so the line reads as cut into the tile. Pure
// strings over the art's text, no file and no DOM: ui/bugs.ts feeds it the five files Vite inlines
// and builds the page's sprite from it; tools/splash-hive.ts feeds it the same files read off the
// disk and composes the link-preview card from it, so the card is drawn by the code the page is.
//
// The set is normalised here, not in the files: each bug is fitted to the same hexagonal frame
// (`BUG_FIT`, measured once from the drawn outlines: the largest scale at which every point of the
// bug, with half the line, stays inside a hex of 94% of the tile's inset radius, the centre nudged
// up or down where that buys size), so the Ant and the Queen sit at the same visual size, and every
// bug is drawn at the one line weight (`LINE`, in tile units) whatever stroke-width its file used:
// `symbolOf` strips the file's own stroke-width and the wrapper sets it, scaled, per bug.
import type { Point } from './board.ts';
import type { Bug } from '../engine/pieces.ts';

export const symbolId = (bug: Bug): string => `bug-${bug}`;

/** Where a bug sits on its tile: the point of the 100x100 art that lands on the hex's centre, and the scale into tile units (board.ts SIZE = 10 is a hex's circumradius). */
export type Fit = Readonly<{ cx: number; cy: number; scale: number }>;

/**
 * Measured from the files (tools: Chromium `getPointAtLength` over every shape): the centre and
 * the largest scale at which the whole outline, plus half of `LINE`, fits a hex of circumradius
 * 0.94 x 9.4 (the face polygon's radius, board.ts `cornersOf`). Re-measure when a file changes.
 */
export const BUG_FIT: Readonly<Record<Bug, Fit>> = {
  queen: { cx: 50, cy: 47, scale: 0.2137 },
  beetle: { cx: 50, cy: 54, scale: 0.146 },
  grasshopper: { cx: 50, cy: 47, scale: 0.1649 },
  spider: { cx: 50, cy: 44, scale: 0.1529 },
  ant: { cx: 50, cy: 43.25, scale: 0.1643 },
};

/** One line weight for the set, in tile units: about 6% of a tile's width, as on the official tiles. */
export const LINE = 1;
/** The hairline grey rim that peeks out each side of the line. */
export const RIM = 0.3;
/** The engraving's offset, tile units: the shadow up and to the left, the gleam down and to the right, so the line reads as cut into the tile under a light from the top left. */
export const ENGRAVE = 0.42;

const ROOT_TAG = /^\s*<svg\b[^>]*>/;
const CLOSE_TAG = /<\/svg>\s*$/;
const COMMENT = /<!--[\s\S]*?-->/g;
const ATTR = /([\w-]+)="([^"]*)"/g;
/** The root's presentation attributes the symbol keeps; stroke-width is the wrapper's. */
const KEPT = new Set(['fill', 'stroke', 'stroke-linecap', 'stroke-linejoin']);
const GROUP_STROKE_WIDTH = /(<g\b[^>]*?)\s+stroke-width="[^"]*"/g;
type Attr = Readonly<{ name: string; value: string }>;

/**
 * A file's art as a `<symbol>`: the root `<svg>`'s fill, stroke and line caps moved onto a `<g>`,
 * its comments dropped, and every stroke-width on the root or a `<g>` removed so the tile's
 * wrapper sets the weight (a shape's own stroke-width, the Queen's thinner stripes, stays).
 */
export const symbolOf = (bug: Bug, svg: string): string => {
  const root = ROOT_TAG.exec(svg)?.[0] ?? '';
  const kept = [...root.matchAll(ATTR)]
    .map((m: Readonly<RegExpMatchArray>): Attr => ({ name: m[1] ?? '', value: m[2] ?? '' }))
    .filter(({ name }) => KEPT.has(name))
    .map(({ name, value }) => `${name}="${value}"`)
    .join(' ');
  const inner = svg
    .replace(ROOT_TAG, '')
    .replace(CLOSE_TAG, '')
    .replace(COMMENT, '')
    .replace(GROUP_STROKE_WIDTH, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return `<symbol id="${symbolId(bug)}" viewBox="0 0 100 100"><g ${kept}>${inner}</g></symbol>`;
};

/**
 * What the tiles read by id: the sheen across a face (light at the top left, dark at the bottom
 * right, over the side's own colour), the bevel along its edge (the same light, as a stroke), and
 * the shadows that sit a tile on the felt (`hive-shadow`) and lift a stack (`hive-lift`). The
 * filters are in user units, the same on the board and in the tray.
 */
export const TILE_DEFS = [
  '<linearGradient id="hive-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.2"/></linearGradient>',
  '<linearGradient id="hive-edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.7"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.05"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></linearGradient>',
  '<filter id="hive-shadow" x="-15%" y="-15%" width="130%" height="135%"><feDropShadow dx="0" dy="0.5" stdDeviation="0.45" flood-color="#000" flood-opacity="0.5"/></filter>',
  '<filter id="hive-lift" x="-20%" y="-20%" width="140%" height="145%"><feDropShadow dx="0.3" dy="1.1" stdDeviation="0.8" flood-color="#000" flood-opacity="0.6"/></filter>',
].join('');

const num = (n: number): string => n.toFixed(4).replace(/\.?0+$/, '');

/**
 * A bug drawn about `c`, in the tile's units: the art scaled and centred by its `BUG_FIT`, the
 * line at `LINE`, as four `<use>`s of the one symbol, back to front: the grey rim (a wider stroke),
 * the shadow (offset up-left), the gleam (offset down-right) and the ink in the bug's colour; the
 * theme colours each layer by side and bug (`data-bug`) through `color`, which the symbol's
 * `currentColor` strokes read.
 */
export const bugHtml = (bug: Bug, c: Point): string => {
  const { cx, cy, scale } = BUG_FIT[bug];
  const transform = `translate(${num(c.x)} ${num(c.y)}) scale(${num(scale)}) translate(${num(-cx)} ${num(-cy)})`;
  const d = ENGRAVE / scale;
  // A `<use>` of a symbol fills the whole viewport unless sized: 100 by 100 maps the art 1:1.
  const layer = (cls: string, extra: string): string =>
    `<use class="${cls}" href="#${symbolId(bug)}" width="100" height="100"${extra}/>`;
  return `<g class="bug" data-bug="${bug}" transform="${transform}" stroke-width="${num(LINE / scale)}">${layer('rim', ` stroke-width="${num((LINE + 2 * RIM) / scale)}"`)}${layer('shade', ` transform="translate(${num(-d * 0.8)} ${num(-d)})"`)}${layer('gleam', ` transform="translate(${num(d * 0.8)} ${num(d)})"`)}${layer('ink', '')}</g>`;
};
