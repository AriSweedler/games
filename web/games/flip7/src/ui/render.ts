// The paint (docs/design/flip7.md §8): the App onto the composed shell page (page.ts) through the
// DOM edge, after every intent, and the controls bound to intents. The shell's halves are
// web/shared/ui/shellPaint.ts's (the screens, the waiting rooms, the sound button, the handoff, the
// sheets) and ui/home.ts's; the table is this game's: every seat's line as plain tiles with its
// status and what it would bank, the seat acting lit, Hit and Stay for the seat whose turn it is,
// the taker picker for the seat that flipped an action card, and the scores with Next round (the
// host's) or Play again once a round or the game is over. The anticipation is ui/motion.ts's: the
// table the last paint left is read back before the seats repaint, and the cards, busts, Flip 7s
// and scores new to this paint carry the classes theme.css animates (`dealt`, `bust-card`,
// `busting`, `flip7-now`, `reveal`); the clock they run on is written on the root once at bind.
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
  type DocumentLike,
  type Element,
  type PageLike,
  type SafeHtml,
} from '../../../../shared/edge/dom.ts';
import { reducedMotion } from '../../../../shared/edge/motion.ts';
import { bindCurtain, paintCurtain as paintShellCurtain } from '../../../../shared/ui/curtain.ts';
import { paintRecentGames } from '../../../../shared/ui/recentGames.ts';
import {
  bindButtons,
  bindSheets,
  paintSheet,
  paintShellChrome,
  shellButtons,
  type Sheet,
} from '../../../../shared/ui/shellPaint.ts';
import { cardName, type Card } from '../engine/cards.ts';
import { lineScore } from '../engine/engine.ts';
import { actorOf, nameOf, type Seat, type Status, type View } from '../engine/index.ts';
import { bindHome, paintHome } from './home.ts';
import {
  NO_MOMENTS,
  durationsFor,
  moments,
  readPainted,
  writeClock,
  type Moments,
} from './motion.ts';
import { handoffLabel, listNames, myTurn, type App, type Flip7, type Intent } from './state.ts';

export { hideToast, showToast } from '../../../../shared/ui/shellPaint.ts';
export { fillNameInputs, fillP2NameInput, setCodeInput } from './home.ts';

export const STATUS_LABEL: Readonly<Record<Status, string>> = {
  active: '',
  stayed: 'stayed',
  frozen: 'frozen',
  busted: 'bust',
  flip7: 'Flip 7!',
};

export const REVEAL_LABEL = 'Start';
/** `#curtainSub`: nothing on the table is hidden, so nobody looks away. */
export const CURTAIN_SUB = 'Every card is face up: everyone can watch.';

// ---- the shell's halves ---------------------------------------------------------------------

/** `#handoffBtn`'s tooltip: a two-seat pass-and-play game can go on as a hosted room; null hides it. */
const handoffTitle = (app: App): string | null => {
  const game = app.shell.role === 'local' ? app.shell.game : null;
  return game !== null && game.seats.length === 2 ? handoffLabel(game) : null;
};

/** The curtain for the seat the phone goes to: its name, and the round about to be dealt. */
const paintCurtain = (doc: DocumentLike, app: App): void => {
  const seat = app.table.curtain;
  const v = app.shell.view;
  paintShellCurtain(
    doc,
    seat === null || v === null
      ? null
      : {
          title: `Pass the phone to ${nameOf(v, seat)}`,
          sub: CURTAIN_SUB,
          last: `Round ${String(v.round)} · ${nameOf(v, v.dealer)} deals`,
          button: REVEAL_LABEL,
        },
  );
  toggleHandoffUnderCurtain(doc, v);
};

const toggleHandoffUnderCurtain = (doc: DocumentLike, v: View | null): void => {
  toggleClass(requireId(doc, 'curtainHandoffBtn'), 'hidden', v?.seats.length !== 2);
};

// ---- the table ------------------------------------------------------------------------------

/** A number card's value for its face's hue (`.tile[data-value]`); an action or modifier has none. */
const valueOf = (card: Card): string =>
  card.kind === 'number' && card.value !== null ? String(card.value) : '';

/**
 * One card, face up: its kind (and a number's value) for its face's colour; `data-card` is its id.
 * A card new to this paint turns face-up where it lies (`dealt`, `--i` its place in the stagger),
 * red when it is the one that busted its seat (`bust-card`).
 */
const tile = (card: Card, m: Moments): SafeHtml => {
  const k = m.dealt.get(card.id);
  const name = cardName(card);
  if (k === undefined)
    return safeHtml`<span class="tile" data-kind="${card.kind}" data-value="${valueOf(card)}" data-card="${card.id}" aria-label="${name}">${name}</span>`;
  const stagger = `--i: ${String(k)}`;
  return m.bustCards.has(card.id)
    ? safeHtml`<span class="tile dealt bust-card" style="${stagger}" data-kind="${card.kind}" data-value="${valueOf(card)}" data-card="${card.id}" aria-label="${name}">${name}</span>`
    : safeHtml`<span class="tile dealt" style="${stagger}" data-kind="${card.kind}" data-value="${valueOf(card)}" data-card="${card.id}" aria-label="${name}">${name}</span>`;
};

