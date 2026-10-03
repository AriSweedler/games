// The shell's painters and binders both game pages carried under the same names
// (docs/design/shared-shell.md §4.4 "Painters and binders"; §5 B1 moved them here): the screen
// switch, the waiting rooms, the toast, the sound and handoff buttons and the sheets (the keyed
// slot moved on to keyed.ts in docs/design/dry-round-2.md D1). Each is gin's `ui/render.ts` body
// (backgammon copied it word for word, docs/design/backgammon-board.md §4) over
// web/shared/edge/dom.ts, with the App replaced by the small view it
// read: `paint(doc, app)` in a game composes these with its own table painters, so the same App
// paints the same DOM as before the move (the DOM-snapshot oracle tools/parity/gin-dom-parity.ts
// and both render.test.ts suites hold it). What a game adds on top (gin's `data-card-back`,
// backgammon's `aria-pressed` and its `hit` toast) stays in that game's wrapper.
//
// Not lint-pure: these write the document, so the folder's pure profile (eslint.config.js `PURE`,
// tsconfig.pure.json) carves them out the way scorer/main.ts is, and tsconfig.web.json alone
// compiles them (they need the DOM lib through dom.ts).
import {
  blurElement,
  byId,
  dataOf,
  escapeHtml,
  focusElement,
  hasClass,
  isDisabled,
  keyOf,
  listen,
  listenId,
  queryAllIn,
  readValue,
  requireId,
  setAttr,
  setHtml,
  setText,
  setValue,
  targetIdOf,
  toggleClass,
  trustedHtml,
  type DocumentLike,
  type Element,
  type PageLike,
} from '../edge/dom.ts';
import { NAME_MAX } from '../lib/protocol.ts';
import { RULES_SLOT_IDS } from './glossary.ts';
import { ensureKeyed } from './keyed.ts';
import { paintRecentGames } from './recentGames.ts';
import {
  SHELL_SCREENS,
  type Intent,
  type Role,
  type ScreenId,
  type SeatState,
  type ShellState,
  type ShellTypes,
  type ToastKind,
} from './shell.ts';

export type Dispatch<I> = (intent: I) => void;

/** The home screen's id, the first of every shell game's `SCREENS` (shell.ts `ScreenId`). */
export const HOME_SCREEN = 'homeScreen';

/** Every sheet and the curtain: each `.overlay` in the body (page.html places them as body children, so one list finds a game's and the shell's alike; `paintGate` reads the same). */
const OVERLAYS = '.overlay';

/**
 * `showScreen(id)`: every screen but `current` gets `hidden`; the body locks to the viewport
 * (`fixed-screen`) at `fixedOn`, the table in both games. The home has no sheet (shell.ts
 * `rules/show`: at home the Rules tab is the rules), yet a game paints its own sheets with its
 * table, which it skips without a view: Hive's result sheet stayed over the home after Leave the
 * table (the owner, 2026-10-02). So the switch to the home puts every overlay away itself; the
 * paints that follow show again only what their flags say, and the leave reset those (shell.ts
 * `leaveFinish`).
 */
export const paintScreen = (
  doc: PageLike,
  screens: ReadonlyArray<string>,
  current: string,
  fixedOn: string,
): void => {
  screens.forEach((id) => {
    toggleClass(requireId(doc, id), 'hidden', id !== current);
  });
  toggleClass(doc.body, 'fixed-screen', current === fixedOn);
  if (current !== HOME_SCREEN) return;
  queryAllIn(doc.body, OVERLAYS).forEach((el) => {
    toggleClass(el, 'hidden', true);
  });
};

/** A waiting room's status line and whether it pulses (`app.hostStatus`, `app.guestStatus`). */
export type WaitStatus = Readonly<{ text: string; pulse: boolean }>;

/**
 * What `paintWaiting` reads: every game's `app.shell` (shell.ts `ShellState`) carries these. The
 * seat fields are read only for an N-seat page's `#seatList` (below), and `seatedName`, `myName`
 * and `oppName` for a page with the name card `#guestSeatName` (`paintGuestName`); gin's page has
 * neither element, so nothing of its is painted differently.
 */
