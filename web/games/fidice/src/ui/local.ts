// Pass the phone on one phone (docs/design/fidice-shell-adoption.md §7 D8): the curtain that names
// whose turn it is while the phone changes hands and tells every other player to look away, one
// tap to lift it (the legacy cover-then-confirm, src/app/controller.ts `handoff`, is gone). The
// turn flow itself is the reducer's (ui/state.ts `viewer`: whose view is shown, when the curtain
// comes up, never at a table with one human or none); this is its DOM half, written only while
// the curtain is up (gin's rule: the texts are left as they were when it hides), and the curtain
// button's wiring. The DOM half is the shared shell's (web/shared/ui/curtain.ts); the copy stays
// here. The view under the curtain is the incoming player's own, so nothing under it is shown
// until they lift it.
import type { PageLike } from '../../../../shared/edge/dom.ts';
import {
  bindCurtain,
  curtainText as shellCurtainText,
  paintCurtain as paintShellCurtain,
  type CurtainText,
} from '../../../../shared/ui/curtain.ts';
import type { PublicState, Seat } from '../domain/types.ts';
import { engineSeatOf } from '../shellConfig.ts';
import { listNames } from '../../../../shared/lib/name.ts';
import type { App, Fidice, Intent } from './state.ts';

export type { CurtainText };
/** `#curtainLast` before any table talk. */
export const FRESH_ROLL_MSG = 'A fresh roll waits under the cup.';

/** `#curtainSub`: every other human at the table, told to look away; the computers need no telling. */
export const lookAwayText = (v: PublicState, incoming: Seat): string => {
  const others = v.players.filter((p, i) => i !== incoming && p.bot === null).map((p) => p.name);
  return others.length === 0 ? 'Everyone else, look away' : `${listNames(others)}, look away`;
};

/** `#curtainLast`: the table talk's last line (public: a bid, a call, a reveal), or the fresh roll before any. */
export const lastLineText = (v: PublicState): string =>
  v.log[v.log.length - 1]?.text ?? FRESH_ROLL_MSG;

/** The curtain for the chair the phone is handed to; the button is the page's `Lift the cup`. */
export const curtainText = (v: PublicState, incoming: Seat): CurtainText =>
  shellCurtainText({
    to: v.players[incoming]?.name ?? '?',
    sub: lookAwayText(v, incoming),
    last: lastLineText(v),
  });

/** `#curtainOverlay` and its texts from the App; hidden (texts untouched) when no seat is waiting. */
export const paintCurtain = (doc: PageLike, app: App): void => {
  const seat = app.table.curtain;
  const v = app.shell.view;
  const chair = seat === null || v === null ? null : engineSeatOf(v, seat);
  paintShellCurtain(doc, chair === null || v === null ? null : curtainText(v, chair));
};

/** `#curtainBtn`: the incoming seat lifts the curtain, one tap (D8). */
export const bindLocal = (doc: PageLike, dispatch: (intent: Intent) => void): void => {
  bindCurtain<Fidice>(doc, dispatch);
};