/**
 * One seat: its name, its status badge, its total and this round's line score, and its cards; a
 * busted seat stays on the table greyed out with its Bust badge until the next deal. The foreground
 * seat (this phone's) and the background ones share the markup; the theme sizes them (`.seat.me`,
 * `.others .seat`). `m` names the cards and moments new to this paint (NO_MOMENTS for a still).
 */
export const seatHtml = (seat: Seat, index: number, v: View, m: Moments = NO_MOMENTS): SafeHtml => {
  const label = STATUS_LABEL[seat.status];
  const tiles: SafeHtml = {
    kind: 'safe-html',
    markup: seat.line.map((card) => tile(card, m).markup).join(''),
  };
  return safeHtml`<div class="seat-head"><span class="seat-name">${seat.name}</span>${label === '' ? safeHtml`` : safeHtml`<span class="seat-status">${label}</span>`}<span class="seat-score" title="Total">${String(v.scores[index] ?? 0)}</span><span class="seat-bank" title="This round">+${String(lineScore(seat))}</span></div><div class="line">${tiles}</div>`;
};

/** A seat's class: the seat to play lit (`current`), its status for the grey of a bust. */
const seatClass = (seat: Seat, index: number, v: View): string =>
  `seat${actorOf(v) === index && v.phase.kind !== 'roundOver' ? ' current' : ''} status-${seat.status}`;

/** The moments that are the seat's own this paint: the grey wash of a fresh bust, the gold of a fresh Flip 7. */
const markMoments = (el: Element, index: number, m: Moments): void => {
  toggleClass(el, 'busting', m.busting.has(index));
  toggleClass(el, 'flip7-now', m.flip7.has(index));
};

/** The other seats in seat order from the one after mine, each a small card row in the background grid. */
const paintOthers = (el: Element, v: View, m: Moments): void => {
  const n = v.seats.length;
  const order = Array.from({ length: n - 1 }, (_, k) => (v.me + 1 + k) % n);
  setAttr(el, 'data-count', String(order.length));
  setHtml(el, {
    kind: 'safe-html',
    markup: order
      .map((i) => {
        const seat = v.seats[i];
        return seat === undefined
          ? ''
          : safeHtml`<li class="${seatClass(seat, i, v)}" data-seat="${String(i)}">${seatHtml(seat, i, v, m)}</li>`
              .markup;
      })
      .join(''),
  });
  queryAllIn(el, '.seat[data-seat]').forEach((li) => {
    markMoments(li, Number(dataOf(li, 'seat')), m);
  });
};

/** This phone's own seat in the foreground. */
const paintMine = (el: Element, v: View, m: Moments): void => {
  const seat = v.seats[v.me];
  if (seat === undefined) return;
  setAttr(el, 'class', `${seatClass(seat, v.me, v)} me`);
  setAttr(el, 'data-seat', String(v.me));
  setHtml(el, seatHtml(seat, v.me, v, m));
  markMoments(el, v.me, m);
};

/** The round's scores: a row a seat; the rows come up one by one (`reveal`, `--i`) the paint the panel rises. */
const paintScores = (el: Element, v: View, reveal: boolean): void => {
  setHtml(el, {
    kind: 'safe-html',
    markup: v.seats
      .map((seat, i) => {
        const name = seat.name;
        const total = String(v.scores[i] ?? 0);
        return reveal
          ? safeHtml`<li class="reveal" style="${`--i: ${String(i)}`}"><span>${name}</span><strong>${total}</strong></li>`
              .markup
          : safeHtml`<li><span>${name}</span><strong>${total}</strong></li>`.markup;
      })
      .join(''),
  });
};

const paintTarget = (doc: DocumentLike, v: View, mine: boolean): void => {
  const panel = requireId(doc, 'target');
  if (v.phase.kind !== 'target' || !mine) {
    toggleClass(panel, 'hidden', true);
    return;
  }
  const { card, from, choices } = v.phase;
  toggleClass(panel, 'hidden', false);
  setText(requireId(doc, 'targetTitle'), `Give ${cardName(card)} to…`);
  setHtml(requireId(doc, 'targetSeats'), {
    kind: 'safe-html',
    markup: choices
      .map(
        (seat) =>
          safeHtml`<button class="btn choice" type="button" data-seat="${String(seat)}">${nameOf(v, seat)}${seat === from ? ' (me)' : ''}</button>`
            .markup,
      )
      .join(''),
  });
};

/** What the status line says: the engine's note, or whose move it is when it is not mine. */
export const waitText = (v: View): string => {
  const actor = actorOf(v);
  if (actor === null || actor === v.me) return '';
  if (v.phase.kind === 'roundOver') return `Waiting for ${nameOf(v, 0)} to deal the next round`;
  if (v.phase.kind === 'target') return `${nameOf(v, actor)} is giving ${cardName(v.phase.card)}`;
  return `${nameOf(v, actor)}'s turn`;
};