export type WaitingView = Readonly<{
  code: string | null;
  hostStatus: WaitStatus;
  guestStatus: WaitStatus;
  startGameVisible: boolean;
  seats?: ReadonlyArray<SeatState>;
  mySeat?: number;
  role?: Role | null;
  myName?: string;
  oppName?: string | null;
  /** As guest, what the host calls my seat (shell.ts `seatedName`): the name card's box; null or absent paints the card hidden. */
  seatedName?: string | null;
}>;

/** One row of the waiting room's seat list: the seat, who holds it (null while empty), whether its channel is open, and whether it is the viewer's own. */
export type SeatRow = Readonly<{
  seat: number;
  name: string | null;
  connected: boolean;
  you: boolean;
}>;

/**
 * The rows off the shell (docs/design/n-seat-sessions.md §7 `paintWaiting`): the host first (seat
 * 0, its name mine as host and the host's as guest, connected because it is the room), then every
 * guest seat in order; none while no room is open (`seats` empty).
 */
export const seatRows = (
  w: Pick<WaitingView, 'seats' | 'mySeat' | 'role' | 'myName' | 'oppName'>,
): ReadonlyArray<SeatRow> => {
  const seats = w.seats ?? [];
  if (seats.length === 0) return [];
  const mySeat = w.mySeat ?? 0;
  const hostName = w.role === 'guest' ? (w.oppName ?? null) : (w.myName ?? null);
  return [
    { seat: 0, name: hostName, connected: true, you: mySeat === 0 },
    ...seats.map((s, i) => ({
      seat: i + 1,
      name: s.name,
      connected: s.connected,
      you: mySeat === i + 1,
    })),
  ];
};

/** A row's text: the name (or `Seat N` while empty), then ` · host`, ` · you`, ` · empty` as they apply. */
export const seatLabel = (row: SeatRow): string =>
  [
    row.name ?? `Seat ${String(row.seat + 1)}`,
    ...(row.seat === 0 ? ['host'] : []),
    ...(row.you ? ['you'] : []),
    ...(row.name === null ? ['empty'] : []),
  ].join(' · ');

/**
 * The list's markup: one `<li>` per row with `data-seat`, `data-connected` and, on the viewer's
 * own, `data-you`, and no class (the class contract scans web/shared for every game, so a class
 * spelled here would need a rule in every theme or a row per game; a game's sheet styles
 * `#seatList [data-connected]` as it likes).
 */
export const seatListHtml = (rows: ReadonlyArray<SeatRow>): string =>
  rows
    .map(
      (row) =>
        `<li data-seat="${String(row.seat)}" data-connected="${row.connected ? 'true' : 'false'}"${
          row.you ? ' data-you=""' : ''
        }>${escapeHtml(seatLabel(row))}</li>`,
    )
    .join('');

/** The keyed slot's key: the rows in full, so the list is rebuilt only when a seat changes. */
export const seatListKey = (rows: ReadonlyArray<SeatRow>): string => JSON.stringify(rows);

/** The optional seat lists an N-seat page may carry, one per waiting screen (an id is one element, so the guest's screen has its own); neither is in `SHELL_IDS`. */
export const SEAT_LIST_IDS: ReadonlyArray<string> = ['seatList', 'guestSeatList'];

/**
 * The guest wait screen's name card (backgammon's and briscola's `guestSeatName` block,
 * web/games/<g>/page.ts): the card, its box, its Change and the note under them. None is in
 * SHELL_IDS (gin's page carries none, for its DOM parity oracle): each is looked up with `byId`
 * here and in home.ts `bindHomeShell`, and listed in the game's `pageShape.ids` (tools/games.ts).
 */
export const GUEST_NAME_IDS = {
  card: 'guestSeatName',
  input: 'guestNameInput',
  rename: 'guestRenameBtn',
  note: 'guestNameNote',
} as const;

/** `#guestNameNote`: who reads the name in the box (the owner, 2026-09-28: the client defines its own name, and the host sees it). */
export const hostSeesMsg = (hostName: string): string => `${hostName} will see this name.`;

/** The data attribute the box keeps the last seated name it was filled with under (`paintGuestName`). */
const SEATED_MARK = 'seated';

