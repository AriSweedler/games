// The paint (docs/design/hive.md §7): the App onto the composed shell page (page.ts) through the
// DOM edge, and every control bound to an intent. The shell's half is web/shared/ui's (the screens,
// the waiting rooms, the home tabs, the sheets; its curtain is composed but never raised, since
// Hive hides nothing: ui/state.ts `viewer`); the table is this file's: the names strip (`#myName`,
// `#oppName`, `#oppDot`), the SVG board (one `g.hex` per cell: a bevelled hexagon in the side's
// colour with the top tile's bug engraved on it (ui/bugs.ts `bugHtml`), a count badge and a lift
// on a stack, `lit` where the picked tile may go, `picked` on the tile in hand; the viewBox fitted
// to the hive and its ring, ui/board.ts `fitCells`, so a pick never rescales it), the two hands as
// trays of hexagonal tiles (the board's hexagon, the bug, the count left as a badge), Pass when
// the seat must, Resign while the game is on, the status line, and the result sheet over the
// final board (Continue leaves the board on show; Play again starts anew). The bug's name stays
// in each tile's `aria-label`; the letter of the notation is no longer drawn.
import {
  closestFrom,
  dataOf,
  listenId,
  requireId,
  safeHtml,
  setAttr,
  setDisabled,
  setHtml,
  setText,
  toggleClass,
  trustedHtml,
  type DocumentLike,
  type PageLike,
} from '../../../../shared/edge/dom.ts';
import { RULES_SLOT_IDS } from '../../../../shared/ui/glossary.ts';
import { paintRecentGames } from '../../../../shared/ui/recentGames.ts';
import {
  bindButtons,
  bindSheets,
  connDotView,
  paintConnDot,
  paintHandoff as paintShellHandoff,
  paintScreen as paintShellScreen,
  paintSheet,
  paintSound as paintShellSound,
  paintWaiting as paintShellWaiting,
  type Sheet,
} from '../../../../shared/ui/shellPaint.ts';
import { stackAt, type Game } from '../engine/engine.ts';
import { hexOf, keyOf, type Hex } from '../engine/hex.ts';
import { BUG, BUGS, type Bug, type Side } from '../engine/pieces.ts';
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
} from './board.ts';
import { bugHtml } from './bugs.ts';
import { bindHome, paintHome } from './home.ts';
import { aboutHtml, rulesItemsHtml } from './rules.ts';
import {
  SCREENS,
  handoffLabel,
  placeableNow,
  reachable,
  type App,
  type Intent,
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

/** One cell of the board: the hexagon, the top tile's bug, a stack's lift and count. */
export const cellHtml = (game: Game, hex: Hex, lit: boolean, picked: boolean): string => {
  const stack = stackAt(game.board, hex);
  const top = stack.at(-1);
  const c = centerOf(hex);
  const classes = [
    'hex',
    top === undefined ? 'empty' : sideClass(top.side),
    lit ? 'lit' : '',
    picked ? 'picked' : '',
    stack.length > 1 ? 'stack' : '',
  ]
    .filter((s) => s !== '')
    .join(' ');
  const label =
    top === undefined
      ? lit
        ? 'A hex the tile may go to'
        : 'An empty hex'
      : `${game.names[top.side]}’s ${BUG[top.bug].name}${stack.length > 1 ? `, on a stack of ${String(stack.length)}` : ''}`;
  const under =
    stack.length > 1
      ? `<polygon class="under" points="${cornersOf({ x: c.x + STACK_OFFSET.x, y: c.y + STACK_OFFSET.y })}" />`
      : '';
  const badge =
    stack.length > 1
      ? safeHtml`<text class="badge" x="${(c.x + 5.2).toFixed(2)}" y="${(c.y - 5.2).toFixed(2)}">${String(stack.length)}</text>`
          .markup
      : '';
  return `${safeHtml`<g class="${classes}" data-hex="${keyOf(hex)}" role="button" tabindex="0" aria-label="${label}">`.markup}${under}${faceHtml(c, top?.bug)}${badge}</g>`;
};

/**
 * The whole board as one SVG: the cells drawn (the hive and the lit hexes), the viewBox fitted to
 * the hive and its ring (board.ts `fitCells`), the same box with the pick lit or cleared.
 */
export const boardHtml = (v: View, picked: Picked | null): string => {
  const lit = new Set(reachable(v, picked).map(keyOf));
  const cells = cellsOf(v.game.board, [...lit].map(hexOf));
  const pickedKey = picked?.kind === 'hex' ? keyOf(picked.hex) : null;
  const inner = cells
    .map((hex) => cellHtml(v.game, hex, lit.has(keyOf(hex)), keyOf(hex) === pickedKey))
    .join('');
  return `<svg class="hive" viewBox="${viewBoxAttr(viewBoxOf(fitCells(v.game.board)))}" role="group" aria-label="The hive">${inner}</svg>`;
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

const paintTable = (doc: DocumentLike, app: App, v: View): void => {
  const picked = app.table.picked;
  setText(requireId(doc, 'myName'), `${nameAt(v, v.seat)} · ${v.seat === 0 ? 'White' : 'Black'}`);
  setText(requireId(doc, 'oppName'), nameAt(v, v.seat === 0 ? 1 : 0));
  paintConnDot(doc, 'oppDot', connDotView(app.shell));
  setHtml(requireId(doc, 'board'), trustedHtml(boardHtml(v, picked)));
  setHtml(requireId(doc, 'whiteHand'), trustedHtml(handHtml(v, 'white', picked)));
  setHtml(requireId(doc, 'blackHand'), trustedHtml(handHtml(v, 'black', picked)));
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

/** The rules into both slots (the Rules tab and the in-game sheet), once at boot. */
export const renderRules = (doc: DocumentLike): void => {
  const markup = trustedHtml(rulesItemsHtml());
  RULES_SLOT_IDS.forEach((id) => {
    setHtml(requireId(doc, id), markup);
  });
};

export const renderAbout = (doc: DocumentLike): void => {
  setHtml(requireId(doc, 'aboutCopy'), trustedHtml(aboutHtml()));
};

/** `#soundBtn`'s glyph, tooltip and pressed state. */
export const paintSound = (doc: DocumentLike, enabled: boolean): void => {
  paintShellSound(doc, enabled);
  setAttr(requireId(doc, 'soundBtn'), 'aria-pressed', enabled ? 'true' : 'false');
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
  paintOverlays(doc, app);
};

const SHEETS: ReadonlyArray<Sheet<Intent>> = [
  { overlay: 'rulesOverlay', close: 'closeRulesBtn', intent: { type: 'rules/close' } },
  { overlay: 'historyOverlay', close: 'closeHistoryBtn', intent: { type: 'history/close' } },
];

const isBug = (raw: string | null): raw is Bug => BUGS.some((bug) => bug === raw);

const bindTable = (doc: PageLike, dispatch: Dispatch): void => {
  listenId(doc, 'board', 'click', (e) => {
    const cell = closestFrom(e, '[data-hex]');
    const key = cell === null ? null : dataOf(cell, 'hex');
    if (key !== null && key !== '') dispatch({ type: 'tap/hex', hex: hexOf(key) });
    else dispatch({ type: 'pick/clear' });
  });
  const pickHand = (e: Readonly<Event>): void => {
    const button = closestFrom(e, 'button.hand-tile');
    const bug = button === null ? null : dataOf(button, 'bug');
    if (isBug(bug)) dispatch({ type: 'pick/hand', bug });
  };
  listenId(doc, 'whiteHand', 'click', pickHand);
  listenId(doc, 'blackHand', 'click', pickHand);
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
  bindSheets(doc, SHEETS, dispatch, { escapeFallback: { type: 'escape' } });
};
