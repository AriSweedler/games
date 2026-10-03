// The paint (docs/design/hive.md §7): the App onto the composed shell page (page.ts) through the
// DOM edge, and every control bound to an intent. The shell's half is web/shared/ui's (the screens,
// the waiting rooms, the home tabs, the sheets; its curtain is composed but never raised, since
// Hive hides nothing: ui/state.ts `viewer`); the table is this file's: the names strip (a hex swatch
// `#mySide`/`#oppSide` in each side's colour, `#myName`, `#oppName`, `#oppDot`), the SVG board (one `g.hex` per cell: a bevelled hexagon in the side's
// colour with the top tile's bug engraved on it (ui/bugs.ts `bugHtml`), a count badge and a lift
// on a stack, `lit` where the picked tile may go, `picked` on the tile in hand; the viewBox fitted
// to the hive and its ring, ui/board.ts `fitCells`, so a pick never rescales it), the two hands as
// trays of hexagonal tiles (the board's hexagon, the bug, the count left as a badge), Pass when
// the seat must, Resign while the game is on, the status line, and the result sheet over the
// final board (Continue leaves the board on show; Play again starts anew). The bug's name stays
// in each tile's `aria-label`; the letter of the notation is no longer drawn.
// A drag (ui/dragger.ts) paints over the same markup: `movable` on the tiles I may lift, `dragging`
// on the one in the air, `drop` on the lit hex a release would play, and `svg.lift` over a lifted
// board tile for the ghost to clone (`paintDrag`, `liftHtml`). The Spider's 1-2-3: numerals
// (`text.step`) on the three hexes of a picked Spider's path to the aimed hex (the lit hex the
// pointer is over, or a drag's nearest), and, as her move lands, `trail` cells along the path while
// the tile hops (ui/motion.ts `hopAlong`), once a position (`#board[data-hop]`). Every other tile
// crawls the same way as it lands, hex by hex with no numerals, and a placement glides in from its
// tray tile; `#motionBtn` (🐌 crawl, ⚡ snap: `paintMotion`) is the player's choice.
// A stack's count badge is a control (`g.stack-badge`, the owner: "selecting or hovering the badge
// showing how many bugs are underneath should show the stack of bugs"): hovered, tapped, or
// focused and pressed (Enter or Space) it opens the `peek` (`peekHtml`), a panel beside the hex drawn last in the SVG, over the hive,
// with the column top to bottom as mini tiles, the top one marked; the reducer holds which hex
// (`table.peek`) and closes it on a tap elsewhere, Escape, the pointer leaving, a pick, a drag or a
// new position. A tap on the badge is not a tap on its hex; a press carried away still lifts the tile.
// With the hints hidden (`#hintsBtn` 💡, `paintHints`; the owner: "option to not show moves") nothing
// lights: a pick draws the whole ring as plain cells (`#board.free`, so a drop lands anywhere), the
// proposed tile is drawn where the player put it (`proposed`, engine.ts `withIntent`) and
// `#proposalBar` (`.proposal-bar`: its own rule, not `.controls`, so the goldens' pinned row stays Pass and Resign's) shows under the board until the move plays or the tile goes back.
import {
  addClass,
  closestFrom,
  closestIn,
  dataOf,
  focusElement,
  keyOf as keyPressed,
  listenId,
  pointerTypeOf,
  preventDefault,
  queryAllIn,
  queryIn,
  removeElement,
  requireId,
  safeHtml,
  setAttr,
  setChecked,
  setDisabled,
  setHtml,
  setText,
  toggleClass,
  trustedHtml,
  type DocumentLike,
  type Element,
  type PageLike,
} from '../../../../shared/edge/dom.ts';
import { paintRecentGames } from '../../../../shared/ui/recentGames.ts';
import {
  bindButtons,
  bindSheets,
  connDotView,
  paintConnDot,
  paintHandoff as paintShellHandoff,
  paintScreen as paintShellScreen,
  paintSheet,
  paintWaiting as paintShellWaiting,
  type Sheet,
} from '../../../../shared/ui/shellPaint.ts';
import { columnAt, spiderPaths, stackAt, withIntent, type Game } from '../engine/engine.ts';
import { hexOf, keyOf, type Hex } from '../engine/hex.ts';
import { BUG, BUGS, type Bug, type Side, type Tile } from '../engine/pieces.ts';
import { sideOf, turnSeat, winnerSeat, type Seat, type View } from '../engine/view.ts';
import {
  HEX_H,
  HEX_W,
  cellsOf,
  centerOf,
  cornersOf,
  fitCells,
  viewBoxAttr,
  viewBoxOf,
  type Point,
  type ViewBox,
} from './board.ts';
import { bugHtml } from './bugs.ts';
import { bindDrag } from './dragger.ts';
import { bindHome, paintHome } from './home.ts';
import { hopAlong } from './motion.ts';
import {
  HIVE_HINTS,
  HIVE_MOTION,
  SCREENS,
  handoffLabel,
  intentOf,
  placeableNow,
  reachable,
  type App,
  type Hints,
  type Hop,
  type Intent,
  type Motion,
  type Picked,
} from './state.ts';