/**
 * The name card, where the page carries it (`GUEST_NAME_IDS.card`; the owner, 2026-09-28: the
 * client defines its own name): shown once the host has named my seat (`seatedName`), hidden
 * before and in every other role; the note names the host (`oppName`); the box holds the seated
 * name, so a rename (` 2`) or the fallback ('Guest') is seen before the table, and Change (or
 * Enter; home.ts) re-sends the join under what the box says (shell.ts `name/rename`). The box is
 * the player's while it is typed in: it is refilled only when the seated name changes and the box
 * still holds the previous seated name (nothing typed since) or the word the player sent (`myName`
 * as the wire normalises it, `NAME_MAX` then trimmed: the host's answer to a Change, ` 2` and all,
 * replaces what was typed), so a paint between keystrokes never fights the typing and the
 * `fillName` effect deps stay the home inputs' alone. The last seated name rides on the box as
 * `data-seated`, since the paint reads no App of its own.
 */
const paintGuestName = (doc: DocumentLike, w: WaitingView): void => {
  const card = byId(doc, GUEST_NAME_IDS.card);
  if (card === null) return;
  const seated = w.seatedName ?? null;
  toggleClass(card, 'hidden', seated === null);
  const note = byId(doc, GUEST_NAME_IDS.note);
  const host = w.oppName ?? null;
  if (note !== null) setText(note, host === null ? '' : hostSeesMsg(host));
  const input = byId(doc, GUEST_NAME_IDS.input);
  if (input === null) return;
  const next = seated ?? '';
  const prev = dataOf(input, SEATED_MARK) ?? '';
  if (next === prev) return;
  const value = readValue(input);
  const sent = w.myName ?? null;
  const untouched = value === prev || (sent !== null && value.slice(0, NAME_MAX).trim() === sent);
  if (untouched) setValue(input, next);
  setAttr(input, `data-${SEATED_MARK}`, next === '' ? null : next);
};

/**
 * `#roomCode`, `#hostWaitStatus` (+ its pulse), `#startGameBtn`, `#guestWaitStatus` (+ its pulse);
 * the name card (`paintGuestName`: `#guestSeatName` with its box and note, hidden while the host
 * has not answered) when the page carries it (backgammon's and briscola's `guestSeatName` block;
 * gin's page leaves it out for its DOM parity oracle); and the seat lists (`SEAT_LIST_IDS`), each
 * rebuilt through the keyed slot from the shell's seats when the page carries it (an N-seat game's;
 * gin's and backgammon's pages carry neither).
 */
export const paintWaiting = (doc: DocumentLike, w: WaitingView): void => {
  setText(requireId(doc, 'roomCode'), w.code ?? '----');
  const hostStatus = requireId(doc, 'hostWaitStatus');
  setText(hostStatus, w.hostStatus.text);
  toggleClass(hostStatus, 'pulse', w.hostStatus.pulse);
  toggleClass(requireId(doc, 'startGameBtn'), 'hidden', !w.startGameVisible);
  const guestStatus = requireId(doc, 'guestWaitStatus');
  setText(guestStatus, w.guestStatus.text);
  toggleClass(guestStatus, 'pulse', w.guestStatus.pulse);
  paintGuestName(doc, w);
  const lists = SEAT_LIST_IDS.flatMap((id) => {
    const list = byId(doc, id);
    return list === null ? [] : [list];
  });
  if (lists.length === 0) return;
  const rows = seatRows(w);
  lists.forEach((list) => {
    ensureKeyed(list, seatListKey(rows), () => seatListHtml(rows));
  });
};

/**
 * The classes a game marks its toast with beside `show`, each on or off for this message
 * (backgammon's `hit` for the Kapará toast, web/shared/styles/CONTRACT.md's backgammon row); a
 * mark that is off is removed, so the next message never inherits it.
 */
export type ToastMarks = Readonly<Record<string, boolean>>;

/**
 * `toast(msg)`'s DOM half: the text, the marks, the kind and the `show` class; toast.ts keeps the
 * hide timer. An `error` wears `error` (shell.css: the red fill) and is an alert, read out at once
 * by a screen reader; the plain toast is a status, and the one after an error is a status again.
 */
export const showToast = (
  doc: DocumentLike,
  message: string,
  marks: ToastMarks = {},
  kind?: ToastKind,
): void => {
  const el = requireId(doc, 'toast');
  setText(el, message);
  Object.entries(marks).forEach((mark: readonly [string, boolean]) => {
    toggleClass(el, mark[0], mark[1]);
  });
  toggleClass(el, 'error', kind === 'error');
  setAttr(el, 'role', kind === 'error' ? 'alert' : 'status');
  toggleClass(el, 'show', true);
};