const paintTable = (doc: DocumentLike, app: App): void => {
  const v = app.shell.view;
  if (v === null) return;
  const mine = myTurn(app);
  const local = app.shell.role === 'local';
  setText(requireId(doc, 'myName'), nameOf(v, v.me));
  setText(
    requireId(doc, 'oppName'),
    listNames(v.seats.filter((_, i) => i !== v.me).map((s) => s.name)),
  );
  setText(
    requireId(doc, 'roundLabel'),
    v.opening > 0 ? `Round ${String(v.round)} · dealing` : `Round ${String(v.round)}`,
  );
  // What this paint adds to the table the last one left: read before the seats repaint.
  const m = moments(readPainted(doc), v);
  paintOthers(requireId(doc, 'others'), v, m);
  paintMine(requireId(doc, 'mySeat'), v, m);
  const turn = v.phase.kind === 'turn';
  const hit = requireId(doc, 'hitBtn');
  const stay = requireId(doc, 'stayBtn');
  toggleClass(hit, 'hidden', !turn || !mine);
  toggleClass(stay, 'hidden', !turn || !mine);
  setDisabled(stay, v.opening > 0);
  setText(hit, local ? `${nameOf(v, v.me)}: Hit` : 'Hit');
  paintTarget(doc, v, mine);
  const over = v.phase.kind === 'roundOver' || v.phase.kind === 'gameOver';
  toggleClass(requireId(doc, 'result'), 'hidden', !over);
  if (over) {
    setText(
      requireId(doc, 'resultTitle'),
      v.phase.kind === 'gameOver'
        ? `${nameOf(v, v.phase.winner)} wins the game`
        : `Round ${String(v.round)} over`,
    );
    paintScores(requireId(doc, 'scores'), v, m.scores);
  }
  toggleClass(requireId(doc, 'nextRoundBtn'), 'hidden', v.phase.kind !== 'roundOver' || !mine);
  toggleClass(
    requireId(doc, 'replayBtn'),
    'hidden',
    v.phase.kind !== 'gameOver' || app.shell.role === 'guest',
  );
  const wait = local ? '' : waitText(v);
  setText(requireId(doc, 'statusText'), wait === '' ? v.note : wait);
  setText(requireId(doc, 'drawCount'), `Deck · ${String(v.drawCount)}`);
};

/** The pause over the table: what happened, and Continue. */
const paintPause = (doc: DocumentLike, app: App): void => {
  const pause = app.table.pause;
  paintSheet(doc, 'pauseOverlay', pause !== null);
  if (pause === null) return;
  setText(requireId(doc, 'pauseTitle'), pause.title);
  setText(requireId(doc, 'pauseDetail'), pause.detail);
};

export const paint = (doc: PageLike, app: App): void => {
  paintShellChrome(doc, app.shell, { handoff: handoffTitle(app), connDot: 'oppDot' });
  paintHome(doc, app);
  paintCurtain(doc, app);
  paintTable(doc, app);
  paintPause(doc, app);
  paintSheet(doc, 'rulesOverlay', app.shell.rulesOpen);
  paintSheet(doc, 'historyOverlay', app.table.historyOpen);
  if (app.table.historyOpen) paintRecentGames(doc, app.shell.recentGames);
};

const SHEETS: ReadonlyArray<Sheet<Intent>> = [
  { overlay: 'rulesOverlay', close: 'closeRulesBtn', intent: { type: 'rules/close' } },
  { overlay: 'historyOverlay', close: 'closeHistoryBtn', intent: { type: 'history/close' } },
];

export const bindAll = (doc: PageLike, dispatch: (intent: Intent) => void): void => {
  // The animations' clock, once: the design's numbers, or the reduced-motion stills.
  writeClock(doc, durationsFor(reducedMotion()));
  bindHome(doc, dispatch);
  bindCurtain(doc, dispatch, (): ReadonlyArray<Intent> => [{ type: 'curtain/reveal' }]);
  bindButtons(doc, dispatch, [
    ['curtainHandoffBtn', { type: 'handoff/click' }],
    ...shellButtons<Flip7>({ rules: { type: 'rules/open' }, history: { type: 'history/open' } }),
    ['hitBtn', { type: 'hit/click' }],
    ['stayBtn', { type: 'stay/click' }],
    ['nextRoundBtn', { type: 'nextRound/click' }],
    ['replayBtn', { type: 'replay/click' }],
    ['continueBtn', { type: 'continue/click' }],
  ]);
  listenId(doc, 'targetSeats', 'click', (e) => {
    const button = closestFrom(e, 'button[data-seat]');
    const seat = button === null ? null : dataOf(button, 'seat');
    if (seat !== null && seat !== '') dispatch({ type: 'give/click', seat: Number(seat) });
  });
  bindSheets(doc, SHEETS, dispatch, { escapeFallback: { type: 'escape' } });
};