export { hideToast, showToast } from '../../../../shared/ui/shellPaint.ts';

type Dispatch = (intent: Intent) => void;

const sideClass = (side: Side): string => (side === 'white' ? 'w' : 'b');

/** How far a stack's lower tile peeks out from under the top one, tile units, down and to the right. */
const STACK_OFFSET = { x: 0.7, y: 0.9 } as const;

/**
 * A tile's face about `c`: the hexagon in the side's colour (`face`: the state strokes, lit and
 * picked, are its), the sheen and bevel over it (`sheen`: the gradients bugs.ts defines), and the
 * bug engraved at the centre (bugs.ts `bugHtml`), or no bug for an empty cell.
 */
const faceHtml = (c: Point, bug: Bug | undefined): string =>
  `<polygon class="face" points="${cornersOf(c)}" /><polygon class="sheen" points="${cornersOf(c, 1.1)}" />${bug === undefined ? '' : bugHtml(bug, c)}`;

const sideName = (side: Side): string => (side === 'white' ? 'White' : 'Black');

/** A column read aloud, top first: "3 tiles: Beetle (Black) over Soldier Ant (White) over Queen Bee (White)". */
export const columnLabel = (tiles: ReadonlyArray<Tile>): string =>
  `${String(tiles.length)} tiles: ${tiles.map((t) => `${BUG[t.bug].name} (${sideName(t.side)})`).join(' over ')}`;

/** Where a stack's count sits: the upper right of the tile, over the bug's corner. */
const BADGE_OFFSET = { x: 5.2, y: -5.2 } as const;
/** The badge's hit circle: a thumb's target in viewBox units (a hex is 20 tall and at least 44px on the page). */
const BADGE_HIT = 4.6;

/**
 * A stack's count as a control: the numeral (`text.badge`, no pointer of its own) over a hit
 * circle, focusable, named with the whole column so a reader hears it, `aria-expanded` while its
 * peek is open. The board's handlers read the hex off the enclosing cell. Focus alone opens
 * nothing (the paint refocuses the badge after every repaint, and a focus that opened would
 * reopen what the pointer just closed, without end): Enter or Space does, as on any button.
 */
const stackBadgeHtml = (c: Point, tiles: ReadonlyArray<Tile>, peeked: boolean): string => {
  const x = (c.x + BADGE_OFFSET.x).toFixed(2);
  const y = (c.y + BADGE_OFFSET.y).toFixed(2);
  const open = safeHtml`<g class="stack-badge" role="button" tabindex="0" aria-label="${columnLabel(tiles)}" aria-expanded="${peeked ? 'true' : 'false'}">`;
  const hit = safeHtml`<circle class="hit" cx="${x}" cy="${y}" r="${BADGE_HIT.toFixed(1)}" />`;
  const count = safeHtml`<text class="badge" x="${x}" y="${y}">${String(tiles.length)}</text>`;
  return `${open.markup}${hit.markup}${count.markup}</g>`;
};

/**
 * One cell of the board: the hexagon, the top tile's bug, a stack's lift and count (the count a
 * control, `stackBadgeHtml`; `peeked` while its column is on show), and a `step` numeral where the
 * hex is one of a Spider's path (1-2-3: centred on an empty hex, in the upper left of a tile, clear
 * of its bug); `trail` on an empty hex drawn only for a Spider's path.
 */