export const hideToast = (doc: DocumentLike): void => {
  toggleClass(requireId(doc, 'toast'), 'show', false);
};

/** `fx.renderToggle()`: `#soundBtn`'s glyph, tooltip and pressed state (it is a toggle; every game's wrapper added `aria-pressed` until docs/design/shell-hoist.md row N). */
export const paintSound = (doc: DocumentLike, enabled: boolean): void => {
  const btn = requireId(doc, 'soundBtn');
  setText(btn, enabled ? '🔊' : '🔇');
  setAttr(btn, 'title', enabled ? 'Sound & vibration on' : 'Sound & vibration off');
  setAttr(btn, 'aria-pressed', enabled ? 'true' : 'false');
};

/**
 * The static copy a shell game renders once at boot (`bootShell.hooks.render`): `rules`, the
 * game's `rulesListHtml` items, into both rules slots (`RULES_SLOT_IDS`: the Rules tab's and the
 * in-game sheet's, so the two copies cannot drift), and `about`, the game's `aboutHtml`, into
 * `#aboutCopy`. A page that shows the table alone (gin's stories) passes the rules only. Backgammon
 * keys both slots on its ruleset instead (ui/render.ts `renderRules`).
 */
export const renderCopy = (
  doc: DocumentLike,
  copy: Readonly<{ rules: string; about?: string }>,
): void => {
  const rules = trustedHtml(copy.rules);
  RULES_SLOT_IDS.forEach((id) => {
    setHtml(requireId(doc, id), rules);
  });
  if (copy.about !== undefined) setHtml(requireId(doc, 'aboutCopy'), trustedHtml(copy.about));
};

/**
 * `#handoffBtn` (the 🌐 on the table): a pass-and-play game can go on as a hosted room, the other
 * seat joining from its own device; `label` is the tooltip naming who hosts and who joins, null
 * when the button has no business showing (a room is online already, a scorer has no table).
 */
export const paintHandoff = (doc: DocumentLike, label: string | null): void => {
  const btn = requireId(doc, 'handoffBtn');
  toggleClass(btn, 'hidden', label === null);
  if (label !== null) setAttr(btn, 'title', label);
};

/**
 * The opponent's connection dot on the table (gin `#connDot`, backgammon `#oppDot`;
 * docs/design/dry-round-2.md E6): lit while the other seat's channel is open, hidden in
 * pass-and-play, where there is no channel. Both `paintOpponent`s spelled the class string and
 * the tooltip word for word over the two shell fields; the reader is shared too, now that
 * `ShellState` (shell.ts, C2) is the one type both games read it from.
 */
export type ConnDotView = Readonly<{ connected: boolean; hidden: boolean }>;

export const connDotView = (
  shell: Pick<ShellState<ShellTypes>, 'oppConnected' | 'role'>,
): ConnDotView => ({ connected: shell.oppConnected, hidden: shell.role === 'local' });

/** The dot's whole class attribute: `conn-dot on|off`, plus `hidden` in pass-and-play. */
export const connDotClass = (v: ConnDotView): string =>
  `conn-dot ${v.connected ? 'on' : 'off'}${v.hidden ? ' hidden' : ''}`;

export const paintConnDot = (doc: DocumentLike, id: string, v: ConnDotView): void => {
  const dot = requireId(doc, id);
  setAttr(dot, 'class', connDotClass(v));
  setAttr(dot, 'title', v.connected ? 'Connected' : 'Disconnected');
};

/**
 * What every game's `paint` spelled before its table (docs/design/shell-call-graph.md §4.4): the
 * screens, the waiting rooms, the handoff button and the opponent's connection dot, each off
 * `app.shell` alone. What differs per game is data: the screen list when the page has more than
 * the shell's five, the handoff tooltip (shell.ts `handoffLabelOf`: null hides the button, the
 * two-seat gate the shell's), the dot's id (gin and fidice `connDot`, the rest
 * `oppDot`; a page without one leaves it out), and the rooms' painter when the page's rooms carry
 * more than the shell's (fidice's computers, ui/waiting.ts). The dot is painted while a view
 * stands, as the table paints that carried it ran: before the first deal the markup's class holds.
 */
export type ShellChrome<G extends ShellTypes> = Readonly<{
  screens?: ReadonlyArray<ScreenId<G>>;
  handoff: string | null;
  connDot?: string;
  waiting?: (doc: PageLike, shell: ShellChromeView<G>) => void;
}>;

