// The paint (docs/design/flip7.md §7): the App onto the page's fixed ids through the DOM edge,
// and the controls bound to intents. The setup's name fields follow the seat count; the table
// shows every seat's line as tiles (numbers, modifiers, a held Second Chance) with its status and
// what it would bank, the current seat lit, Hit and Stay (Stay sleeps during the opening deal),
// the taker picker when an action card needs one, and the scores with Next round / New game when
// a round or the game is over. The base pack is plain tiles (§7).
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
import { cardName, type Card } from '../engine/cards.ts';
import {
  canHit,
  canStay,
  lineScore,
  nameOf,
  type Game,
  type Seat,
  type Status,
} from '../engine/engine.ts';
import { DEFAULT_SEATS, MAX_SEATS, MIN_SEATS, type App, type Intent } from './state.ts';

/** The page's ids, as index.html carries them (tools/games.ts SOLO pins them in the built page). */
export const IDS = {
  app: 'app',
  setup: 'setup',
  seatCount: 'seatCount',
  names: 'names',
  startBtn: 'startBtn',
  table: 'table',
  roundLabel: 'roundLabel',
  seats: 'seats',
  status: 'status',
  hitBtn: 'hitBtn',
  stayBtn: 'stayBtn',
  target: 'target',
  targetTitle: 'targetTitle',
  targetSeats: 'targetSeats',
  result: 'result',
  resultTitle: 'resultTitle',
  scores: 'scores',
  nextRoundBtn: 'nextRoundBtn',
  newGameBtn: 'newGameBtn',
} as const;

export const STATUS_LABEL: Readonly<Record<Status, string>> = {
  active: '',
  stayed: 'stayed',
  frozen: 'frozen',
  busted: 'bust',
  flip7: 'Flip 7!',
};

const tile = (card: Card): SafeHtml =>
  safeHtml`<span class="tile" data-kind="${card.kind}" aria-label="${cardName(card)}">${cardName(card)}</span>`;

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

const seatRow = (seat: Seat, index: number, game: Game): SafeHtml => {
  const current =
    index === game.turn && seat.status === 'active' && game.phase.kind !== 'roundOver';
  const label = STATUS_LABEL[seat.status];
  const tiles: SafeHtml = {
    kind: 'safe-html',
    markup: seat.line.map((card) => tile(card).markup).join(''),
  };
  return safeHtml`<li class="seat ${current ? 'current' : ''} status-${seat.status}" data-seat="${String(index)}"><div class="seat-head"><span class="seat-name">${seat.name}</span><span class="seat-bank">${String(lineScore(seat))}</span>${label === '' ? safeHtml`` : safeHtml`<span class="seat-status">${label}</span>`}</div><div class="line">${tiles}</div></li>`;
};

const paintSeats = (el: Element, game: Game): void => {
  setHtml(el, {
    kind: 'safe-html',
    markup: game.seats.map((seat, i) => seatRow(seat, i, game).markup).join(''),
  });
};

const paintScores = (el: Element, game: Game): void => {
  setHtml(el, {
    kind: 'safe-html',
    markup: game.seats
      .map(
        (seat, i) =>
          safeHtml`<li><span>${seat.name}</span><strong>${String(game.scores[i] ?? 0)}</strong></li>`
            .markup,
      )
      .join(''),
  });
};

const paintTarget = (doc: DocumentLike, game: Game): void => {
  const panel = requireId(doc, IDS.target);
  if (game.phase.kind !== 'target') {
    setHidden(panel, true);
    return;
  }
  const { card, from, choices } = game.phase;
  setHidden(panel, false);
  setText(requireId(doc, IDS.targetTitle), `${nameOf(game, from)} gives ${cardName(card)} to…`);
  setHtml(requireId(doc, IDS.targetSeats), {
    kind: 'safe-html',
    markup: choices
      .map(
        (seat) =>
          safeHtml`<button class="btn choice" type="button" data-seat="${String(seat)}">${nameOf(game, seat)}${seat === from ? ' (me)' : ''}</button>`
            .markup,
      )
      .join(''),
  });
};

const paintTable = (doc: DocumentLike, game: Game): void => {
  setText(
    requireId(doc, IDS.roundLabel),
    game.opening > 0 ? `Round ${String(game.round)} · dealing` : `Round ${String(game.round)}`,
  );
  paintSeats(requireId(doc, IDS.seats), game);
  const hit = requireId(doc, IDS.hitBtn);
  setDisabled(hit, !canHit(game));
  setText(
    hit,
    game.opening > 0 ? `Deal to ${nameOf(game, game.turn)}` : `${nameOf(game, game.turn)}: Hit`,
  );
  const stay = requireId(doc, IDS.stayBtn);
  setDisabled(stay, !canStay(game));
  setHidden(requireId(doc, IDS.hitBtn), game.phase.kind !== 'turn');
  setHidden(stay, game.phase.kind !== 'turn');
  paintTarget(doc, game);
  const over = game.phase.kind === 'roundOver' || game.phase.kind === 'gameOver';
  setHidden(requireId(doc, IDS.result), !over);
  if (game.phase.kind === 'roundOver' || game.phase.kind === 'gameOver') {
    setText(
      requireId(doc, IDS.resultTitle),
      game.phase.kind === 'gameOver'
        ? `${nameOf(game, game.phase.winner)} wins the game`
        : `Round ${String(game.round)} over`,
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
  setHidden(requireId(doc, IDS.table), app.kind !== 'table');
  toggleClass(root, 'in-game', app.kind === 'table');
  if (app.kind === 'table') paintTable(doc, app.game);
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
  listenId(doc, IDS.hitBtn, 'click', () => {
    handlers.dispatch({ type: 'game', intent: { type: 'hit' } });
  });
  listenId(doc, IDS.stayBtn, 'click', () => {
    handlers.dispatch({ type: 'game', intent: { type: 'stay' } });
  });
  listenId(doc, IDS.targetSeats, 'click', (e) => {
    const button = closestFrom(e, 'button[data-seat]');
    const seat = button === null ? null : dataOf(button, 'seat');
    if (seat !== null && seat !== '') {
      handlers.dispatch({ type: 'game', intent: { type: 'give', seat: Number(seat) } });
    }
  });
  listenId(doc, IDS.nextRoundBtn, 'click', () => {
    handlers.dispatch({ type: 'game', intent: { type: 'nextRound' } });
  });
  listenId(doc, IDS.newGameBtn, 'click', () => {
    handlers.dispatch({ type: 'newGame' });
  });
};