export const cellHtml = (
  game: Game,
  hex: Hex,
  lit: boolean,
  picked: boolean,
  step: number | null = null,
  trail = false,
  peeked = false,
  proposed = false,
): string => {
  const stack = stackAt(game.board, hex);
  const top = stack.at(-1);
  const c = centerOf(hex);
  const classes = [
    'hex',
    top === undefined ? 'empty' : sideClass(top.side),
    lit ? 'lit' : '',
    picked ? 'picked' : '',
    stack.length > 1 ? 'stack' : '',
    trail ? 'trail' : '',
    proposed ? 'proposed' : '',
  ]
    .filter((s) => s !== '')
    .join(' ');
  const stepNote =
    step === null
      ? proposed
        ? ', proposed: Confirm to play it'
        : ''
      : `, step ${String(step)} of the Spider’s path`;
  const label =
    top === undefined
      ? lit
        ? `A hex the tile may go to${stepNote}`
        : trail
          ? `A hex the Spider stepped on${stepNote}`
          : 'An empty hex'
      : `${game.names[top.side]}’s ${BUG[top.bug].name}${stack.length > 1 ? `, on a stack of ${String(stack.length)}` : ''}${stepNote}`;
  const under =
    stack.length > 1
      ? `<polygon class="under" points="${cornersOf({ x: c.x + STACK_OFFSET.x, y: c.y + STACK_OFFSET.y })}" />`
      : '';
  const badge = stack.length > 1 ? stackBadgeHtml(c, columnAt(game.board, hex), peeked) : '';
  const numeral =
    step === null
      ? ''
      : top === undefined
        ? safeHtml`<text class="step" x="${c.x.toFixed(2)}" y="${(c.y + 0.5).toFixed(2)}">${String(step)}</text>`
            .markup
        : safeHtml`<text class="step" x="${(c.x - 5).toFixed(2)}" y="${(c.y - 4).toFixed(2)}">${String(step)}</text>`
            .markup;
  return `${safeHtml`<g class="${classes}" data-hex="${keyOf(hex)}" role="button" tabindex="0" aria-label="${label}">`.markup}${under}${faceHtml(c, top?.bug)}${badge}${numeral}</g>`;
};

/** `path`'s hexes numbered 1, 2, 3 in order, keyed by hex. */
const numbered = (path: ReadonlyArray<Hex>): ReadonlyMap<string, number> =>
  new Map(path.map((h, i) => [keyOf(h), i + 1] as const));

/**
 * The path a pick shows: the picked Spider's three hexes to `aim` (the lit hex the pointer is
 * over, or a drag's nearest: engine.ts `spiderPaths`), none for any other pick or no aim.
 */
export const aimedPath = (v: View, picked: Picked | null, aim: Hex | null): ReadonlyArray<Hex> =>
  picked?.kind !== 'hex' || aim === null
    ? []
    : (spiderPaths(v.game, picked.hex).get(keyOf(aim)) ?? []);

/** The numerals a pick shows: `aimedPath` numbered 1-2-3. */
export const stepsOf = (
  v: View,
  picked: Picked | null,
  aim: Hex | null,
): ReadonlyMap<string, number> => numbered(aimedPath(v, picked, aim));

/** A peek's mini tile as a share of a board tile. */
const PEEK_SCALE = 0.6;
const PEEK_GAP = 1.2;
const PEEK_PAD = 1.6;
/** Air between the hex's edge and the panel, and between the panel and the frame. */
const PEEK_AIR = 1.5;

/**
 * The peek (ui/state.ts `table.peek`): the column at `hex` top to bottom as mini tiles (the face
 * and the engraved bug, `faceHtml` scaled, in the side's class so the ink reads as the hive's), the
 * top one marked `top`, on a panel beside the hex: to its right, or to its left when the right
 * would leave `box` (the board's viewBox), and never above or below the frame. Drawn last in the
 * SVG, so it lies over the hive. Empty for a hex with fewer than two tiles.
 */
export const peekHtml = (game: Game, hex: Hex, box: ViewBox): string => {
  const tiles = columnAt(game.board, hex);
  if (tiles.length < 2) return '';
  const c = centerOf(hex);
  const tileW = HEX_W * PEEK_SCALE;
  const tileH = HEX_H * PEEK_SCALE;
  const w = tileW + 2 * PEEK_PAD;
  const h = tiles.length * tileH + (tiles.length - 1) * PEEK_GAP + 2 * PEEK_PAD;
  const right = c.x + HEX_W / 2 + PEEK_AIR;
  const x = right + w <= box.x + box.w - PEEK_AIR ? right : c.x - HEX_W / 2 - PEEK_AIR - w;
  const y = Math.min(Math.max(c.y - h / 2, box.y + PEEK_AIR), box.y + box.h - PEEK_AIR - h);
  const open = safeHtml`<g class="peek" role="group" aria-label="${columnLabel(tiles)}" data-for="${keyOf(hex)}">`;
  const bg = safeHtml`<rect class="peek-bg" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="2" />`;
  const items = tiles.map((t, i) => {
    const cx = x + PEEK_PAD + tileW / 2;
    const cy = y + PEEK_PAD + tileH / 2 + i * (tileH + PEEK_GAP);
    const classes = ['peek-tile', sideClass(t.side), i === 0 ? 'top' : ''].filter((s) => s !== '');
    const item = safeHtml`<g class="${classes.join(' ')}" transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${String(PEEK_SCALE)})">`;
    return `${item.markup}${faceHtml({ x: 0, y: 0 }, t.bug)}</g>`;
  });
  return `${open.markup}${bg.markup}${items.join('')}</g>`;
};