/** What the chrome reads of `app.shell`: the screen, whether a view stands, the rooms' fields and the dot's two. */
export type ShellChromeView<G extends ShellTypes> = WaitingView &
  Pick<ShellState<G>, 'screen' | 'view' | 'role' | 'oppConnected'>;

export const paintShellChrome = <G extends ShellTypes>(
  doc: PageLike,
  shell: ShellChromeView<G>,
  o: ShellChrome<G>,
): void => {
  paintScreen(doc, o.screens ?? SHELL_SCREENS, shell.screen, 'tableScreen');
  (o.waiting ?? paintWaiting)(doc, shell);
  paintHandoff(doc, o.handoff);
  if (o.connDot !== undefined && shell.view !== null)
    paintConnDot(doc, o.connDot, connDotView(shell));
};

/** A sheet's overlay follows its flag. */
export const paintSheet = (doc: DocumentLike, overlay: string, open: boolean): void => {
  toggleClass(requireId(doc, overlay), 'hidden', !open);
};

/**
 * The shell's two sheets over the table (shell-hoist.md row F): `#rulesOverlay` and
 * `#historyOverlay` follow their flags, and the finished games this device remembers
 * (recentGames.ts) are painted under the history while it is open. The game paints its own
 * sheets after it, and its own log into `#historyList` before it.
 */
export const paintShellSheets = (
  doc: DocumentLike,
  shell: Pick<ShellState<ShellTypes>, 'rulesOpen' | 'historyOpen' | 'recentGames'>,
): void => {
  paintSheet(doc, 'rulesOverlay', shell.rulesOpen);
  paintSheet(doc, 'historyOverlay', shell.historyOpen);
  if (shell.historyOpen) paintRecentGames(doc, shell.recentGames);
};

// ---- the turn gate (docs/design/backgammon-landscape.md §5D; docs/design/shared-shell.md "Playing sideways") ----

/** The gate's ids (web/shared/markup/shell.ts `gateMarkup`): the sheet and its two live controls, bound by the boot (web/shared/edge/boot.ts), never by a game's render.ts. Not in SHELL_IDS: a page carries them only when its game plays sideways. */
export const GATE_ID = 'turnGate';
export const GATE_KEEP_ID = 'turnGateKeepBtn';
/** "Go sideways": the Android lock from the gate's own tap (`gate/turn`); shown only where the device can lock (`canLock` below), so an iPhone's gate keeps its one control. */
export const GATE_GO_ID = 'turnGateGoBtn';
// Every overlay the gate covers is `OVERLAYS` (above) wherever it sits (one nested deeper would only be set inert under an inert parent, harmless), the gate itself filtered out below.
/** The gate's two texts (`#turnGateTitle`, `#turnGateSub`), written by `paintGate` where a page's words follow its orientation live. */
const GATE_TITLE_ID = 'turnGateTitle';
const GATE_SUB_ID = 'turnGateSub';

/** The gate's words: the title, the line under it, the lock's button and the dismissal (web/shared/markup/shell.ts `GateCopy`, the same four). */
export type GateWords = Readonly<{
  title: string;
  sub: string;
  goLabel: string;
  keepLabel: string;
}>;

/**
 * The gate's words per way a game plays (shell.ts `PlayOrientation`): sideways, backgammon's
 * title and buttons (its page carries its own line under the title, about the board); upright, the
 * mirror. A page whose markup carries its words (backgammon's `gateMarkup(...)`) passes none to
 * `paintGate`; a page whose way changes live (UI Sandbox's orientation setting) passes the row.
 */
export const GATE_COPY: Readonly<Record<'landscape' | 'portrait', GateWords>> = {
  landscape: {
    title: 'Turn your phone sideways',
    sub: 'This layout is made for landscape. Turn the phone, or keep it upright.',
    goLabel: 'Go sideways',
    keepLabel: 'Play upright',
  },
  portrait: {
    title: 'Turn your phone upright',
    sub: 'This layout is made for portrait. Turn the phone, or keep it sideways.',
    goLabel: 'Go upright',
    keepLabel: 'Play sideways',
  },
};

