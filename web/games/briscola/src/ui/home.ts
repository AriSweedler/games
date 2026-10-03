// The home screen's DOM (docs/design/briscola.md §5.2 "Home residue", §5.8 `home`; docs/ARCHITECTURE.md
// "Module boundaries": ui/ reaches the document only through the shared DOM edge). `paintHome`
// reads the App (ui/state.ts) and `bindHome` turns each control into an intent. The shell every
// game's home screen shares (the tabs, the mode switch and its submenu, the code field, the resume
// box, the start, join, share and cancel buttons) is web/shared/ui/home.ts; this file composes it
// with what is briscola's alone: the seat count stepper in each mode panel (the shell's − n +,
// web/shared/ui/stepper.ts, two to four; the owner, 2026-10-02: "not a dropdown but a number with
// - and + buttons"; the pass-and-play panel's a twin of the Online one; the match and the house
// rules have no controls since 2026-09-25, the room's other terms being fixed) and the third and
// fourth name inputs, shown by the seat count. The start buttons carry the raw value along (`Raw`,
// the keys the reducer's `parseOpts` reads), and each tap on − or + remembers the count at once
// (`opts/set`), so the hidden field and the room agree before Start. The three input writes that are
// not a paint (the saved names at `initHome`, the
// sanitised room code as it is typed) are effects the reducer raises and main.ts runs through
// `fillNameInputs` / `fillP2NameInput` / `setCodeInput`; the third and fourth names are painted from
// the table's memory (`extraNames`), which their own keystrokes keep current, so the paint never
// overwrites what is being typed.
import {
  dataOf,
  listen,
  listenId,
  readValue,
  requireId,
  setAttr,
  setValue,
  toggleClass,
  type DocumentLike,
  type PageLike,
} from '../../../../shared/edge/dom.ts';
import {
  DEFAULT_MARK,
  bindHomeShell,
  clearDefault,
  homeView,
  paintHomeShell,
  shellIntents,
} from '../../../../shared/ui/home.ts';
import { localNameFor } from '../../../../shared/ui/shell.ts';
import { bindStepper, paintStepper, type StepperSpec } from '../../../../shared/ui/stepper.ts';
import { LOCAL_NAMES } from '../shellConfig.ts';
import {
  HOME_TABS,
  resumeLabel,
  type App,
  type Briscola,
  type ExtraSeat,
  type Intent,
  type PlayMode,
  type Raw,
} from './state.ts';

/** The shell's helpers, kept under their gin names for main.ts and the tests. */
export {
  blocksCodeInput,
  fillNameInputs,
  fillP2NameInput,
  setCodeInput,
  tabButtonId,
} from '../../../../shared/ui/home.ts';
export { inviteUrl } from '../../../../shared/lib/invite.ts';

/** The two mode panels the page carries (`${mode}ModeContent`): Online · Pass the phone. */
const PLAY_MODES: ReadonlyArray<PlayMode> = ['online', 'local'];

/** The seat count stepper's hidden field in each panel (page.ts `PLAYERS`), two to four (design §5.8). */
export const ONLINE_PLAYERS = 'playersCount';
export const LOCAL_PLAYERS = 'localPlayersCount';
const ONLINE_STEPPER: StepperSpec = { id: ONLINE_PLAYERS, min: 2, max: 4 };
const LOCAL_STEPPER: StepperSpec = { id: LOCAL_PLAYERS, min: 2, max: 4 };
/** The third and fourth pass-and-play seats' inputs (`#moreNames` shows them from three players). */
export const EXTRA_NAME_INPUTS: Readonly<Record<ExtraSeat, string>> = {
  2: 'p3NameInput',
  3: 'p4NameInput',
};

/** The Online panel's raw value, the key `host/click` carries (`Raw`). */
export const readHostOptions = (doc: DocumentLike): Raw => ({
  players: readValue(requireId(doc, ONLINE_PLAYERS)),
});

/** The pass-and-play panel's seat count under its `local*` key. */
export const readLocalSeats = (doc: DocumentLike): Raw => ({
  localPlayers: readValue(requireId(doc, LOCAL_PLAYERS)),
});

