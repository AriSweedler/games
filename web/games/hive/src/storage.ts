// Hive's storage (docs/design/hive.md §7): the shared shell's keys under this game's prefix
// (web/shared/edge/prefs.ts `shellStore`: the save of the game in progress, the names, the tab,
// the mode, sound, the font, the finished games, the far seat's flip) and two options of its own,
// the tiles' motion (crawl or snap) and the hints (show or hide), rows of the shell's settings
// table (web/shared/edge/settings.ts `HIVE_MOTION` under `hive_motion`, `HIVE_HINTS` under
// `hive_hints`) read and written through it. tools/games.ts REGISTRY pins
// the save key and the prefix.
import type { Store, StorageError } from '../../../shared/edge/storage.ts';
import {
  shellKeys,
  shellStore,
  type GuestSave as ShellGuestSave,
  type HostSave as ShellHostSave,
  type LocalSave as ShellLocalSave,
  DEFAULT_HOME_TAB,
  DEFAULT_PLAY_MODE,
  HOME_TABS,
  type HomeTab,
  type PlayMode,
  type Save as ShellSave,
} from '../../../shared/edge/prefs.ts';
import {
  HIVE_HINTS,
  HIVE_MOTION,
  nextSetting,
  readSetting,
  writeSetting,
} from '../../../shared/edge/settings.ts';
import { literal, object } from '../../../shared/lib/json.ts';
import { decodeState, type State } from './engine/view.ts';

export type { PlayMode, Store, StorageError };

/** The shell's keys alone (prefs.ts `ShellKeysOf`): hive's own options are settings rows below. */
export const STORAGE_KEYS = shellKeys('hive_', 'hiveMP_v1');

/** The tiles' motion: `crawl` (one hop a hex, the default) or `snap` to where they land. */
export type Motion = (typeof HIVE_MOTION.values)[number];
export { HIVE_MOTION };
/** The stored motion, or `crawl`. */
export const readMotion = (store: Store): Motion => readSetting(store, HIVE_MOTION);
export const writeMotion = (store: Store, motion: Motion): void => {
  writeSetting(store, HIVE_MOTION, motion);
};
/** The other motion: what `#motionBtn` switches to. */
export const nextMotion = (motion: Motion): Motion => nextSetting(HIVE_MOTION, motion);

/** The hints: `show` (a picked tile's hexes light, the default) or `hide` (place anywhere, then confirm). */
export type Hints = (typeof HIVE_HINTS.values)[number];
export { HIVE_HINTS };
/** The stored hints, or `show`. */
export const readHints = (store: Store): Hints => readSetting(store, HIVE_HINTS);
export const writeHints = (store: Store, hints: Hints): void => {
  writeSetting(store, HIVE_HINTS, hints);
};
/** The other hints: what `#hintsBtn` switches to. */
export const nextHints = (hints: Hints): Hints => nextSetting(HIVE_HINTS, hints);

// The tabs and the stored mode's default are the shell's (prefs.ts); re-exported for ui/state.ts, which may not import prefs.ts's edge.
export { DEFAULT_HOME_TAB, DEFAULT_PLAY_MODE, HOME_TABS, type HomeTab };

/** The room's terms: two seats, always (the shell's option record needs one field). */
export type Opts = Readonly<{ seatCount: 2 }>;
export const DEFAULT_OPTS: Opts = { seatCount: 2 };

export type HostExtra = Opts;
export type LocalSave = ShellLocalSave<State>;
export type HostSave = ShellHostSave<State, HostExtra>;
export type GuestSave = ShellGuestSave;
export type Save = ShellSave<State, HostExtra>;

export const SHELL_STORE = shellStore<State, HostExtra, HomeTab>(STORAGE_KEYS, {
  game: 'hive',
  decodeGame: decodeState,
  hostExtra: {
    decode: object({ seatCount: literal(2) }),
    literal: () => DEFAULT_OPTS,
  },
  decodeHomeTab: literal(...HOME_TABS),
});
export const { write: writeSoundState } = SHELL_STORE.sound;
