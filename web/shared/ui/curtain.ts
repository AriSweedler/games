// The pass-and-play curtain's DOM half, the same in every game (docs/design/shared-shell.md §4.4
// `curtain.ts`; §5 B1): `#curtainOverlay` and its texts, written only while the curtain is up
// (the legacy `showCurtain` left the texts as they were when it hid the sheet, and both games
// kept that rule), its "Continue online" button (`#curtainHandoffBtn`, the markup's since
// docs/design/dry-review-2026-10.md §7 row 12: shown when the game says the hand-over can go on
// as a room, shell.ts `handoffLabelOf`; three games toggled and bound their own before), and the
// two buttons' wiring. The copy is each game's: its `curtainText`
// names who takes the phone, the line under the title and the last line, through `curtainText`
// here, which spells the title once (docs/design/dry-review-2026-10.md §2.8: five games wrote
// `Pass the phone to ${name}`). The button's words are the markup's (`revealLabel` in the page
// copy) unless the game's follow the view (gin names the seat, backgammon the phase), so
// `button` is optional and the constants repeating the page's label went with the review's row 5.
// Until backgammon's roll modal (old repo PR 79, docs/design/backgammon-board.md §4.7) the button
// also carried a `data-rolls` promise, painted through an `attrs` field on `CurtainText` and read
// back by `onReveal(btn)`; docs/design/dry-round-2.md §3 row E10 deleted both once no game passed
// or read one. Not lint-pure: see shellPaint.ts.
import { listenId, requireId, setText, toggleClass, type DocumentLike } from '../edge/dom.ts';

import type { Intent, ShellTypes } from './shell.ts';
import type { Dispatch } from './shellPaint.ts';

export type CurtainText = Readonly<{
  title: string;
  sub: string;
  last: string;
  /** The button's live words where they follow the view; left out, the markup's `revealLabel` stands. */
  button?: string;
}>;

/** What a game says of a hand-over: who takes the phone (`to`), the line under the title, the last line, and the button's words where they are live. */
export type HandoverWords = Readonly<{
  to: string;
  sub: string;
  last: string;
  button?: string;
}>;

/** The curtain for the seat the phone goes to: the title spelled once for every game. */
export const curtainText = ({ to, ...rest }: HandoverWords): CurtainText => ({
  title: `Pass the phone to ${to}`,
  ...rest,
});

/**
 * `#curtainOverlay` and its texts; hidden (texts untouched) when no seat is waiting (`text` null).
 * The button keeps the markup's words unless `button` is given. `#curtainHandoffBtn` shows under
 * it while the curtain is up and `handoff` says the game can go on online (the caller's
 * `handoffLabelOf(shell, cfg) !== null`, and whatever else it rules, backgammon's first curtain).
 */
export const paintCurtain = (
  doc: DocumentLike,
  text: CurtainText | null,
  handoff = false,
): void => {
  const overlay = requireId(doc, 'curtainOverlay');
  toggleClass(overlay, 'hidden', text === null);
  toggleClass(requireId(doc, 'curtainHandoffBtn'), 'hidden', text === null || !handoff);
  if (text === null) return;
  setText(requireId(doc, 'curtainTitle'), text.title);
  setText(requireId(doc, 'curtainSub'), text.sub);
  setText(requireId(doc, 'curtainLast'), text.last);
  if (text.button !== undefined) setText(requireId(doc, 'curtainBtn'), text.button);
};

/** What one tap does unless the game says otherwise: the shell's reveal (shell.ts `curtain/reveal`). */
const reveal = <G extends ShellTypes>(): ReadonlyArray<Intent<G>> => [{ type: 'curtain/reveal' }];

/**
 * `#curtainBtn`: one tap dispatches, in order, what `onReveal` returns at that moment; every game
 * today reveals (backgammon's roll is the roll modal's, design §4.7), so the default is the shell's
 * reveal and a game names `onReveal` only to do more. `#curtainHandoffBtn`: the shell's
 * `handoff/click`, the same tap as the topbar's 🌐.
 */
export const bindCurtain = <G extends ShellTypes>(
  doc: DocumentLike,
  dispatch: Dispatch<Intent<G>>,
  onReveal: () => ReadonlyArray<Intent<G>> = reveal<G>,
): void => {
  listenId(doc, 'curtainBtn', 'click', () => {
    onReveal().forEach((intent) => {
      dispatch(intent);
    });
  });
  listenId(doc, 'curtainHandoffBtn', 'click', () => {
    dispatch({ type: 'handoff/click' });
  });
};
