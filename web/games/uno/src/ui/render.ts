// The paint (docs/design/uno.md §7): the App onto the page's fixed ids through the DOM edge, and
// the controls bound to intents. The setup's name fields follow the seat count; the curtain names
// the seat to hand the phone to and repeats the engine's note; the table shows the top card and
// the colour in play, the direction, every seat's card count, the current hand as tiles (a
// playable one lit, the rest dimmed), Draw, Pass after a drawn card, the colour picker for a
// wild, and the scores with Next round / New game when a round or the game is over. The base
// pack is plain tiles: a colour and a glyph (§7).
import {
  closestFrom,
  dataOf,
  listenId,
  queryAllIn,
  readValue,
  requireId,
  safeHtml,
  setAttr,
  setDisabled,
  setHidden,
  setHtml,
  setText,
  setValue,
  toggleClass,
  type DocumentLike,
  type Element,
  type SafeHtml,
} from '../../../../shared/edge/dom.ts';
import { COLORS, type Card, type Color } from '../engine/cards.ts';
import { cardName, playableIds, topOf, type Game } from '../engine/engine.ts';
import { DEFAULT_SEATS, MAX_SEATS, MIN_SEATS, type App, type Intent } from './state.ts';

/** The page's ids, as index.html carries them (tools/games.ts SOLO pins them in the built page). */
export const IDS = {
  app: 'app',
  setup: 'setup',
  seatCount: 'seatCount',
  names: 'names',
  startBtn: 'startBtn',
  curtain: 'curtain',
  curtainName: 'curtainName',
  curtainNote: 'curtainNote',
  revealBtn: 'revealBtn',
  table: 'table',
  turnName: 'turnName',
  direction: 'direction',
  topCard: 'topCard',
  colorDot: 'colorDot',
  seats: 'seats',
  hand: 'hand',
  drawBtn: 'drawBtn',
  passBtn: 'passBtn',
  colorPicker: 'colorPicker',
  status: 'status',
  result: 'result',
  resultTitle: 'resultTitle',
  scores: 'scores',
  nextRoundBtn: 'nextRoundBtn',
  newGameBtn: 'newGameBtn',
} as const;

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
    default: {
      const never: never = card.kind;
      return never;
    }
  }
};

export const COLOR_NAME: Readonly<Record<Color, string>> = {
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
};

const tile = (card: Card, extra: string): SafeHtml =>
  safeHtml`<button class="tile ${extra}" type="button" data-id="${card.id}" data-color="${card.color ?? 'wild'}" data-kind="${card.kind}" aria-label="${cardName(card)}"><span>${glyphOf(card)}</span></button>`;

const nameField = (seat: number): SafeHtml =>
  safeHtml`<label class="name-field"><span>Seat ${String(seat + 1)}</span><input class="name-input" type="text" maxlength="12" placeholder="Player ${String(seat + 1)}" data-seat="${String(seat)}" autocomplete="off" /></label>`;

/** The setup's name fields for `count` seats; typed names survive a count change. */
export const paintSetup = (doc: DocumentLike, count: number): void => {
  const names = requireId(doc, IDS.names);
  const typed = queryAllIn(names, 'input').map(readValue);
  const n = Math.min(MAX_SEATS, Math.max(MIN_SEATS, count));
  setHtml(names, {
    kind: 'safe-html',
    markup: Array.from({ length: n }, (_, seat) => nameField(seat).markup).join(''),
  });
  queryAllIn(names, 'input').forEach((input, i) => {
    setValue(input, typed[i] ?? '');
  });
};

/** The names typed in the setup, one per field, in seat order (blank for a default name). */
export const readNames = (doc: DocumentLike): ReadonlyArray<string> =>
  queryAllIn(requireId(doc, IDS.names), 'input').map(readValue);

const paintSeats = (el: Element, game: Game): void => {
  setHtml(el, {
    kind: 'safe-html',
    markup: game.names
      .map(
        (name, seat) =>
          safeHtml`<li class="seat${seat === game.turn ? ' current' : ''}"><span class="seat-name">${name}</span><span class="seat-count">${String((game.hands[seat] ?? []).length)}</span></li>`
            .markup,
      )
      .join(''),
  });
};

const paintScores = (el: Element, game: Game): void => {
  setHtml(el, {
    kind: 'safe-html',
    markup: game.names
      .map(
        (name, seat) =>
          safeHtml`<li><span>${name}</span><strong>${String(game.scores[seat] ?? 0)}</strong></li>`
            .markup,
      )
      .join(''),
  });
};

