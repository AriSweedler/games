// The home screen's Flip 7 half (web/shared/ui/home.ts does the shell's): the two Players steppers
// (Online and its pass-and-play twin, − count +, two to twelve), the third to twelfth pass-and-play
// names shown with the count (web/shared/ui/seatNames.ts, off the shell's `seatNames`), and the
// input writes the boot hands the shell (the names, the code).
import {
  readValue,
  requireId,
  toggleClass,
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
import { MAX_SEATS, MIN_SEATS } from '../engine/index.ts';
import { LOCAL_NAMES } from '../shellConfig.ts';
import { resumeLabel } from '../../../../shared/lib/name.ts';
import {
  HOME_TABS,
  namesOf,
  type App,
  type Flip7,
  type Intent,
  type PlayMode,
  type Raw,
} from './state.ts';

export { fillNameInputs, fillP2NameInput, setCodeInput } from '../../../../shared/ui/home.ts';

const PLAY_MODES: ReadonlyArray<PlayMode> = ['online', 'local'];
/** The two steppers' hidden fields (page.ts), two to twelve players each. */
export const PLAYERS_SEL = 'playersCount';
export const LOCAL_PLAYERS_SEL = 'localPlayersCount';
const ONLINE_STEPPER: StepperSpec = { id: PLAYERS_SEL, min: MIN_SEATS, max: MAX_SEATS };
const LOCAL_STEPPER: StepperSpec = { id: LOCAL_PLAYERS_SEL, min: MIN_SEATS, max: MAX_SEATS };

/** The pass-and-play name inputs (page.ts, `p3NameInput` … `p12NameInput`): twelve, this game's defaults past the shell's two. */
const SEAT_NAMES: SeatNamesSpec = { max: MAX_SEATS, names: LOCAL_NAMES };

export const readHostOptions = (doc: DocumentLike): Raw => ({
  players: readValue(requireId(doc, PLAYERS_SEL)),
});

export const readLocalOptions = (doc: DocumentLike): Raw => ({
  localPlayers: readValue(requireId(doc, LOCAL_PLAYERS_SEL)),
  names: readSeatNames(doc, SEAT_NAMES),
});

const paintOptions = (doc: DocumentLike, app: App): void => {
  const n = app.shell.opts.seatCount;
  paintStepper(doc, ONLINE_STEPPER, n);
  paintStepper(doc, LOCAL_STEPPER, n);
  toggleClass(requireId(doc, 'moreNames'), 'hidden', n < 3);
  paintSeatNames(doc, SEAT_NAMES, n, app.shell.seatNames);
};

export const paintHome = (doc: DocumentLike, app: App): void => {
  paintHomeShell(
    doc,
    homeView(app.shell, (resume) => resumeLabel(resume, namesOf)),
    { tabs: HOME_TABS, modes: PLAY_MODES },
  );
  paintOptions(doc, app);
};

const bindOptions = (doc: PageLike, dispatch: (intent: Intent) => void): void => {
  // The steppers' − and + on both cards (web/shared/ui/stepper.ts): the new count, held to two to twelve.
  bindStepper(doc, ONLINE_STEPPER, (n) => {
    dispatch({ type: 'opts/set', raw: { players: String(n) } });
  });
  bindStepper(doc, LOCAL_STEPPER, (n) => {
    dispatch({ type: 'opts/set', raw: { localPlayers: String(n) } });
  });
  // Each seat's keystrokes, and the first-tap clear of a default, as the shell's `seatName/typed`.
  bindSeatNames(doc, SEAT_NAMES, dispatch);
};

export const bindHome = (doc: PageLike, dispatch: (intent: Intent) => void): void => {
  bindHomeShell(doc, dispatch, {
    tabs: HOME_TABS,
    startOptions: { host: readHostOptions, local: readLocalOptions },
    intents: shellIntents<Flip7>(),
  });
  bindOptions(doc, dispatch);
};
