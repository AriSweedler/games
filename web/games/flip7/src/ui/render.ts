// The paint (docs/design/flip7.md §8): the App onto the composed shell page (page.ts) through the
// DOM edge, after every intent, and the controls bound to intents. The shell's halves are
// web/shared/ui/shellPaint.ts's (the screens, the waiting rooms, the sound button, the handoff, the
// sheets) and ui/home.ts's; the table is this game's: every seat's line as plain tiles with its
// status and what it would bank, the seat acting lit, Hit and Stay for the seat whose turn it is,
// the taker picker for the seat that flipped an action card, and the scores with Next round (the
// host's) or Play again once a round or the game is over.
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
  type Element,
  type PageLike,
  type SafeHtml,
} from '../../../../shared/edge/dom.ts';
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
import { cardName, type Card } from '../engine/cards.ts';
import { lineScore } from '../engine/engine.ts';
import { actorOf, nameOf, type Seat, type Status, type View } from '../engine/index.ts';
import { aboutHtml } from './about.ts';
import { bindHome, paintHome } from './home.ts';
import { RULES_SLOT_IDS, rulesItemsHtml } from './rules.ts';
import { SCREENS, handoffLabel, listNames, myTurn, type App, type Intent } from './state.ts';

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

export const renderRules = (doc: DocumentLike): void => {
  const markup = trustedHtml(rulesItemsHtml());
  RULES_SLOT_IDS.forEach((id) => {
    setHtml(requireId(doc, id), markup);
  });
};

export const renderAbout = (doc: DocumentLike): void => {
  setHtml(requireId(doc, 'aboutCopy'), trustedHtml(aboutHtml()));
};

// ---- the shell's halves ---------------------------------------------------------------------

export const paintSound = (doc: DocumentLike, enabled: boolean): void => {
  paintShellSound(doc, enabled);
  setAttr(requireId(doc, 'soundBtn'), 'aria-pressed', enabled ? 'true' : 'false');
};

/** `#handoffBtn`: a two-seat pass-and-play game can go on as a hosted room. */
const paintHandoff = (doc: DocumentLike, app: App): void => {
  const game = app.shell.role === 'local' ? app.shell.game : null;
  paintShellHandoff(doc, game !== null && game.seats.length === 2 ? handoffLabel(game) : null);
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

/** One card, face up: its kind's colour and its value; `data-card` is its id, so a flip can find the card it deals. */
const tile = (card: Card): SafeHtml =>
  safeHtml`<span class="tile" data-kind="${card.kind}" data-card="${card.id}" aria-label="${cardName(card)}">${cardName(card)}</span>`;

/**
 * One seat: its name, its status badge, its total and this round's line score, and its cards; a
 * busted seat stays on the table greyed out with its Bust badge until the next deal. The foreground
 * seat (this phone's) and the background ones share the markup; the theme sizes them (`.seat.me`,
 * `.others .seat`).
 */
export const seatHtml = (seat: Seat, index: number, v: View): SafeHtml => {
  const label = STATUS_LABEL[seat.status];
  const tiles: SafeHtml = {
    kind: 'safe-html',
    markup: seat.line.map((card) => tile(card).markup).join(''),
  };
  return safeHtml`<div class="seat-head"><span class="seat-name">${seat.name}</span>${label === '' ? safeHtml`` : safeHtml`<span class="seat-status">${label}</span>`}<span class="seat-score" title="Total">${String(v.scores[index] ?? 0)}</span><span class="seat-bank" title="This round">+${String(lineScore(seat))}</span></div><div class="line">${tiles}</div>`;
};

/** A seat's class: the seat to play lit (`current`), its status for the grey of a bust. */
const seatClass = (seat: Seat, index: number, v: View): string =>
  `seat${actorOf(v) === index && v.phase.kind !== 'roundOver' ? ' current' : ''} status-${seat.status}`;

/** The other seats in seat order from the one after mine, each a small card row in the background grid. */
const paintOthers = (el: Element, v: View): void => {
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
          : safeHtml`<li class="${seatClass(seat, i, v)}" data-seat="${String(i)}">${seatHtml(seat, i, v)}</li>`
              .markup;
      })
      .join(''),
  });
};

/** This phone's own seat in the foreground. */
const paintMine = (el: Element, v: View): void => {
  const seat = v.seats[v.me];
  if (seat === undefined) return;
  setAttr(el, 'class', `${seatClass(seat, v.me, v)} me`);
  setAttr(el, 'data-seat', String(v.me));
  setHtml(el, seatHtml(seat, v.me, v));
};

const paintScores = (el: Element, v: View): void => {
  setHtml(el, {
    kind: 'safe-html',
    markup: v.seats
      .map(
        (seat, i) =>
          safeHtml`<li><span>${seat.name}</span><strong>${String(v.scores[i] ?? 0)}</strong></li>`
            .markup,
      )
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
  paintConnDot(doc, 'oppDot', connDotView(app.shell));
  setText(
    requireId(doc, 'roundLabel'),
    v.opening > 0 ? `Round ${String(v.round)} · dealing` : `Round ${String(v.round)}`,
  );
  paintOthers(requireId(doc, 'others'), v);
  paintMine(requireId(doc, 'mySeat'), v);
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
    paintScores(requireId(doc, 'scores'), v);
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
  paintShellScreen(doc, SCREENS, app.shell.screen, 'tableScreen');
  paintShellWaiting(doc, app.shell);
  paintHome(doc, app);
  paintCurtain(doc, app);
  paintHandoff(doc, app);
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
  bindHome(doc, dispatch);
  bindCurtain(doc, dispatch, (): ReadonlyArray<Intent> => [{ type: 'curtain/reveal' }]);
  bindButtons(doc, dispatch, [
    ['curtainHandoffBtn', { type: 'handoff/click' }],
    ['handoffBtn', { type: 'handoff/click' }],
    ['leaveBtn', { type: 'leave/request' }],
    ['rulesBtnGame', { type: 'rules/open' }],
    ['historyBtn', { type: 'history/open' }],
    ['soundBtn', { type: 'sound/toggle' }],
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
