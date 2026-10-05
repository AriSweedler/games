// The home screen's game half (docs/design/hearts.md §3): the shared shell's tabs, modes, inputs and
// resume box (web/shared/ui/home.ts) and nothing of this page's own: a game for two has no option
// (a game with a seat range composes web/shared/ui/seatedHome.ts instead, as the three seated games
// do). The input writes the reducer raises (the names, the code) are the boot's defaults.
import type { DocumentLike, PageLike } from '../../../../shared/edge/dom.ts';
import {
  bindHomeShell,
  homeView,
  paintHomeShell,
  shellIntents,
} from '../../../../shared/ui/home.ts';
import {
  HOME_TABS,
  resumeLabel,
  type App,
  type Intent,
  type PlayMode,
  type Raw,
  type Hearts,
} from './state.ts';

const PLAY_MODES: ReadonlyArray<PlayMode> = ['online', 'local'];

const noOptions = (): Raw => ({});

/** The tabs and panels, the play mode, the submenu and the resume box. */
export const paintHome = (doc: DocumentLike, app: App): void => {
  paintHomeShell(doc, homeView(app.shell, resumeLabel), { tabs: HOME_TABS, modes: PLAY_MODES });
};

/** Every control of the home screen and the two waiting screens. */
export const bindHome = (doc: PageLike, dispatch: (intent: Intent) => void): void => {
  bindHomeShell(doc, dispatch, {
    tabs: HOME_TABS,
    startOptions: { host: noOptions, local: noOptions },
    intents: shellIntents<Hearts>(),
  });
};
