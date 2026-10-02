// The home screen's Flip 7 half (web/shared/ui/home.ts does the shell's): the two Players steppers
// (Online and its pass-and-play twin, − count +, two to twelve), the third to twelfth pass-and-play
// names shown with the count, and the input writes the boot hands the shell (the names, the code).
import {
  dataOf,
  listen,
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
  fillInputs,
  paintHomeShell,
  shellIntents,
} from '../../../../shared/ui/home.ts';
import { localNameFor } from '../../../../shared/ui/shell.ts';
import { bindStepper, paintStepper, type StepperSpec } from '../../../../shared/ui/stepper.ts';
import { MAX_SEATS, MIN_SEATS } from '../engine/index.ts';
import { LOCAL_NAMES } from '../shellConfig.ts';
import {
  EXTRA_SEATS,
  HOME_TABS,
  type ExtraSeat,
  resumeLabel,
  type App,
  type Flip7,
  type Intent,
  type PlayMode,
  type Raw,
} from './state.ts';

export { setCodeInput } from '../../../../shared/ui/home.ts';

export const fillNameInputs = (doc: DocumentLike, name: string, isDefault = false): void => {
  fillInputs(doc, ['nameInput', 'p1NameInput'], name, isDefault);
};

export const fillP2NameInput = (doc: DocumentLike, name: string, isDefault = false): void => {
  fillInputs(doc, ['p2NameInput'], name, isDefault);
};

const PLAY_MODES: ReadonlyArray<PlayMode> = ['online', 'local'];
/** The two steppers' hidden fields (page.ts), two to twelve players each. */
export const PLAYERS_SEL = 'playersCount';
export const LOCAL_PLAYERS_SEL = 'localPlayersCount';
const ONLINE_STEPPER: StepperSpec = { id: PLAYERS_SEL, min: MIN_SEATS, max: MAX_SEATS };
const LOCAL_STEPPER: StepperSpec = { id: LOCAL_PLAYERS_SEL, min: MIN_SEATS, max: MAX_SEATS };

/** The input of a seat past the second: `p3NameInput` … `p6NameInput`. */
export const nameInputId = (seat: ExtraSeat): string => `p${String(seat + 1)}NameInput`;

const readExtraNames = (doc: DocumentLike): ReadonlyArray<string> =>
  EXTRA_SEATS.map((seat) => readValue(requireId(doc, nameInputId(seat))));

export const readHostOptions = (doc: DocumentLike): Raw => ({
  players: readValue(requireId(doc, PLAYERS_SEL)),
});

export const readLocalOptions = (doc: DocumentLike): Raw => ({
  localPlayers: readValue(requireId(doc, LOCAL_PLAYERS_SEL)),
  names: readExtraNames(doc),
});

const paintOptions = (doc: DocumentLike, app: App): void => {
  const n = app.shell.opts.seatCount;
  paintStepper(doc, ONLINE_STEPPER, n);
  paintStepper(doc, LOCAL_STEPPER, n);
  toggleClass(requireId(doc, 'moreNames'), 'hidden', n < 3);
  EXTRA_SEATS.forEach((seat) => {
    const input = requireId(doc, nameInputId(seat));
    const name = app.table.extraNames[seat];
    toggleClass(input, 'hidden', seat >= n);
    setValue(input, name ?? localNameFor(LOCAL_NAMES, seat));
    setAttr(input, DEFAULT_MARK, name === null ? '1' : null);
  });
};

export const paintHome = (doc: DocumentLike, app: App): void => {
  paintHomeShell(
    doc,
    {
      homeTab: app.shell.homeTab,
      playMode: app.shell.playMode,
      submenuOpen: app.shell.submenuOpen,
      resumeLabel: app.shell.resume === null ? null : resumeLabel(app.shell.resume),
    },
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
  EXTRA_SEATS.forEach((seat) => {
    const input = requireId(doc, nameInputId(seat));
    listen(input, 'input', () => {
      dispatch({ type: 'pname/typed', seat, value: readValue(input) });
    });
    // A prefilled default clears on its first tap, as the shared binder clears the first two seats.
    ['focus', 'pointerdown'].forEach((type) => {
      listen(input, type, () => {
        if (dataOf(input, 'default') === null) return;
        clearDefault(input);
        dispatch({ type: 'pname/typed', seat, value: '' });
      });
    });
  });
};

export const bindHome = (doc: PageLike, dispatch: (intent: Intent) => void): void => {
  bindHomeShell(doc, dispatch, {
    tabs: HOME_TABS,
    startOptions: { host: readHostOptions, local: readLocalOptions },
    intents: shellIntents<Flip7>(),
  });
  bindOptions(doc, dispatch);
};
