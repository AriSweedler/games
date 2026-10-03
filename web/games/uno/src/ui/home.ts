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
  homeView,
  paintHomeShell,
  shellIntents,
} from '../../../../shared/ui/home.ts';
import {
  bindSeatNames,
  paintSeatNames,
  readSeatNames,
  type SeatNamesSpec,
} from '../../../../shared/ui/seatNames.ts';
import { bindStepper, paintStepper, type StepperSpec } from '../../../../shared/ui/stepper.ts';
import { LOCAL_NAMES, MAX_SEATS, MIN_SEATS } from '../shellConfig.ts';
import { resumeLabel } from '../../../../shared/lib/name.ts';
import {
  HOME_TABS,
  namesOf,
  type App,
  type Intent,
  type PlayMode,
  type Raw,
  type Uno,
} from './state.ts';

export { fillNameInputs, fillP2NameInput, setCodeInput } from '../../../../shared/ui/home.ts';

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

/** The tabs and panels, the play mode, the submenu and the resume box; then both seat counts and one name input per seat. */
export const paintHome = (doc: DocumentLike, app: App): void => {
  paintHomeShell(
    doc,
    homeView(app.shell, (resume) => resumeLabel(resume, namesOf)),
    { tabs: HOME_TABS, modes: PLAY_MODES },
  );
  const n = app.shell.opts.seatCount;
  paintStepper(doc, ONLINE_STEPPER, n);
  paintStepper(doc, LOCAL_STEPPER, n);
  paintSeatNames(doc, SEAT_NAMES, n, app.shell.seatNames);
};

/** Every control of the home screen and the two waiting screens; each count is remembered as it steps, each extra name as it is typed. */
export const bindHome = (doc: PageLike, dispatch: (intent: Intent) => void): void => {
  bindHomeShell(doc, dispatch, {
    tabs: HOME_TABS,
    startOptions: { host: readHostOptions, local: readLocalOptions },
    intents: shellIntents<Uno>(),
  });
  bindStepper(doc, ONLINE_STEPPER, (n) => {
    dispatch({ type: 'opts/set', raw: { players: String(n) } });
  });
  bindStepper(doc, LOCAL_STEPPER, (n) => {
    dispatch({ type: 'opts/set', raw: { localPlayers: String(n) } });
  });
  bindSeatNames(doc, SEAT_NAMES, dispatch);
};
