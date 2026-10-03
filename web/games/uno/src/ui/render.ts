// The paint (docs/design/uno.md §9): the App onto the composed shell page (page.ts) through the
// DOM edge, and every control bound to an intent. The shell's half is web/shared/ui's (the screens,
// the waiting rooms, the home tabs, the curtain, the sheets); the table is this file's: every
// seat's name and card count (the turn lit), the names strip (`#myName`, `#oppName`: the seat
// after mine, `#oppDot`), the direction, the top card and the colour in play, my hand as tiles (a
// playable one lit, the rest dimmed; nothing lit off my turn), Draw, Pass after a drawn card, the
// colour picker for my wild, the UNO button while I may call (at two cards on my turn, or my
// window still open) and Call out UNO while another seat is at one card without the call (§7;
// both off my turn too), the status line, and the result sheet (one round is the game: the
// winner, the cards every other seat still held, Play again). The base pack is plain tiles: a
// colour and a glyph. The hand and the pile's top are keyed slots (keyed.ts `ensureKeyed`), so a
// repaint of the same view keeps their tiles and a flight's `arriving` survives it; the motion
// layer (ui/motion.ts) plans its flights off the table before it repaints and runs them after.
import {
  dataOf,
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
import {
  bindCurtain,
  curtainText as shellCurtainText,
  paintCurtain as paintShellCurtain,
} from '../../../../shared/ui/curtain.ts';
import { ensureKeyed } from '../../../../shared/ui/keyed.ts';
import { DEFAULT_LOCAL_NAMES, handoffLabelOf } from '../../../../shared/ui/shell.ts';
import {
  bindButtons,
  bindDelegated,
  bindShellSheets,
  paintResult,
  paintShellChrome,
  paintShellSheets,
  shellButtons,
  type Dispatch,
  type ResultWords,
} from '../../../../shared/ui/shellPaint.ts';
import { COLORS, type Card, type Color } from '../engine/cards.ts';
import { cardName } from '../engine/engine.ts';
import type { View } from '../engine/view.ts';
import { flyCards, planFlights, type Flight } from './motion.ts';
import { listNames } from '../../../../shared/lib/name.ts';
import { seatedHome } from '../../../../shared/ui/seatedHome.ts';
import { MAX_SEATS, MIN_SEATS } from '../shellConfig.ts';
import { HOME_TABS, UNO, namesOf, type App, type Intent, type Uno } from './state.ts';

/** The home screen (web/shared/ui/seatedHome.ts): the shell's, two to twelve on both steppers, one name input per seat. */
const home = seatedHome<Uno>({
  seats: { min: MIN_SEATS, max: MAX_SEATS },
  localNames: DEFAULT_LOCAL_NAMES,
  allNames: namesOf,
  tabs: HOME_TABS,
});

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

/** The seats strip: every seat's name and card count (`data-count`, read back by ui/motion.ts), the turn's seat lit, mine marked. */
export const seatsHtml = (v: View): string =>
  v.names
    .map(
      (name, seat) =>
        safeHtml`<li class="seat${seat === v.turn ? ' current' : ''}${seat === v.seat ? ' mine' : ''}" data-seat="${String(seat)}" data-count="${String(v.counts[seat] ?? 0)}"><span class="seat-name">${name}</span><span class="seat-count">${String(v.counts[seat] ?? 0)}</span></li>`
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
        safeHtml`<div class="score-row${row.seat === v.winner ? ' winner' : ''}"><span>${row.name}</span><strong>${row.seat === v.winner ? 'Out!' : cardsText(row.left)}</strong></div>`
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

/** The sheet's words at the game's end (shellPaint.ts `paintResult`): the title and the rows, keyed on themselves (fixed once over). */
export const resultWords = (v: View): ResultWords => {
  const rows = resultRowsHtml(v);
  return { title: resultTitle(v), score: { key: rows, html: () => rows } };
};

const paintTable = (doc: DocumentLike, app: App, v: View): void => {
  const mine = v.turn === v.seat;
  setHtml(requireId(doc, 'seats'), trustedHtml(seatsHtml(v)));
  setText(requireId(doc, 'direction'), v.direction === 1 ? '↻' : '↺');
  ensureKeyed(requireId(doc, 'topCard'), v.top.id, () => tileHtml(v.top, null).markup);
  const dot = requireId(doc, 'colorDot');
  setAttr(dot, 'data-color', v.color);
  setText(dot, COLOR_NAME[v.color]);
  setText(requireId(doc, 'drawCount'), String(v.drawCount));
  const playable = new Set(v.playable);
  // Keyed on what the tiles show, so a repaint that changes none of it keeps them (and a flight's `arriving`).
  const handKey = v.hand.map((card) => `${card.id}${playable.has(card.id) ? '*' : ''}`).join(',');
  ensureKeyed(requireId(doc, 'hand'), handKey, () =>
    v.hand.map((card) => tileHtml(card, playable.has(card.id)).markup).join(''),
  );
  queryAllIn(requireId(doc, 'hand'), 'button').forEach((button) => {
    setDisabled(button, !playable.has(dataOf(button, 'id') ?? ''));
  });
  setDisabled(requireId(doc, 'drawBtn'), !(mine && v.phase === 'turn'));
  toggleClass(requireId(doc, 'passBtn'), 'hidden', !(mine && v.phase === 'drawn'));
  toggleClass(requireId(doc, 'unoBtn'), 'hidden', !v.canUno);
  toggleClass(requireId(doc, 'callOutBtn'), 'hidden', !v.canCallOut);
  toggleClass(requireId(doc, 'colorPicker'), 'hidden', !(mine && v.phase === 'color'));
  setText(requireId(doc, 'statusText'), statusText(v));
  const over = v.phase === 'gameOver';
  paintResult(doc, over && app.table.curtain === null, over ? resultWords(v) : null);
};

/** `#curtainOverlay`: the seat taking the phone, everyone else told to look away, what just happened; the button is the page's `Show my hand`. */
const paintCurtain = (doc: DocumentLike, app: App): void => {
  const seat = app.table.curtain;
  const v = app.shell.view;
  paintShellCurtain(
    doc,
    seat === null || v === null
      ? null
      : shellCurtainText({
          to: nameAt(v, seat),
          sub: `${listNames(v.names.filter((_, i) => i !== seat))}, look away`,
          last: v.note,
        }),
  );
};

export const paint = (doc: PageLike, app: App): void => {
  paintShellChrome(doc, app.shell, {
    handoff: handoffLabelOf(app.shell, UNO),
    connDot: 'oppDot',
    // The strip names the seat after mine: the one the play passes to.
    names: (v) => ({
      me: nameAt(v, v.seat),
      others: nameAt(v, (v.seat + 1) % Math.max(1, v.names.length)),
    }),
  });
  home.paintHome(doc, app);
  paintCurtain(doc, app);
  const v = app.shell.view;
  // Planned before the table repaints: my played tile's slot goes with it (ui/motion.ts).
  const flights: ReadonlyArray<Flight> = v === null ? [] : planFlights(doc, v);
  if (v !== null) paintTable(doc, app, v);
  flyCards(doc, flights);
  paintShellSheets(doc, app.shell);
};

/** A tap on a tile in my hand plays it; one on a swatch of the colour picker names my wild's colour (only one of the four). */
const bindTable = (doc: PageLike, dispatch: Dispatch<Intent>): void => {
  bindDelegated<Uno>(doc, dispatch, [
    {
      id: 'hand',
      selector: 'button.tile',
      key: 'id',
      intent: (id) => ({ type: 'act', action: { type: 'play', id } }),
    },
    {
      id: 'colorPicker',
      selector: 'button[data-color]',
      key: 'color',
      intent: (raw) => {
        const color = COLORS.find((c) => c === raw);
        return color === undefined ? null : { type: 'act', action: { type: 'color', color } };
      },
    },
  ]);
  bindButtons(
    doc,
    dispatch,
    [
      ['drawBtn', { type: 'act', action: { type: 'draw' } }],
      ['passBtn', { type: 'act', action: { type: 'pass' } }],
      ['unoBtn', { type: 'act', action: { type: 'uno' } }],
      ['callOutBtn', { type: 'act', action: { type: 'callOut' } }],
      ['rsAgainBtn', { type: 'act', action: { type: 'again' } }],
      ['rsLeaveBtn', { type: 'leave/request' }],
      ...shellButtons<Uno>(),
    ],
    { skipDisabled: true },
  );
};

/** Every control of the page (home, curtain, table, sheets), once, at boot. */
export const bindAll = (doc: PageLike, dispatch: Dispatch<Intent>): void => {
  home.bindHome(doc, dispatch);
  bindCurtain<Uno>(doc, dispatch);
  bindTable(doc, dispatch);
  bindShellSheets<Uno>(doc, dispatch);
};