/** The game as the board shows it under a proposal: the picked tile where the player put it (engine.ts `withIntent`), rules aside. */
export const proposedGame = (v: View, picked: Picked | null, proposal: Hex | null): Game =>
  picked === null || proposal === null
    ? v.game
    : { ...v.game, board: withIntent(v.game.board, sideOf(v.seat), intentOf(picked, proposal)) };
/**
 * The whole board as one SVG: the cells drawn (the hive and the lit hexes), the viewBox fitted to
 * the hive and its ring (board.ts `fitCells`), the same box with the pick lit or cleared; while a
 * board tile is dragged (`lift`), the lift over it for the ghost to clone (`liftHtml`). A
 * Spider's path (the aimed one on a pick, the `hop`'s as her move lands) is numbered 1-2-3, and
 * the hexes of it the board would not draw otherwise (the way: empty, not a destination) are
 * drawn first as `trail` cells, under the hive, so a hopping tile passes over them. The `peek`'s
 * panel (`peekHtml`) is drawn last, over everything, its cell's badge marked open.
 * With the `hints` hidden and a tile picked nothing lights and the whole ring is drawn as plain
 * cells for the tile to be put on; a `proposal` draws the tile there (`proposed`) over the board as
 * it would be.
 */
export const boardHtml = (
  v: View,
  picked: Picked | null,
  lift: Hex | null = null,
  aim: Hex | null = null,
  hop: Hop | null = null,
  peek: Hex | null = null,
  hints: Hints = 'show',
  proposal: Hex | null = null,
): string => {
  const free = hints === 'hide' && picked !== null;
  const lit = new Set(free ? [] : reachable(v, picked).map(keyOf));
  const game = free ? proposedGame(v, picked, proposal) : v.game;
  const cells = free
    ? cellsOf(game.board, fitCells(v.game.board))
    : cellsOf(v.game.board, [...lit].map(hexOf));
  const pickedKey = picked?.kind === 'hex' ? keyOf(picked.hex) : null;
  const proposedKey = free && proposal !== null ? keyOf(proposal) : null;
  // The Spider's way alone is drawn: another bug's crawl shows its own way, and a trail under an Ant's slide would clutter the hive.
  const path = hop === null ? aimedPath(v, picked, aim) : hop.bug === 'spider' ? hop.path : [];
  const steps = numbered(path);
  const drawn = new Set(cells.map(keyOf));
  const trail = path.filter((hex) => !drawn.has(keyOf(hex)));
  const peekKey = peek === null ? null : keyOf(peek);
  const inner = [
    ...trail.map((hex) => cellHtml(game, hex, false, false, steps.get(keyOf(hex)) ?? null, true)),
    ...cells.map((hex) =>
      cellHtml(
        game,
        hex,
        lit.has(keyOf(hex)),
        keyOf(hex) === pickedKey,
        steps.get(keyOf(hex)) ?? null,
        false,
        keyOf(hex) === peekKey,
        keyOf(hex) === proposedKey,
      ),
    ),
  ].join('');
  const box = viewBoxOf(fitCells(v.game.board));
  const over = `${lift === null ? '' : liftHtml(v.game, lift)}${peek === null ? '' : peekHtml(v.game, peek, box)}`;
  return `<svg class="hive" viewBox="${viewBoxAttr(box)}" role="group" aria-label="The hive">${inner}${over}</svg>`;
};

/** A tray tile's own viewBox: one hex (board.ts HEX_W by HEX_H) about the origin. */
export const TILE_VIEWBOX = [-HEX_W / 2, -HEX_H / 2, HEX_W, HEX_H]
  .map((n) => n.toFixed(2))
  .join(' ');

/**
 * A tray tile's face: the board's hexagon (`cornersOf`, the same inset, so the shape matches the
 * board's cell by cell) with the bug engraved at its centre, in a viewBox of its own.
 */
