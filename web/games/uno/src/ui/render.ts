// The paint (docs/design/uno.md §9): the App onto the composed shell page (page.ts) through the
// DOM edge, and every control bound to an intent. The shell's half is web/shared/ui's (the screens,
// the waiting rooms, the home tabs, the curtain, the sheets); the table is this file's: every
// seat's name and card count (the turn lit), the names strip (`#myName`, `#oppName`: the seat
// after mine, `#oppDot`), the direction, the top card and the colour in play, my hand as tiles (a
// playable one lit, the rest dimmed; nothing lit off my turn), Draw, Pass after a drawn card, the
// colour picker for my wild, the status line, and the result sheet (one round is the game: the
// winner, the cards every other seat still held, Play again). The base pack is plain tiles: a
// colour and a glyph.
import {
  closestFrom,
  dataOf,
  listenId,
  queryAllIn,
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
  type SafeHtml,
} from '../../../../shared/edge/dom.ts';
import { RULES_SLOT_IDS } from '../../../../shared/ui/glossary.ts';
import { bindCurtain, paintCurtain as paintShellCurtain } from '../../../../shared/ui/curtain.ts';
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
import { COLORS, type Card, type Color } from '../engine/cards.ts';
import { cardName } from '../engine/engine.ts';
import type { View } from '../engine/view.ts';
import { bindHome, paintHome } from './home.ts';
import { aboutHtml, rulesItemsHtml } from './rules.ts';
import { SCREENS, handoffLabel, listNames, type App, type Intent } from './state.ts';

export { hideToast, showToast } from '../../../../shared/ui/shellPaint.ts';

type Dispatch = (intent: Intent) => void;

/** The glyph on a tile: the digit, or the symbol of the action. */
export const glyphOf = (card: Card): string => {
  switch (card.kind) {
    case 'number':
      return String(card.value ?? 0);
    case 'skip':
      return '⊘';
    case 'reverse':
      return '⇄';
    case 'draw2':
      return '+2';
    case 'wild':
      return 'W';
    case 'wild4':
      return '+4';
  }
};

export const COLOR_NAME: Readonly<Record<Color, string>> = {
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
};

/** One card as a tile: `data-color` paints it (a wild is `wild`), `playable` lights it. */
export const tileHtml = (card: Card, playable: boolean | null): SafeHtml =>
  safeHtml`<button class="tile${playable === null ? ' top' : playable ? ' playable' : ' dim'}" type="button" data-id="${card.id}" data-color="${card.color ?? 'wild'}" data-kind="${card.kind}" aria-label="${cardName(card)}"><span>${glyphOf(card)}</span></button>`;

/** The seats strip: every seat's name and card count, the turn's seat lit, mine marked. */
export const seatsHtml = (v: View): string =>
  v.names
    .map(
      (name, seat) =>
        safeHtml`<li class="seat${seat === v.turn ? ' current' : ''}${seat === v.seat ? ' mine' : ''}" data-seat="${String(seat)}"><span class="seat-name">${name}</span><span class="seat-count">${String(v.counts[seat] ?? 0)}</span></li>`
          .markup,
    )
    .join('');

/** "1 card", "5 cards". */
export const cardsText = (n: number): string => `${String(n)} ${n === 1 ? 'card' : 'cards'}`;

/** One result row: a seat's name and the cards it still held. */
type ResultRow = Readonly<{ name: string; seat: number; left: number }>;

/** The result sheet's rows: the winner first, then every other seat with the cards it still held. */
export const resultRowsHtml = (v: View): string =>
  v.names
    .map((name, seat): ResultRow => ({ name, seat, left: v.counts[seat] ?? 0 }))
    .toSorted((a: ResultRow, b: ResultRow) => a.left - b.left)
    .map(
      (row: ResultRow) =>
        safeHtml`<li class="score-row${row.seat === v.winner ? ' winner' : ''}"><span>${row.name}</span><strong>${row.seat === v.winner ? 'Out!' : cardsText(row.left)}</strong></li>`
          .markup,
    )
    .join('');

const nameAt = (v: View, seat: number): string => v.names[seat] ?? '';

/** The status line: whose turn, or the round's end; the engine's note of what just happened first. */
export const statusText = (v: View): string => {
  if (v.phase === 'gameOver') return v.note;
  const whose = v.turn === v.seat ? 'Your turn' : `${nameAt(v, v.turn)}’s turn`;
  const ask = v.turn === v.seat && v.phase === 'color' ? ' · name a colour' : '';
  return `${v.note} ${whose}${ask}.`.trim();
};

/** The result sheet's title: the winner, or "You win!" on the winner's own phone. */
export const resultTitle = (v: View): string =>
  v.winner === v.seat ? 'You win!' : `${v.winner === null ? '' : nameAt(v, v.winner)} wins!`;

