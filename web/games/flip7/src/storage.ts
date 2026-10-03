// Flip 7's browser storage (docs/design/flip7.md §8): the shell's keys under the `flip7_` prefix
// (web/shared/edge/prefs.ts `seatedStore`; tools/games.ts REGISTRY pins the save key and the
// prefix), the seat count the two Players steppers share under `flip7_players`, and the third to
// twelfth pass-and-play names under `flip7_p3Name` on: every key a seated game keeps, derived once.
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
import { SEAT_COUNTS, decodeState, type SeatCount } from './engine/index.ts';

export type { PlayMode, Store, StorageError };

// The tabs and the stored mode's default are the shell's (prefs.ts); re-exported for ui/state.ts, which may not import prefs.ts's edge.
export { DEFAULT_HOME_TAB, DEFAULT_PLAY_MODE, HOME_TABS, type HomeTab };

/** The room's one term. */
export type Opts = SeatCountOpts<SeatCount>;

export const SHELL_STORE = seatedStore('flip7_', 'flip7MP_v1', {
  game: 'flip7',
  decodeGame: decodeState,
  counts: SEAT_COUNTS,
});
/** The shell's keys (prefs.ts `SeatedKeysOf`): the save, the eight preferences every shell keeps, the seat count and the ten extra names. */
export const STORAGE_KEYS = SHELL_STORE.keys;
