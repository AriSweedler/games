// Hearts's paint (docs/design/hearts.md §3): the App onto the composed shell page (page.ts) through the
// DOM edge, and every control bound to an intent. The shell's half is web/shared/ui's (the screens,
// the waiting rooms, the home tabs, the sheets, the curtain); the table is this file's: the names
// strip (`#myName`, `#oppName`, `#oppDot`), the board slot (`#board`: TODO, the game's own), the
// status line, Pass and Resign while the game is on, and the result sheet after the end's pause
// (the shell's sheet, cleared by Continue) with Play again.
import {
  requireId,
  setDisabled,
  setText,
  toggleClass,
  type DocumentLike,
  type PageLike,
} from '../../../../shared/edge/dom.ts';
import {
  bindCurtain,
  curtainText as shellCurtainText,
  paintCurtain as paintShellCurtain,
} from '../../../../shared/ui/curtain.ts';
import { handoffLabelOf } from '../../../../shared/ui/shell.ts';
import {
  bindButtons,
  bindShellSheets,
  paintResult,
  paintShellChrome,
  paintShellSheets,
  type Dispatch,
} from '../../../../shared/ui/shellPaint.ts';
import { type Seat, type View } from '../engine/view.ts';
import { bindHome, paintHome } from './home.ts';
import { HEARTS, endWords, type App, type Intent, type Hearts } from './state.ts';

export { hideToast, showToast } from '../../../../shared/ui/shellPaint.ts';

const nameAt = (v: View, seat: Seat): string => v.names[seat] ?? '';

/** The status line: the engine's note of what just happened, then whose turn (or the end). */
export const statusText = (v: View): string => {
  const turn = v.turn;
  if (turn === null) return v.note;
  const whose = turn === v.seat ? 'Your turn' : `${nameAt(v, turn)}’s turn`;
  return `${v.note} ${whose}.`.trim();
};

const paintTable = (doc: DocumentLike, app: App, v: View): void => {
  const mine = v.turn === v.seat;
  const over = v.phase === 'gameOver';
  // The scaffold's two buttons until the table row paints the hand: Pass is "Next hand" between hands, Resign is unused.
  const between = v.phase === 'handOver';
  toggleClass(requireId(doc, 'board'), 'turn', mine);
  toggleClass(requireId(doc, 'passBtn'), 'hidden', !between);
  setDisabled(requireId(doc, 'passBtn'), !between);
  toggleClass(requireId(doc, 'resignBtn'), 'hidden', true);
  setDisabled(requireId(doc, 'resignBtn'), true);
  toggleClass(requireId(doc, 'againBtn'), 'hidden', !(over && app.shell.pause === null));
  setText(requireId(doc, 'statusText'), statusText(v));
  // The end's words on the result sheet once its pause (the shell's) was read.
  const end = endWords(v);
  paintResult(
    doc,
    over && app.shell.pause === null,
    end === null ? null : { title: end.title, score: end.detail },
  );
};

/** The curtain for the seat the phone goes to (ui/state.ts `viewer`): its name and the last note; hidden when no seat waits. The button is the page's `revealLabel`; "Continue online" shows under it when the shell says the game can go on as a room. */
const paintCurtain = (doc: DocumentLike, app: App): void => {
  const seat = app.table.curtain;
  const v = app.shell.view;
  paintShellCurtain(
    doc,
    seat === null || v === null
      ? null
      : shellCurtainText({ to: nameAt(v, seat), sub: '', last: v.note }),
    handoffLabelOf(app.shell, HEARTS) !== null,
  );
};

/** The shell's sheets (the rules, the history with the recent games, the pause the page opts into), off the shell's own flags. */
const paintOverlays = (doc: DocumentLike, app: App): void => {
  paintShellSheets(doc, app.shell);
};

/** The shell's chrome first (the screens, the rooms, the 🌐, the dot and the names strip off the view), then the page's own. */
export const paint = (doc: PageLike, app: App): void => {
  paintShellChrome(doc, app.shell, {
    handoff: handoffLabelOf(app.shell, HEARTS),
    connDot: 'oppDot',
    names: (v) => ({
      me: nameAt(v, v.seat),
      others: v.names.filter((_, i) => i !== v.seat).join(', '),
    }),
  });
  paintHome(doc, app);
  const v = app.shell.view;
  if (v !== null) paintTable(doc, app, v);
  paintCurtain(doc, app);
  paintOverlays(doc, app);
};

const bindTable = (doc: PageLike, dispatch: Dispatch<Intent>): void => {
  bindButtons(
    doc,
    dispatch,
    [
      ['passBtn', { type: 'act', action: { type: 'nextHand' } }],
      ['againBtn', { type: 'again/click' }],
      ['rsAgainBtn', { type: 'again/click' }],
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

/** Every control of the page (home, table, sheets), once, at boot. */
export const bindAll = (doc: PageLike, dispatch: Dispatch<Intent>): void => {
  bindHome(doc, dispatch);
  bindTable(doc, dispatch);
  bindCurtain<Hearts>(doc, dispatch);
  bindShellSheets<Hearts>(doc, dispatch);
};