/**
 * `#turnGate` ("Turn your phone sideways") over the table and the curtain on a phone held upright
 * (shell.ts `gateOpen`), until the phone turns or "Play upright". Painted by the boot after the
 * game's own paint (boot.ts `repaint`), so no game's render.ts repeats it; a page without the gate
 * (gin's, briscola's) is left alone, so every lookup is `byId`. No media query paints it: the App
 * holds the orientation (`viewport/portrait`), so a test can assert it and a fine-pointer page
 * never sees it. While it is up, `inert` on `#app` and on every other `.overlay` in the body (the
 * curtain, whose Roll button would otherwise take a tap through the upright board; the result,
 * rules, history and menu sheets; the leave confirm), never the gate itself and never `#toast`,
 * which is no overlay and sits above it (z 100 over 90); found by class, not by a list or by
 * place, because each game's overlays differ and where a page nests one changes nothing here, so
 * the page fake and the browser agree (Safari 15.5+, Chrome 102+ honour `inert`; where it is
 * missing the gate is still a fixed overlay with `aria-modal`); both gone when it hides. A dialog
 * takes focus:
 * on the paint that shows it, its first control ("Go sideways" where the device can lock, else
 * "Play upright": the button just tapped sits inside inert `#app` and would keep focus otherwise,
 * a screen reader silent, a keyboard stranded), and on the paint that hides it both buttons let go
 * (a blur on an unfocused element does nothing, so this is "if focus is inside the gate"). Every
 * other paint leaves focus alone. `canLock` (shell.ts `Ctx.canLock`, the boot's device fact) shows
 * `#turnGateGoBtn`, the Android lock's tap (docs/design/backgammon-landscape.md §5C): a web page
 * cannot lock an iPhone, so its gate keeps the one control and the copy's own advice. `words`
 * (`GATE_COPY[orientation]`) writes the four texts on every paint for a page whose way changes
 * live (UI Sandbox); left out, the markup's words stand (backgammon's page carries its own).
 */
export const paintGate = (
  doc: PageLike,
  open: boolean,
  canLock = false,
  words?: GateWords,
): void => {
  const gate = byId(doc, GATE_ID);
  if (gate === null) return;
  if (words !== undefined) {
    (
      [
        [GATE_TITLE_ID, words.title],
        [GATE_SUB_ID, words.sub],
        [GATE_GO_ID, words.goLabel],
        [GATE_KEEP_ID, words.keepLabel],
      ] as const
    ).forEach(([id, text]) => {
      const el = byId(doc, id);
      if (el !== null) setText(el, text);
    });
  }
  const wasOpen = !hasClass(gate, 'hidden');
  toggleClass(gate, 'hidden', !open);
  const app = byId(doc, 'app');
  [
    ...(app === null ? [] : [app]),
    ...queryAllIn(doc.body, OVERLAYS).filter((el) => el.id !== GATE_ID),
  ].forEach((el) => {
    setAttr(el, 'inert', open ? '' : null);
  });
  const go = byId(doc, GATE_GO_ID);
  if (go !== null) toggleClass(go, 'hidden', !canLock);
  const keep = byId(doc, GATE_KEEP_ID);
  const first = canLock && go !== null ? go : keep;
  if (open && !wasOpen && first !== null) focusElement(first);
  if (!open && wasOpen)
    [go, keep]
      .filter((el) => el !== null)
      .forEach((el) => {
        blurElement(el);
      });
};

// ---- the far seat's flip (shell.ts `flipped`; docs/design/backgammon-landscape.md §6 item 7) ----

/**
 * `data-flip="1"` on the body while the table is turned for the seat across it (shell.css
 * `body[data-flip="1"] { rotate: 180deg }`), removed otherwise: painted by the boot after the
 * game's own paint, from `flipped` alone, so no game's render.ts repeats it. An attribute, not a
 * class, so the class contract has no row for it (web/shared/styles/CONTRACT.md notes it beside
 * `inert`).
 */
export const paintFlip = (doc: PageLike, flipped: boolean): void => {
  setAttr(doc.body, 'data-flip', flipped ? '1' : null);
};

/**
 * A sheet is an overlay a flag shows; the same flag's intent answers its close button and a tap
 * on its backdrop (the overlay element itself, never its children). Each game lists its own.
 */
export type Sheet<I> = Readonly<{ overlay: string; close: string; intent: I }>;