export const tileHtml = (bug: Bug): string =>
  `<svg class="tile" viewBox="${TILE_VIEWBOX}" aria-hidden="true">${faceHtml({ x: 0, y: 0 }, bug)}</svg>`;

/**
 * The lift (ui/dragger.ts `source`): the top tile at `hex` once more, as a nested `<svg>` laid over
 * its cell (the cell's box, the face drawn about the origin of the tray tile's viewBox, so the drag
 * kernel's clone of it renders on the body where a `g` would not) in the side's class, hidden by
 * its own rule; the kernel strips `lift` from the clone and the ghost shows. Empty for an empty
 * hex. The face is drawn here, not as a nested `svg.tile`: a nested svg sits at its parent's
 * user origin, and this viewBox's origin is the hex's centre, so a `tileHtml` inside landed half
 * a hex down and right and clipped to a quarter (the ghost of PR #24: a corner of a tile beside
 * the finger, gliding back to a point half a hex off its cell).
 */
export const liftHtml = (game: Game, hex: Hex): string => {
  const top = stackAt(game.board, hex).at(-1);
  if (top === undefined) return '';
  const c = centerOf(hex);
  const open = safeHtml`<svg class="hex lift ${sideClass(top.side)}" x="${(c.x - HEX_W / 2).toFixed(2)}" y="${(c.y - HEX_H / 2).toFixed(2)}" width="${HEX_W.toFixed(2)}" height="${HEX_H.toFixed(2)}" viewBox="${TILE_VIEWBOX}" aria-hidden="true">`;
  return `${open.markup}${faceHtml({ x: 0, y: 0 }, top.bug)}</svg>`;
};

/**
 * One side's hand: a hexagonal tile per bug (`tileHtml`) with the count left as a badge, the
 * placeable ones lit on the seat's turn; any of them may be picked at any time (there is no hand
 * order in Hive), the Queen alone when she must come down.
 */
export const handHtml = (v: View, side: Side, picked: Picked | null): string => {
  const mine = sideOf(v.seat) === side;
  const can = mine ? placeableNow(v) : new Set<Bug>();
  return BUGS.map((bug) => {
    const left = v.game.hands[side][bug];
    const classes = [
      'hand-tile',
      sideClass(side),
      left === 0 ? 'spent' : '',
      can.has(bug) ? 'playable' : '',
      picked?.kind === 'hand' && picked.bug === bug && mine ? 'picked' : '',
    ]
      .filter((s) => s !== '')
      .join(' ');
    const open = safeHtml`<button class="${classes}" type="button" data-bug="${bug}" data-side="${side}" aria-label="${BUG[bug].name}, ${String(left)} left"${can.has(bug) ? '' : ' disabled'}>`;
    const count = safeHtml`<span class="count">${String(left)}</span>`;
    return `${open.markup}${tileHtml(bug)}${count.markup}</button>`;
  }).join('');
};

const nameAt = (v: View, seat: Seat): string => v.names[seat];

/** The status line: the engine's note of what just happened, then whose turn (or the end). */
export const statusText = (v: View): string => {
  const turn = turnSeat(v.game);
  if (turn === null) return v.game.note;
  const whose = turn === v.seat ? 'Your turn' : `${nameAt(v, turn)}’s turn`;
  const queen =
    turn === v.seat && v.placements.length > 0 && v.placements.every((p) => p.bug === 'queen')
      ? ' · your Queen must come down'
      : '';
  const pass = v.canPass ? ' · no move: pass' : '';
  return `${v.game.note} ${whose}${queen}${pass}.`.trim();
};

/** The result sheet's title: the winner, or "You win!" on the winner's own phone; a draw. */
export const resultTitle = (v: View): string => {
  const result = v.game.result;
  if (result === null) return '';
  if (result.kind === 'draw') return 'A draw';
  const winner = winnerSeat(result);
  return winner === v.seat ? 'You win!' : `${winner === null ? '' : nameAt(v, winner)} wins!`;
};

/** The cell at `hex` as painted, or null (the board is rebuilt each paint, so it is found afresh). */
const cellAt = (board: Element, hex: Hex): Element | null =>
  queryIn(board, `[data-hex="${keyOf(hex)}"]`);

/**
 * The drag's marks over the fresh markup (ui/dragger.ts): `movable` on each of my tiles that may move
 * (what a press on the board may lift), and while a drag stands, `dragging` on its source (the tray
 * tile or the board cell, dimmed under the ghost) and `drop` on the lit hex a release would play.
 */