/** What `#localBtn` carries beside the first two names: the seat count and the third and fourth names (the reducer seats the first `seatCount`). */
export const readLocalOptions = (doc: DocumentLike): Raw => ({
  ...readLocalSeats(doc),
  p3: readValue(requireId(doc, EXTRA_NAME_INPUTS[2])),
  p4: readValue(requireId(doc, EXTRA_NAME_INPUTS[3])),
});

/**
 * The room's seat count into both panels' steppers (the number, the hidden field, − disabled at
 * two and + at four): one count, the Online table's and pass-and-play's alike (D3; the N-seat
 * lobby lands with docs/design/n-seat-sessions.md §7, so three and four open online too).
 */
const paintOptions = (doc: DocumentLike, app: App): void => {
  const o = app.shell.opts;
  paintStepper(doc, ONLINE_STEPPER, o.seatCount);
  paintStepper(doc, LOCAL_STEPPER, o.seatCount);
  // The third and fourth seats' inputs show with the count, holding the names as last read or
  // typed, or the seat's default marked for the first-tap clear (shellConfig.ts LOCAL_NAMES: the
  // owner's Sandro and Grant), as the shared fill marks the first two seats.
  toggleClass(requireId(doc, 'moreNames'), 'hidden', o.seatCount < 3);
  toggleClass(requireId(doc, EXTRA_NAME_INPUTS[3]), 'hidden', o.seatCount < 4);
  ([2, 3] as const).forEach((seat) => {
    const input = requireId(doc, EXTRA_NAME_INPUTS[seat]);
    const name = app.table.extraNames[seat];
    setValue(input, name ?? localNameFor(LOCAL_NAMES, seat));
    setAttr(input, DEFAULT_MARK, name === null ? '1' : null);
  });
  // The battle beat's speed (docs/design/briscola-battle.md §3.7): one preference, shown by both panels.
  SPEED_SELECTS.forEach((id) => {
    setValue(requireId(doc, id), app.table.speed);
  });
};

/** The "Battle animations" select of each panel: `normal` | `quick` | `off`, one stored preference (`briscola_speed`). */
export const SPEED_SELECTS: ReadonlyArray<string> = ['speedSel', 'localSpeedSel'];

/** The tabs and panels, the play mode, the submenu's `force-open`, and the resume box; then the seat count and the extra names. */
export const paintHome = (doc: DocumentLike, app: App): void => {
  paintHomeShell(doc, homeView(app.shell, resumeLabel), { tabs: HOME_TABS, modes: PLAY_MODES });
  paintOptions(doc, app);
};

/** Each panel's seat count is remembered as it steps; the third and fourth names are remembered as typed. */
const bindOptions = (doc: PageLike, dispatch: (intent: Intent) => void): void => {
  bindStepper(doc, ONLINE_STEPPER, (n) => {
    dispatch({ type: 'opts/set', raw: { players: String(n) } });
  });
  bindStepper(doc, LOCAL_STEPPER, (n) => {
    dispatch({ type: 'opts/set', raw: { localPlayers: String(n) } });
  });
  SPEED_SELECTS.forEach((id) => {
    listenId(doc, id, 'change', () => {
      dispatch({ type: 'speed/set', speed: readValue(requireId(doc, id)) });
    });
  });
  ([2, 3] as const).forEach((seat) => {
    const input = requireId(doc, EXTRA_NAME_INPUTS[seat]);
    listenId(doc, EXTRA_NAME_INPUTS[seat], 'input', () => {
      dispatch({ type: 'pname/typed', seat, value: readValue(input) });
    });
    // A prefilled default clears on its first tap (the owner, 2026-09-25), as the shared binder
    // clears the first two seats; these two are painted from the table's memory, so the reducer
    // is told the seat is now empty (its key is dropped) and the paint follows instead of refilling.
    ['focus', 'pointerdown'].forEach((type) => {
      listen(input, type, () => {
        if (dataOf(input, 'default') === null) return;
        clearDefault(input);
        dispatch({ type: 'pname/typed', seat, value: '' });
      });
    });
  });
};

/** Every control of the home screen and the two waiting screens. */
export const bindHome = (doc: PageLike, dispatch: (intent: Intent) => void): void => {
  bindHomeShell(doc, dispatch, {
    tabs: HOME_TABS,
    startOptions: { host: readHostOptions, local: readLocalOptions },
    intents: shellIntents<Briscola>(),
  });
  bindOptions(doc, dispatch);
};
