// The paint (docs/design/hearts.md §3, §8): the App onto the composed shell page (page.ts) through
// the DOM edge, after every intent, and every control bound to an intent. The shell's halves are
// web/shared/ui/shellPaint.ts's (the screens, the waiting rooms, the names strip, the sheets, the
// curtain) and seatedHome.ts's; the table is this file's (AGENT.md "The table shows every seat"):
// every other seat a chip in the background row (its name, its cards left, its score, "passed" in
// the pass), the trick in the middle with the leader marked and each card named by its seat, this
// phone's seat in the foreground (its name, score and the hand of card faces: the three picked in
// the pass lifted, an illegal card dimmed in play), the seat to play lit, the hand's pass direction
// and "hearts broken" once a heart fell. The pauses and the result sheet are the shell's sheets
// (`paintShellSheets`, `paintResult`), with Next hand or Play again as the primary.
import {
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
import { defaultPackFor, packByName } from '../../../../shared/lib/cards/packs.ts';
import { resolveFace } from '../../../../shared/lib/cards/resolve.ts';
import { listNames } from '../../../../shared/lib/name.ts';
import { backHtml, faceHtml } from '../../../../shared/ui/cardFace.ts';
import {
  bindCurtain,
  curtainText as shellCurtainText,
  paintCurtain as paintShellCurtain,
} from '../../../../shared/ui/curtain.ts';
import { handoffLabelOf } from '../../../../shared/ui/shell.ts';
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
import type { PassDirection, Trick } from '../engine/engine.ts';
import { type Seat, type View } from '../engine/view.ts';
import { bindHome, paintHome } from './home.ts';
import { HEARTS, endWords, scoreLine, type App, type Intent, type Hearts } from './state.ts';

export { hideToast, showToast } from '../../../../shared/ui/shellPaint.ts';

const PACK = packByName(defaultPackFor('french52'));

const nameAt = (v: View, seat: Seat): string => v.names[seat] ?? '';

/** One French card face through the default pack (gin's glyph renderer); an id outside the deck paints a back. */
const cardHtml = (id: string, extra = ''): SafeHtml => {
  const spec = resolveFace(PACK, 'french52', id);
  return {
    kind: 'safe-html',
    markup: spec === null ? backHtml(extra) : faceHtml(spec, extra === '' ? {} : { extra }),
  };
};

/** The pass direction's words for the hand row. */
export const directionText = (d: PassDirection): string => {
  switch (d) {
    case 'left':
      return 'pass left';
    case 'right':
      return 'pass right';
    case 'across':
      return 'pass across';
    case 'hold':
      return 'no pass';
  }
};

/** The hand row: the hand's number and its pass. */
export const roundText = (v: View): string =>
  `Hand ${String(v.round)} · ${directionText(v.direction)}`;

/** The status line: in the pass who still chooses; in play whose turn; between hands the engine's note. */
export const statusText = (v: View): string => {
  if (v.phase === 'passing') {
    if (v.myPass !== null) {
      const waiting = v.names.filter((_, i) => !(v.passed[i] ?? false));
      return waiting.length === 0 ? v.note : `Waiting for ${listNames(waiting)} to pass.`;
    }
    return 'Choose three cards to pass.';
  }
  const turn = v.turn;
  if (turn === null) return v.note;
  const whose = turn === v.seat ? 'Your turn' : `${nameAt(v, turn)}’s turn`;
  return `${v.note} ${whose}.`.trim();
};

/** A seat's chip: lit when it is the seat to play (`current`), marked when it has passed. */
const chipHtml = (v: View, i: Seat): SafeHtml => {
  const current = v.turn === i && v.phase === 'playing';
  const passed = v.phase === 'passing' && (v.passed[i] ?? false);
  const cls = `seat${current ? ' current' : ''}${passed ? ' passed' : ''}`;
  return safeHtml`<li class="${cls}" data-seat="${String(i)}"><span class="seat-name">${nameAt(v, i)}</span><span class="seat-cards" title="Cards in hand">${String(v.counts[i] ?? 0)}</span><span class="seat-score" title="Score">${String(v.scores[i] ?? 0)}</span></li>`;
};

/** The other seats in seat order from the one after mine, each a chip in the background row. */
const paintOthers = (el: Element, v: View): void => {
  const n = v.names.length;
  const order = Array.from({ length: n - 1 }, (_, k) => (v.seat + 1 + k) % n);
  setAttr(el, 'data-count', String(order.length));
  setHtml(el, { kind: 'safe-html', markup: order.map((i) => chipHtml(v, i).markup).join('') });
};

/** One play of the trick: the card over its seat's name; the leader's marked (`lead`). */
const playHtml = (v: View, trick: Trick, seat: Seat, card: string): SafeHtml =>
  safeHtml`<div class="play${seat === trick.leader ? ' lead' : ''}" data-seat="${String(seat)}">${cardHtml(card)}<span class="play-name">${nameAt(v, seat)}</span></div>`;

/** The trick in the middle: the cards so far in play order; between tricks the one just taken, so the table reads it. */
const paintTrick = (el: Element, v: View): void => {
  const shown: Trick =
    v.trick.plays.length === 0 && v.lastTrick !== null && v.phase === 'playing'
      ? v.lastTrick
      : v.trick;
  setAttr(el, 'data-count', String(shown.plays.length));
  setHtml(el, {
    kind: 'safe-html',
    markup: shown.plays.map((p) => playHtml(v, shown, p.seat, p.card).markup).join(''),
  });
};

/** What a tap on a hand card may do now: pick it (the pass), play it (my turn), or nothing. */
const tapState = (app: App, v: View): 'pick' | 'play' | null => {
  if (app.table.curtain !== null || app.shell.pause !== null) return null;
  if (v.phase === 'passing') return v.myPass === null ? 'pick' : null;
  return v.phase === 'playing' && v.turn === v.seat ? 'play' : null;
};

/** My hand: every card a face; `picked` on the pass's three, `dim` on a card I may not play now. */
export const handHtml = (
  v: View,
  picked: ReadonlyArray<string>,
  tap: 'pick' | 'play' | null,
): string => {
  const legal = new Set(v.legal.flatMap((a) => (a.type === 'play' ? [a.id] : [])));
  const dimmed = (id: string): boolean => tap === 'play' && !legal.has(id);
  return v.hand
    .map(
      (id) =>
        cardHtml(
          id,
          [picked.includes(id) ? 'picked' : '', dimmed(id) ? 'dim' : '']
            .filter((c) => c !== '')
            .join(' '),
        ).markup,
    )
    .join('');
};

/** The result sheet's words at a hand's or the game's end: the title, the totals a row a seat, Next hand or Play again (held for a guest between hands). */
export const resultWords = (app: App, v: View): ResultWords => {
  const end = endWords(v);
  return {
    title: end === null ? `Hand ${String(v.round)} over` : end.title,
    score: {
      key: `${String(v.startedAt)}:${String(v.round)}:${v.phase}`,
      html: () =>
        v.names
          .map(
            (n, i) =>
              safeHtml`<div class="score-row${v.winners.includes(i) ? ' winner' : ''}"><span>${n}</span><strong>${String(v.scores[i] ?? 0)}</strong></div>`
                .markup,
          )
          .join(''),
    },
    primary: {
      id: 'rsNextBtn',
      label: end === null ? 'Next hand' : 'Play again',
      disabled: app.shell.role === 'guest' && end === null,
    },
  };
};

const paintTable = (doc: DocumentLike, app: App, v: View): void => {
  const tap = tapState(app, v);
  const mine = v.phase === 'playing' && v.turn === v.seat;
  setText(requireId(doc, 'roundLabel'), roundText(v));
  toggleClass(requireId(doc, 'heartsFlag'), 'hidden', !v.heartsBroken);
  paintOthers(requireId(doc, 'others'), v);
  paintTrick(requireId(doc, 'trick'), v);
  const me = requireId(doc, 'mySeat');
  toggleClass(me, 'current', mine);
  setText(requireId(doc, 'mySeatName'), nameAt(v, v.seat));
  setText(requireId(doc, 'myScore'), String(v.scores[v.seat] ?? 0));
  const hand = requireId(doc, 'hand');
  setAttr(hand, 'data-tap', tap ?? '');
  setHtml(hand, { kind: 'safe-html', markup: handHtml(v, app.table.picked, tap) });
  const passBtn = requireId(doc, 'passBtn');
  toggleClass(passBtn, 'hidden', tap !== 'pick');
  setDisabled(passBtn, app.table.picked.length !== 3);
  setText(requireId(doc, 'statusText'), statusText(v));
  const over = v.phase === 'handOver' || v.phase === 'gameOver';
  const open = over && app.shell.pause === null && app.table.curtain === null;
  paintResult(doc, open, over ? resultWords(app, v) : null);
};

/** The curtain for the seat the phone goes to (ui/state.ts `viewer`): its name and the last note; hidden when no seat waits. "Continue online" shows under it when the shell says the game can go on as a room. */
const paintCurtain = (doc: DocumentLike, app: App): void => {
  const seat = app.table.curtain;
  const v = app.shell.view;
  paintShellCurtain(
    doc,
    seat === null || v === null
      ? null
      : shellCurtainText({
          to: nameAt(v, seat),
          sub: v.phase === 'passing' ? 'Everyone else looks away: you choose your pass.' : '',
          last: v.phase === 'passing' ? roundText(v) : scoreLine(v, v.scores),
        }),
    handoffLabelOf(app.shell, HEARTS) !== null,
  );
};

/** The shell's chrome first (the screens, the rooms, the 🌐, the dot and the names strip off the view), then the page's own. */
export const paint = (doc: PageLike, app: App): void => {
  paintShellChrome(doc, app.shell, {
    handoff: handoffLabelOf(app.shell, HEARTS),
    connDot: 'oppDot',
    names: (v) => ({
      me: nameAt(v, v.seat),
      others: listNames(v.names.filter((_, i) => i !== v.seat)),
    }),
  });
  paintHome(doc, app);
  const v = app.shell.view;
  if (v !== null) paintTable(doc, app, v);
  paintCurtain(doc, app);
  paintShellSheets(doc, app.shell);
};

/** Every control of the page (home, table, sheets), once, at boot. */
export const bindAll = (doc: PageLike, dispatch: Dispatch<Intent>): void => {
  bindHome(doc, dispatch);
  bindButtons(
    doc,
    dispatch,
    [
      ...shellButtons<Hearts>(),
      ['passBtn', { type: 'pass/click' }],
      ['rsNextBtn', { type: 'next/click' }],
      ['rsLeaveBtn', { type: 'leave/request' }],
    ],
    { skipDisabled: true },
  );
  bindDelegated<Hearts>(doc, dispatch, [
    {
      id: 'hand',
      selector: '.card[data-card]',
      key: 'card',
      intent: (id) => ({ type: 'card/tap', id }),
    },
  ]);
  bindCurtain<Hearts>(doc, dispatch);
  bindShellSheets<Hearts>(doc, dispatch);
};
