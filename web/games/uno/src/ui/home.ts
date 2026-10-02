// The home screen's game half (docs/design/uno.md §9): the shared shell's tabs, modes, inputs and
// resume box (web/shared/ui/home.ts), and this page's own fields: the player-count stepper in each
// panel (web/shared/ui/stepper.ts; the owner, 2026-10-02: "a number with - and + buttons on the
// side") and the pass-and-play names past the second, one input per seat the stepper allows
// (web/shared/ui/seatNames.ts: "more than 4 players should paint properly").
import {
  readValue,
  requireId,
  type DocumentLike,
  type PageLike,
} from '../../../../shared/edge/dom.ts';
import {
  bindHomeShell,
  fillInputs,
  paintHomeShell,
  type HomeView,
  type ShellIntentBuilders,
} from '../../../../shared/ui/home.ts';
import {
  bindSeatNames,
  paintSeatNames,
  readSeatNames,
  type SeatNamesSpec,
} from '../../../../shared/ui/seatNames.ts';
import { bindStepper, paintStepper, type StepperSpec } from '../../../../shared/ui/stepper.ts';
import { LOCAL_NAMES, MAX_SEATS, MIN_SEATS } from '../shellConfig.ts';
import {
  HOME_TABS,
  resumeLabel,
  type App,
  type HomeTab,
  type Intent,
  type PlayMode,
  type Raw,
} from './state.ts';

export { setCodeInput } from '../../../../shared/ui/home.ts';

/** The first player's name into the online name and pass-and-play's first seat. */
export const fillNameInputs = (doc: DocumentLike, name: string, isDefault = false): void => {
  fillInputs(doc, ['nameInput', 'p1NameInput'], name, isDefault);
};

/** The second player's name into pass-and-play's second seat. */
export const fillP2NameInput = (doc: DocumentLike, name: string, isDefault = false): void => {
  fillInputs(doc, ['p2NameInput'], name, isDefault);
};

const PLAY_MODES: ReadonlyArray<PlayMode> = ['online', 'local'];
/** The two steppers' hidden fields (page.ts), two to twelve players each. */
export const ONLINE_PLAYERS = 'playersCount';
export const LOCAL_PLAYERS = 'localPlayersCount';
const ONLINE_STEPPER: StepperSpec = { id: ONLINE_PLAYERS, min: MIN_SEATS, max: MAX_SEATS };
const LOCAL_STEPPER: StepperSpec = { id: LOCAL_PLAYERS, min: MIN_SEATS, max: MAX_SEATS };
/** The pass-and-play name inputs (page.ts `seatNamesHtml`): twelve, this game's defaults past the shell's two. */
const SEAT_NAMES: SeatNamesSpec = { max: MAX_SEATS, names: LOCAL_NAMES };

export const readHostOptions = (doc: DocumentLike): Raw => ({
  players: readValue(requireId(doc, ONLINE_PLAYERS)),
});

const readLocalSeats = (doc: DocumentLike): Raw => ({
  localPlayers: readValue(requireId(doc, LOCAL_PLAYERS)),
});

export const readLocalOptions = (doc: DocumentLike): Raw => ({
  ...readLocalSeats(doc),
  names: readSeatNames(doc, SEAT_NAMES),
});

const homeView = (app: App): HomeView<HomeTab> => ({
  homeTab: app.shell.homeTab,
  playMode: app.shell.playMode,
  submenuOpen: app.shell.submenuOpen,
  resumeLabel: app.shell.resume === null ? null : resumeLabel(app.shell.resume),
});

/** The tabs and panels, the play mode, the submenu and the resume box; then both seat counts and one name input per seat. */
export const paintHome = (doc: DocumentLike, app: App): void => {
  paintHomeShell(doc, homeView(app), { tabs: HOME_TABS, modes: PLAY_MODES });
  const n = app.shell.opts.seatCount;
  paintStepper(doc, ONLINE_STEPPER, n);
  paintStepper(doc, LOCAL_STEPPER, n);
  paintSeatNames(doc, SEAT_NAMES, n, app.table.extraNames);
};

const SHELL_INTENTS: ShellIntentBuilders<Intent, HomeTab, Raw> = {
  nameTyped: (value) => ({ type: 'name/typed', value }),
  p1NameTyped: (value) => ({ type: 'p1name/typed', value }),
  p2NameTyped: (value) => ({ type: 'p2name/typed', value }),
  hostClick: (name, options) => ({ type: 'host/click', name, ...options }),
  joinClick: (name, code) => ({ type: 'join/click', name, code }),
  codeTyped: (value, inputType) => ({ type: 'code/typed', value, inputType }),
  hostDeal: { type: 'host/deal' },
  localClick: (p1, p2, options) => ({ type: 'local/click', p1, p2, ...options }),
  tabSet: (tab) => ({ type: 'tab/set', tab }),
  modeSet: (mode) => ({ type: 'mode/set', mode }),
  submenuPress: { type: 'submenu/press' },
  submenuRelease: { type: 'submenu/release' },
  tabPlayClick: { type: 'tab/playClick' },
  submenuPick: (mode) => ({ type: 'submenu/pick', mode }),
  submenuDismiss: { type: 'submenu/dismiss' },
  resumeClick: { type: 'resume/click' },
  shareClick: { type: 'share/click' },
  cancel: { type: 'cancel' },
  renameClick: (name) => ({ type: 'name/rename', name }),
};

/** Every control of the home screen and the two waiting screens; each count is remembered as it steps, each extra name as it is typed. */
export const bindHome = (doc: PageLike, dispatch: (intent: Intent) => void): void => {
  bindHomeShell(doc, dispatch, {
    tabs: HOME_TABS,
    startOptions: { host: readHostOptions, local: readLocalOptions },
    intents: SHELL_INTENTS,
  });
  bindStepper(doc, ONLINE_STEPPER, (n) => {
    dispatch({ type: 'opts/set', raw: { players: String(n) } });
  });
  bindStepper(doc, LOCAL_STEPPER, (n) => {
    dispatch({ type: 'opts/set', raw: { localPlayers: String(n) } });
  });
  bindSeatNames(doc, SEAT_NAMES, (seat, value) => {
    dispatch({ type: 'pname/typed', seat, value });
  });
};
