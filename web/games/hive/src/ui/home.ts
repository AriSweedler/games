// The home screen's game half (docs/design/hive.md §7): the shared shell's tabs, modes, inputs and
// resume box (web/shared/ui/home.ts) and nothing of this page's own: a game for two has no option.
import type { DocumentLike, PageLike } from '../../../../shared/edge/dom.ts';
import {
  bindHomeShell,
  fillInputs,
  paintHomeShell,
  type HomeView,
  type ShellIntentBuilders,
} from '../../../../shared/ui/home.ts';
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

/** The first player's name into the online name and pass-and-play's first seat (White). */
export const fillNameInputs = (doc: DocumentLike, name: string, isDefault = false): void => {
  fillInputs(doc, ['nameInput', 'p1NameInput'], name, isDefault);
};

/** The second player's name into pass-and-play's second seat (Black). */
export const fillP2NameInput = (doc: DocumentLike, name: string, isDefault = false): void => {
  fillInputs(doc, ['p2NameInput'], name, isDefault);
};

const PLAY_MODES: ReadonlyArray<PlayMode> = ['online', 'local'];

const noOptions = (): Raw => ({});

const homeView = (app: App): HomeView<HomeTab> => ({
  homeTab: app.shell.homeTab,
  playMode: app.shell.playMode,
  submenuOpen: app.shell.submenuOpen,
  resumeLabel: app.shell.resume === null ? null : resumeLabel(app.shell.resume),
});

/** The tabs and panels, the play mode, the submenu and the resume box. */
export const paintHome = (doc: DocumentLike, app: App): void => {
  paintHomeShell(doc, homeView(app), { tabs: HOME_TABS, modes: PLAY_MODES });
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

/** Every control of the home screen and the two waiting screens. */
export const bindHome = (doc: PageLike, dispatch: (intent: Intent) => void): void => {
  bindHomeShell(doc, dispatch, {
    tabs: HOME_TABS,
    startOptions: { host: noOptions, local: noOptions },
    intents: SHELL_INTENTS,
  });
};
