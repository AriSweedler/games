// The home screen's DOM (docs/design/briscola.md §5.2 "Home residue", §5.8 `home`; docs/ARCHITECTURE.md
// "Module boundaries": ui/ reaches the document only through the shared DOM edge). The seated
// games' home is web/shared/ui/seatedHome.ts (the shell's tabs, mode switch, inputs, resume box and
// buttons; the seat count stepper in each mode panel, two to four; the third and fourth name
// inputs, shown by the count; the match and the house rules have no controls since 2026-09-25, the
// room's other terms being fixed). This file composes it with what is briscola's alone: the
// "Battle animations" select of each panel (docs/design/briscola-battle.md §3.7), one stored
// preference painted into both and dispatched as `speed/set` from either.
import {
  listenId,
  readValue,
  requireId,
  setValue,
  type DocumentLike,
  type PageLike,
} from '../../../../shared/edge/dom.ts';
import { seatedHome } from '../../../../shared/ui/seatedHome.ts';
import { LOCAL_NAMES } from '../shellConfig.ts';
import { HOME_TABS, namesOf, type App, type Briscola, type Intent } from './state.ts';

/** The seated home: two to four on both steppers (design §5.8), the third and fourth names under `#moreNames`. */
const home = seatedHome<Briscola>({
  seats: { min: 2, max: 4 },
  localNames: LOCAL_NAMES,
  allNames: namesOf,
  tabs: HOME_TABS,
  group: 'moreNames',
});

export const { readHostOptions, readLocalOptions } = home;

/** The "Battle animations" select of each panel: `normal` | `quick` | `off`, one stored preference (`briscola_speed`). */
export const SPEED_SELECTS: ReadonlyArray<string> = ['speedSel', 'localSpeedSel'];

/** The seated home, then the battle beat's speed into both panels' selects. */
export const paintHome = (doc: DocumentLike, app: App): void => {
  home.paintHome(doc, app);
  SPEED_SELECTS.forEach((id) => {
    setValue(requireId(doc, id), app.table.speed);
  });
};

/** Every control of the home screen and the two waiting screens; a change on either speed select is `speed/set`. */
export const bindHome = (doc: PageLike, dispatch: (intent: Intent) => void): void => {
  home.bindHome(doc, dispatch);
  SPEED_SELECTS.forEach((id) => {
    listenId(doc, id, 'change', () => {
      dispatch({ type: 'speed/set', speed: readValue(requireId(doc, id)) });
    });
  });
};