const paintDrag = (doc: DocumentLike, app: App, v: View): void => {
  const board = requireId(doc, 'board');
  v.movable.forEach((m) => {
    const cell = cellAt(board, m.from);
    if (cell !== null) addClass(cell, 'movable');
  });
  const d = app.table.drag;
  const picked = app.table.picked;
  if (d === null || picked === null) return;
  const source =
    picked.kind === 'hex'
      ? cellAt(board, picked.hex)
      : queryIn(
          requireId(doc, sideOf(v.seat) === 'white' ? 'whiteHand' : 'blackHand'),
          `.hand-tile[data-bug="${picked.bug}"]`,
        );
  if (source !== null) addClass(source, 'dragging');
  const over = d.over === null ? null : cellAt(board, d.over);
  if (over !== null) addClass(over, 'drop');
};

/** The hex swatch before a name in the names strip: the seat's tile colour (theme.css `[data-side]`), the side read aloud. */
const paintSwatch = (doc: DocumentLike, id: string, seat: Seat): void => {
  const el = requireId(doc, id);
  const side = sideOf(seat);
  setAttr(el, 'data-side', side === 'white' ? 'w' : 'b');
  setAttr(el, 'aria-label', sideName(side));
};

const paintTable = (doc: DocumentLike, app: App, v: View): void => {
  const picked = app.table.picked;
  const other: Seat = v.seat === 0 ? 1 : 0;
  paintSwatch(doc, 'mySide', v.seat);
  setText(requireId(doc, 'myName'), nameAt(v, v.seat));
  paintSwatch(doc, 'oppSide', other);
  setText(requireId(doc, 'oppName'), nameAt(v, other));
  paintConnDot(doc, 'oppDot', connDotView(app.shell));
  const lift = app.table.drag !== null && picked?.kind === 'hex' ? picked.hex : null;
  // The aim a Spider's path is numbered to: a drag's nearest lit hex while one stands, else the hex the pointer is over.
  const aim = app.table.drag !== null ? app.table.drag.over : app.table.aim;
  // A tile that landed hops once: the board remembers the position it hopped on (`data-hop`), so
  // a paint of the same position (an aim, a toast) draws the tile at rest and no trail.
  const board = requireId(doc, 'board');
  const hop = app.table.hop;
  const fresh = hop !== null && dataOf(board, 'hop') !== hop.key ? hop : null;
  const proposal = app.table.proposal;
  // The board is rebuilt: a focused badge (a keyboard's peek, open or just dismissed) is found
  // again and refocused, so the Tab order does not fall back to the top of the page.
  const held = queryIn(board, '.stack-badge:focus');
  const heldCell = held === null ? null : closestIn(held, '[data-hex]');
  const focused = heldCell === null ? null : dataOf(heldCell, 'hex');
  setHtml(
    board,
    trustedHtml(boardHtml(v, picked, lift, aim, fresh, app.table.peek, app.table.hints, proposal)),
  );
  if (focused !== null) {
    const badge = queryIn(board, `[data-hex="${focused}"] .stack-badge`);
    if (badge !== null) focusElement(badge);
  }
  // With the hints hidden a pick frees the board: the drag drops on any cell (ui/dragger.ts).
  toggleClass(board, 'free', app.table.hints === 'hide' && picked !== null);
  toggleClass(requireId(doc, 'proposalBar'), 'hidden', proposal === null);
  setHtml(requireId(doc, 'whiteHand'), trustedHtml(handHtml(v, 'white', picked)));
  setHtml(requireId(doc, 'blackHand'), trustedHtml(handHtml(v, 'black', picked)));
  if (fresh !== null) {
    setAttr(board, 'data-hop', fresh.key);
    // A placement glides in from the tray tile it came from (the hands are painted, so it is there).
    const tray = queryIn(
      requireId(doc, fresh.side === 'white' ? 'whiteHand' : 'blackHand'),
      `.hand-tile[data-bug="${fresh.bug}"]`,
    );
    hopAlong(board, tray, fresh, () => {
      queryAllIn(board, '.hex.trail, text.step').forEach(removeElement);
    });
  }
  paintDrag(doc, app, v);
  const turn = turnSeat(v.game);
  const mine = turn === v.seat;
  toggleClass(requireId(doc, 'whiteHand'), 'turn', turn === 0);
  toggleClass(requireId(doc, 'blackHand'), 'turn', turn === 1);
  toggleClass(requireId(doc, 'passBtn'), 'hidden', !v.canPass);
  toggleClass(requireId(doc, 'resignBtn'), 'hidden', !mine);
  setDisabled(requireId(doc, 'resignBtn'), !mine);
  const over = v.game.result !== null;
  toggleClass(requireId(doc, 'againBtn'), 'hidden', !(over && app.table.resultSeen));
  setText(requireId(doc, 'statusText'), statusText(v));
  paintSheet(doc, 'resultOverlay', over && !app.table.resultSeen);
  if (over) {
    setText(requireId(doc, 'rsTitle'), resultTitle(v));
    setText(requireId(doc, 'rsNote'), v.game.note);
  }
};