const paintTable = (doc: DocumentLike, app: App, v: View): void => {
  const mine = v.turn === v.seat;
  setHtml(requireId(doc, 'seats'), trustedHtml(seatsHtml(v)));
  setText(requireId(doc, 'myName'), nameAt(v, v.seat));
  setText(requireId(doc, 'oppName'), nameAt(v, (v.seat + 1) % Math.max(1, v.names.length)));
  paintConnDot(doc, 'oppDot', connDotView(app.shell));
  setText(requireId(doc, 'direction'), v.direction === 1 ? '↻' : '↺');
  setHtml(requireId(doc, 'topCard'), tileHtml(v.top, null));
  const dot = requireId(doc, 'colorDot');
  setAttr(dot, 'data-color', v.color);
  setText(dot, COLOR_NAME[v.color]);
  setText(requireId(doc, 'drawCount'), String(v.drawCount));
  const playable = new Set(v.playable);
  setHtml(requireId(doc, 'hand'), {
    kind: 'safe-html',
    markup: v.hand.map((card) => tileHtml(card, playable.has(card.id)).markup).join(''),
  });
  queryAllIn(requireId(doc, 'hand'), 'button').forEach((button) => {
    setDisabled(button, !playable.has(dataOf(button, 'id') ?? ''));
  });
  setDisabled(requireId(doc, 'drawBtn'), !(mine && v.phase === 'turn'));
  toggleClass(requireId(doc, 'passBtn'), 'hidden', !(mine && v.phase === 'drawn'));
  toggleClass(requireId(doc, 'colorPicker'), 'hidden', !(mine && v.phase === 'color'));
  setText(requireId(doc, 'statusText'), statusText(v));
  const over = v.phase === 'gameOver';
  paintSheet(doc, 'resultOverlay', over && app.table.curtain === null);
  if (over) {
    setText(requireId(doc, 'rsTitle'), resultTitle(v));
    setHtml(requireId(doc, 'rsScore'), trustedHtml(resultRowsHtml(v)));
  }
};

/** `#curtainOverlay`: the seat taking the phone, everyone else told to look away, what just happened. */
const paintCurtain = (doc: DocumentLike, app: App): void => {
  const seat = app.table.curtain;
  const v = app.shell.view;
  paintShellCurtain(
    doc,
    seat === null || v === null
      ? null
      : {
          title: `Pass the phone to ${nameAt(v, seat)}`,
          sub: `${listNames(v.names.filter((_, i) => i !== seat))}, look away`,
          last: v.note,
          button: 'Show my hand',
        },
  );
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
  paintCurtain(doc, app);
  const game = app.shell.role === 'local' ? app.shell.game : null;
  paintShellHandoff(doc, game !== null && game.game.names.length === 2 ? handoffLabel(game) : null);
  const v = app.shell.view;
  if (v !== null) paintTable(doc, app, v);
  paintOverlays(doc, app);
};

const SHEETS: ReadonlyArray<Sheet<Intent>> = [
  { overlay: 'rulesOverlay', close: 'closeRulesBtn', intent: { type: 'rules/close' } },
  { overlay: 'historyOverlay', close: 'closeHistoryBtn', intent: { type: 'history/close' } },
];

const act = (dispatch: Dispatch, action: Extract<Intent, { type: 'act' }>['action']): void => {
  dispatch({ type: 'act', action });
};

const bindTable = (doc: PageLike, dispatch: Dispatch): void => {
  listenId(doc, 'hand', 'click', (e) => {
    const button = closestFrom(e, 'button.tile');
    const id = button === null ? null : dataOf(button, 'id');
    if (id !== null && id !== '') act(dispatch, { type: 'play', id });
  });
  listenId(doc, 'colorPicker', 'click', (e) => {
    const button = closestFrom(e, 'button[data-color]');
    const color = COLORS.find((c) => c === (button === null ? null : dataOf(button, 'color')));
    if (color !== undefined) act(dispatch, { type: 'color', color });
  });
  bindButtons(
    doc,
    dispatch,
    [
      ['drawBtn', { type: 'act', action: { type: 'draw' } }],
      ['passBtn', { type: 'act', action: { type: 'pass' } }],
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

/** Every control of the page (home, curtain, table, sheets), once, at boot. */
export const bindAll = (doc: PageLike, dispatch: Dispatch): void => {
  bindHome(doc, dispatch);
  bindCurtain(doc, dispatch, (): ReadonlyArray<Intent> => [{ type: 'curtain/reveal' }]);
  bindTable(doc, dispatch);
  bindSheets(doc, SHEETS, dispatch, { escapeFallback: { type: 'escape' } });
};
