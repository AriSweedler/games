// UNO's storage (docs/design/uno.md §9): the shared shell's keys under this game's prefix
// (web/shared/edge/prefs.ts `seatedStore`: the save of the game in progress, the names, the tab,
// the mode, sound, the font, the finished games, the far seat's flip), the seat count the home
// screen last chose under `uno_players` and the third to twelfth pass-and-play names under
// `uno_p3Name` on: every key a seated game keeps, derived once. tools/games.ts REGISTRY pins the
// save key and the prefix.
import type { Store, StorageError } from '../../../shared/edge/storage.ts';
import {
  seatedStore,
  DEFAULT_HOME_TAB,
  DEFAULT_PLAY_MODE,
  HOME_TABS,
  type HomeTab,
  type PlayMode,
} from '../../../shared/edge/prefs.ts';
import type { SeatCountOpts } from '../../../shared/lib/shellDefaults.ts';
import { SEAT_COUNTS, decodeState, type SeatCount } from './engine/view.ts';

export type { PlayMode, Store, StorageError };

// The tabs and the stored mode's default are the shell's (prefs.ts); re-exported for ui/state.ts, which may not import prefs.ts's edge.
export { DEFAULT_HOME_TAB, DEFAULT_PLAY_MODE, HOME_TABS, type HomeTab };

/** The room's terms: how many sit down (the target is the engine's 500). */
export type Opts = SeatCountOpts<SeatCount>;

export const SHELL_STORE = seatedStore('uno_', 'unoMP_v1', {
  game: 'uno',
  decodeGame: decodeState,
  counts: SEAT_COUNTS,
});
/** The shell's keys (prefs.ts `SeatedKeysOf`): the save, the eight preferences every shell keeps, the seat count and the ten extra names. */
export const STORAGE_KEYS = SHELL_STORE.keys;