/**
 * Wire every sheet's close button and backdrop. With `escapeFallback`, Escape closes the open
 * sheet and, when none is open, dispatches the fallback (backgammon: the die-chip tray,
 * docs/design/backgammon-board.md §6); without it no key is listened to (fidice).
 */
export const bindSheets = <I>(
  doc: PageLike,
  sheets: ReadonlyArray<Sheet<I>>,
  dispatch: Dispatch<I>,
  opts?: Readonly<{ escapeFallback: I }>,
): void => {
  sheets.forEach(({ overlay, close, intent }) => {
    listenId(doc, close, 'click', () => {
      dispatch(intent);
    });
    listenId(doc, overlay, 'click', (e) => {
      if (targetIdOf(e) === overlay) dispatch(intent);
    });
  });
  if (opts === undefined) return;
  listen(doc, 'keydown', (e) => {
    if (keyOf(e) !== 'Escape') return;
    const open = sheets.find((s) => !hasClass(requireId(doc, s.overlay), 'hidden'));
    dispatch(open === undefined ? opts.escapeFallback : open.intent);
  });
};

/**
 * A table of controls that each dispatch one constant intent on click, bound in one call
 * (docs/design/dry-round-2.md D2, item E4): the eleven `listenId(doc, id, 'click', () =>
 * dispatch({ ... }))` blocks gin's `bindTable` spelled and the sixteen `button(...)` lines
 * backgammon's did, which differed only in the id and the literal. A missing id throws at bind
 * time, as `listenId` does. `skipDisabled` is backgammon's `button()`: a click on a control that
 * carries `disabled` dispatches nothing (gin's constant controls never carry it and leave it off;
 * its `#actions` row is delegated and checks the attribute itself).
 */
export type ButtonIntents<I> = ReadonlyArray<readonly [id: string, intent: I]>;

export const bindButtons = <I>(
  doc: DocumentLike,
  dispatch: Dispatch<I>,
  entries: ButtonIntents<I>,
  opts?: Readonly<{ skipDisabled: boolean }>,
): void => {
  entries.forEach(([id, intent]) => {
    const el = requireId(doc, id);
    listen(el, 'click', () => {
      if (opts?.skipDisabled === true && isDisabled(el)) return;
      dispatch(intent);
    });
  });
};

/**
 * The five rows every table's `bindButtons` carried (docs/design/shell-call-graph.md §4.4): leave,
 * sound and the handoff dispatch the shell's own intents; the rules and history buttons dispatch
 * the game's sheet intents until those are the shell's too (shell-hoist.md row F), so the game
 * names them (backgammon toggles, gin's history says `who`). Spread first into the game's rows.
 */
export const shellButtons = <G extends ShellTypes>(): ButtonIntents<Intent<G>> => [
  ['leaveBtn', { type: 'leave/request' }],
  ['soundBtn', { type: 'sound/toggle' }],
  ['handoffBtn', { type: 'handoff/click' }],
  ['rulesBtnGame', { type: 'rules/open' }],
  ['historyBtn', { type: 'history/open' }],
];

/**
 * What a long press dispatches: `press` at pointerdown, one intent or a function of the event
 * that names the intent, or null for a pointer that landed on nothing pressable (gin's hand: a
 * card's id, or the felt between the cards); `release` when the pointer lifts, leaves or is
 * cancelled. The timer that turns a press into a long press is the reducer's, not this binder's.
 */
export type LongPressIntents<I> = Readonly<{
  press: I | ((e: Readonly<Event>) => I | null);
  release: I;
}>;

const isPressOf = <I>(
  press: LongPressIntents<I>['press'],
): press is (e: Readonly<Event>) => I | null => typeof press === 'function';

/**
 * home.ts's `bindLongPress` (the Play tab's submenu) with `press` widened to a function for gin's
 * card press (docs/design/dry-round-2.md D2, item E5); the home shell adopts this one when C2 has
 * landed (Wave G: its `press` is the constant form, so the call reads the same).
 */
export const bindLongPress = <I>(
  el: Element,
  dispatch: Dispatch<I>,
  intents: LongPressIntents<I>,
): void => {
  listen(el, 'pointerdown', (e) => {
    const intent = isPressOf(intents.press) ? intents.press(e) : intents.press;
    if (intent !== null) dispatch(intent);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => {
    listen(el, ev, () => {
      dispatch(intents.release);
    });
  });
};