const paintOverlays = (doc: DocumentLike, app: App): void => {
  paintSheet(doc, 'rulesOverlay', app.shell.rulesOpen);
  paintSheet(doc, 'historyOverlay', app.table.historyOpen);
  if (app.table.historyOpen) paintRecentGames(doc, app.shell.recentGames);
};

/**
 * The tiles' motion on both its controls: `#motionBtn`'s glyph, tooltip and pressed state (🐌
 * pressed while the tiles crawl, ⚡ while they snap) and the home's `#motionToggle`, checked while
 * they crawl.
 */
export const paintMotion = (doc: DocumentLike, motion: Motion): void => {
  const btn = requireId(doc, 'motionBtn');
  const crawl = motion === 'crawl';
  setText(btn, crawl ? '🐌' : '⚡');
  setAttr(btn, 'title', HIVE_MOTION.labels[motion]);
  setAttr(btn, 'aria-label', HIVE_MOTION.labels[motion]);
  setAttr(btn, 'aria-pressed', crawl ? 'true' : 'false');
  setChecked(requireId(doc, 'motionToggle'), crawl);
};

/**
 * The hints on both their controls: `#hintsBtn`'s tooltip and pressed state (💡 pressed while a
 * picked tile's hexes light, not while the player places anywhere and confirms) and the home's
 * `#hintsToggle`, checked while they show.
 */
export const paintHints = (doc: DocumentLike, hints: Hints): void => {
  const btn = requireId(doc, 'hintsBtn');
  const show = hints === 'show';
  setAttr(btn, 'title', HIVE_HINTS.labels[hints]);
  setAttr(btn, 'aria-label', HIVE_HINTS.labels[hints]);
  setAttr(btn, 'aria-pressed', show ? 'true' : 'false');
  setChecked(requireId(doc, 'hintsToggle'), show);
};

export const paint = (doc: PageLike, app: App): void => {
  paintShellScreen(doc, SCREENS, app.shell.screen, 'tableScreen');
  paintShellWaiting(doc, app.shell);
  paintHome(doc, app);
  // No curtain to paint: the shell composed `#curtainOverlay` hidden and `viewer` never raises it.
  const game = app.shell.role === 'local' ? app.shell.game : null;
  paintShellHandoff(doc, game === null ? null : handoffLabel(game));
  const v = app.shell.view;
  if (v !== null) paintTable(doc, app, v);
  paintMotion(doc, app.table.motion);
  paintHints(doc, app.table.hints);
  paintOverlays(doc, app);
};

const SHEETS: ReadonlyArray<Sheet<Intent>> = [
  { overlay: 'rulesOverlay', close: 'closeRulesBtn', intent: { type: 'rules/close' } },
  { overlay: 'historyOverlay', close: 'closeHistoryBtn', intent: { type: 'history/close' } },
];

const isBug = (raw: string | null): raw is Bug => BUGS.some((bug) => bug === raw);

/** The hex of the cell the event's target is in, or null off every cell. */
const hexFrom = (e: Readonly<Event>): Hex | null => {
  const cell = closestFrom(e, '[data-hex]');
  const key = cell === null ? null : dataOf(cell, 'hex');
  return key === null || key === '' ? null : hexOf(key);
};

/**
 * What an event over the board says about the peek: on a stack's badge, its cell's column (a
 * `peek/hover`, which a dismissal the pointer never left holds back, or a tap's `peek/open`,
 * which always opens); on the open panel itself, nothing (the pointer may rest on it); anywhere
 * else, close.
 */
const peekIntentOf = (e: Readonly<Event>, by: 'hover' | 'open'): Intent | null => {
  if (closestFrom(e, '.stack-badge') !== null) {
    const hex = hexFrom(e);
    return hex === null ? null : { type: `peek/${by}`, hex };
  }
  return closestFrom(e, '.peek') !== null ? null : { type: 'peek/close' };
};