const paintTable = (doc: DocumentLike, game: Game): void => {
  const top = topOf(game);
  setText(requireId(doc, IDS.turnName), game.names[game.turn] ?? '');
  setText(requireId(doc, IDS.direction), game.direction === 1 ? '→' : '←');
  setHtml(requireId(doc, IDS.topCard), tile(top, 'top'));
  const dot = requireId(doc, IDS.colorDot);
  setAttr(dot, 'data-color', game.color);
  setText(dot, COLOR_NAME[game.color]);
  paintSeats(requireId(doc, IDS.seats), game);
  const playable = new Set(playableIds(game));
  const hand = game.hands[game.turn] ?? [];
  setHtml(requireId(doc, IDS.hand), {
    kind: 'safe-html',
    markup: hand
      .map((card) => tile(card, playable.has(card.id) ? 'playable' : 'dim').markup)
      .join(''),
  });
  queryAllIn(requireId(doc, IDS.hand), 'button').forEach((button) => {
    setDisabled(button, !playable.has(dataOf(button, 'id') ?? ''));
  });
  const over = game.phase.kind === 'roundOver' || game.phase.kind === 'gameOver';
  setDisabled(requireId(doc, IDS.drawBtn), game.phase.kind !== 'turn');
  setHidden(requireId(doc, IDS.passBtn), game.phase.kind !== 'drawn');
  setHidden(requireId(doc, IDS.colorPicker), game.phase.kind !== 'color');
  setHidden(requireId(doc, IDS.result), !over);
  if (game.phase.kind === 'roundOver' || game.phase.kind === 'gameOver') {
    const name = game.names[game.phase.winner] ?? '';
    setText(
      requireId(doc, IDS.resultTitle),
      game.phase.kind === 'gameOver' ? `${name} wins the game` : `${name} goes out`,
    );
    paintScores(requireId(doc, IDS.scores), game);
    setHidden(requireId(doc, IDS.nextRoundBtn), game.phase.kind !== 'roundOver');
  }
  setText(requireId(doc, IDS.status), game.note);
};

export const paint = (doc: DocumentLike, app: App): void => {
  const root = requireId(doc, IDS.app);
  setAttr(root, 'data-screen', app.kind);
  setHidden(requireId(doc, IDS.setup), app.kind !== 'setup');
  setHidden(requireId(doc, IDS.curtain), app.kind !== 'curtain');
  setHidden(requireId(doc, IDS.table), app.kind !== 'table');
  if (app.kind === 'curtain') {
    setText(requireId(doc, IDS.curtainName), app.game.names[app.game.turn] ?? '');
    setText(requireId(doc, IDS.curtainNote), app.game.note);
    toggleClass(root, 'in-game', true);
  } else if (app.kind === 'table') {
    paintTable(doc, app.game);
    toggleClass(root, 'in-game', true);
  } else {
    toggleClass(root, 'in-game', false);
  }
};

export type Handlers = Readonly<{
  dispatch: (intent: Intent) => void;
  /** The setup's seat count changed. */
  seats: (count: number) => void;
}>;

export const bind = (doc: DocumentLike, handlers: Handlers): void => {
  listenId(doc, IDS.seatCount, 'change', () => {
    handlers.seats(Number(readValue(requireId(doc, IDS.seatCount))) || DEFAULT_SEATS);
  });
  listenId(doc, IDS.startBtn, 'click', () => {
    handlers.dispatch({ type: 'start', names: readNames(doc) });
  });
  listenId(doc, IDS.revealBtn, 'click', () => {
    handlers.dispatch({ type: 'reveal' });
  });
  listenId(doc, IDS.hand, 'click', (e) => {
    const button = closestFrom(e, 'button.tile');
    const id = button === null ? null : dataOf(button, 'id');
    if (id !== null && id !== '') handlers.dispatch({ type: 'game', intent: { type: 'play', id } });
  });
  listenId(doc, IDS.drawBtn, 'click', () => {
    handlers.dispatch({ type: 'game', intent: { type: 'draw' } });
  });
  listenId(doc, IDS.passBtn, 'click', () => {
    handlers.dispatch({ type: 'game', intent: { type: 'pass' } });
  });
  listenId(doc, IDS.colorPicker, 'click', (e) => {
    const button = closestFrom(e, 'button[data-color]');
    const color = button === null ? null : dataOf(button, 'color');
    if (color !== null && (COLORS as ReadonlyArray<string>).includes(color)) {
      handlers.dispatch({ type: 'game', intent: { type: 'color', color: color as Color } });
    }
  });
  listenId(doc, IDS.nextRoundBtn, 'click', () => {
    handlers.dispatch({ type: 'game', intent: { type: 'nextRound' } });
  });
  listenId(doc, IDS.newGameBtn, 'click', () => {
    handlers.dispatch({ type: 'newGame' });
  });
};
