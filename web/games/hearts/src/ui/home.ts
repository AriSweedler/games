// The home screen's game half (docs/design/hearts.md §3): the shared seated home
// (web/shared/ui/seatedHome.ts, Flip 7's shape): the shell's tabs, modes, inputs and resume box, the
// two Players steppers (three or four) in the host card and the pass-and-play panel, and one name
// input per seat the stepper counts (`#seatNames`, the shell's grid). The defaults for the empty
// inputs are the shell's (`DEFAULT_LOCAL_NAMES`).
import { DEFAULT_LOCAL_NAMES } from '../../../../shared/ui/shell.ts';
import { seatedHome } from '../../../../shared/ui/seatedHome.ts';
import { MAX_SEATS, MIN_SEATS } from '../engine/view.ts';
import { HOME_TABS, type Hearts } from './state.ts';

/** Every seat's name off a saved game, in seat order (the resume offer's label). */
export const namesOf = (game: Hearts['State']): ReadonlyArray<string> => game.game.names;

export const { paintHome, bindHome } = seatedHome<Hearts>({
  seats: { min: MIN_SEATS, max: MAX_SEATS },
  localNames: DEFAULT_LOCAL_NAMES,
  allNames: namesOf,
  tabs: HOME_TABS,
});
