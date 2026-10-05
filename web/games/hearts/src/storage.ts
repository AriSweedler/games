// Hearts's browser storage (docs/design/hearts.md §7): the shell's keys under the `hearts_` prefix
// (web/shared/edge/prefs.ts `seatedStore`; tools/games.ts REGISTRY pins the save key and the
// prefix), the seat count the two Players steppers share under `hearts_players`, and the third
// and fourth pass-and-play names under `hearts_p3Name` on: every key a seated game keeps.
import type { Store, StorageError } from '../../../shared/edge/storage.ts';
import {
  seatedStore,
  DEFAULT_PLAY_MODE,
  HOME_TABS,
  type HomeTab,
  type PlayMode,
} from '../../../shared/edge/prefs.ts';
import type { SeatCountOpts } from '../../../shared/lib/shellDefaults.ts';
import { SEAT_COUNTS, decodeState, type SeatCount } from './engine/view.ts';

export type { PlayMode, Store, StorageError };

// The tabs and the stored mode's default are the shell's (prefs.ts); re-exported for ui/state.ts, which may not import prefs.ts's edge.
export { DEFAULT_PLAY_MODE, HOME_TABS, type HomeTab };

/** The room's one term: three or four seats. */
export type Opts = SeatCountOpts<SeatCount>;

export const SHELL_STORE = seatedStore('hearts_', 'heartsMP_v1', {
  game: 'hearts',
  decodeGame: decodeState,
  counts: SEAT_COUNTS,
});
/** The shell's keys (prefs.ts `SeatedKeysOf`): the save, the preferences every shell keeps, the seat count and the two extra names. */
export const STORAGE_KEYS = SHELL_STORE.keys;
