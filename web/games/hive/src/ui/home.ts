// The home screen's game half (docs/design/hive.md §7): the shared shell's tabs, modes, inputs and
// resume box (web/shared/ui/home.ts) and nothing of this page's own: a game for two has no option.
import type { DocumentLike, PageLike } from '../../../../shared/edge/dom.ts';
import {
  bindHomeShell,
  homeView,
  paintHomeShell,
  shellIntents,
} from '../../../../shared/ui/home.ts';
import { resumeLabel } from '../../../../shared/lib/name.ts';
import {
  HOME_TABS,
  namesOf,
  type App,
  type Hive,
  type Intent,
  type PlayMode,
  type Raw,
} from './state.ts';

export { fillNameInputs, fillP2NameInput, setCodeInput } from '../../../../shared/ui/home.ts';

const PLAY_MODES: ReadonlyArray<PlayMode> = ['online', 'local'];

const noOptions = (): Raw => ({});

/** The tabs and panels, the play mode, the submenu and the resume box. */
export const paintHome = (doc: DocumentLike, app: App): void => {
  paintHomeShell(
    doc,
    homeView(app.shell, (resume) => resumeLabel(resume, namesOf)),
    { tabs: HOME_TABS, modes: PLAY_MODES },
  );
};

/** Every control of the home screen and the two waiting screens. */
export const bindHome = (doc: PageLike, dispatch: (intent: Intent) => void): void => {
  bindHomeShell(doc, dispatch, {
    tabs: HOME_TABS,
    startOptions: { host: noOptions, local: noOptions },
    intents: shellIntents<Hive>(),
  });
};