const bindTable = (doc: PageLike, dispatch: Dispatch): void => {
  // A tap on a stack's badge opens its peek and is no tap on the hex; a tap on the panel is nothing.
  listenId(doc, 'board', 'click', (e) => {
    const peek = peekIntentOf(e, 'open');
    if (peek?.type === 'peek/open') {
      dispatch(peek);
      return;
    }
    if (peek === null) return;
    const hex = hexFrom(e);
    if (hex !== null) dispatch({ type: 'tap/hex', hex });
    else dispatch({ type: 'pick/clear' });
  });
  // The aim: the lit hex a mouse or pen is over, none off them or off the board; and the peek: open
  // over a badge, closed off it (the reducer repaints neither for the same answer twice). Not a
  // touch: a finger's pointerover comes with its tap, and the repaint would replace the cell under
  // it before the click; a drag names its nearest hex itself.
  listenId(doc, 'board', 'pointerover', (e) => {
    if (pointerTypeOf(e) === 'touch') return;
    const cell = closestFrom(e, '.hex.lit');
    const key = cell === null ? null : dataOf(cell, 'hex');
    dispatch({ type: 'aim/hex', hex: key === null || key === '' ? null : hexOf(key) });
    const peek = peekIntentOf(e, 'hover');
    if (peek !== null) dispatch(peek);
  });
  listenId(doc, 'board', 'pointerleave', () => {
    dispatch({ type: 'aim/hex', hex: null });
    dispatch({ type: 'peek/close' });
  });
  // The keyboard: Enter or Space on the focused badge opens its peek (a tap's open: a dismissal
  // does not hold it back); focus moving to anything else on the board closes it. Focus arriving
  // on the badge itself is nothing: the paint puts it back there after every repaint.
  listenId(doc, 'board', 'keydown', (e) => {
    const key = keyPressed(e);
    if (key !== 'Enter' && key !== ' ') return;
    const peek = peekIntentOf(e, 'open');
    if (peek?.type !== 'peek/open') return;
    preventDefault(e);
    dispatch(peek);
  });
  listenId(doc, 'board', 'focusin', (e) => {
    const peek = peekIntentOf(e, 'hover');
    if (peek?.type === 'peek/close') dispatch(peek);
  });
  const pickHand = (e: Readonly<Event>): void => {
    const button = closestFrom(e, 'button.hand-tile');
    const bug = button === null ? null : dataOf(button, 'bug');
    if (isBug(bug)) dispatch({ type: 'pick/hand', bug });
  };
  listenId(doc, 'whiteHand', 'click', pickHand);
  listenId(doc, 'blackHand', 'click', pickHand);
  // The home's switch: either way it changes, the setting flips (the paint sets it back to the state).
  listenId(doc, 'motionToggle', 'change', () => {
    dispatch({ type: 'motion/toggle' });
  });
  listenId(doc, 'hintsToggle', 'change', () => {
    dispatch({ type: 'hints/toggle' });
  });
  bindButtons(
    doc,
    dispatch,
    [
      ['passBtn', { type: 'act', action: { type: 'pass' } }],
      ['resignBtn', { type: 'act', action: { type: 'resign' } }],
      ['againBtn', { type: 'act', action: { type: 'again' } }],
      ['rsContinueBtn', { type: 'result/continue' }],
      ['rsAgainBtn', { type: 'act', action: { type: 'again' } }],
      ['rsLeaveBtn', { type: 'leave/request' }],
      ['leaveBtn', { type: 'leave/request' }],
      ['soundBtn', { type: 'sound/toggle' }],
      ['motionBtn', { type: 'motion/toggle' }],
      ['hintsBtn', { type: 'hints/toggle' }],
      ['confirmBtn', { type: 'proposal/confirm' }],
      ['cancelBtn', { type: 'proposal/cancel' }],
      ['handoffBtn', { type: 'handoff/click' }],
      ['rulesBtnGame', { type: 'rules/open' }],
      ['historyBtn', { type: 'history/open' }],
    ],
    { skipDisabled: true },
  );
};

/** Every control of the page (home, table, sheets), once, at boot; the curtain's button is never shown, so it is not bound. */
export const bindAll = (doc: PageLike, dispatch: Dispatch): void => {
  bindHome(doc, dispatch);
  bindTable(doc, dispatch);
  bindDrag(doc, dispatch);
  bindSheets(doc, SHEETS, dispatch, { escapeFallback: { type: 'escape' } });
};
