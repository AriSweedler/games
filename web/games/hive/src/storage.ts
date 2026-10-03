// Hive's storage (docs/design/hive.md §7): the shared shell's keys under this game's prefix
// (web/shared/edge/prefs.ts `shellStore`: the save of the game in progress, the names, the tab,
// the mode, sound, the font, the finished games, the far seat's flip) and one option of its own,
// the tiles' motion (crawl or snap), a row of the shell's settings table (web/shared/edge/settings.ts
// `HIVE_MOTION`, under `hive_motion`) read and written through it. tools/games.ts REGISTRY pins
// the save key and the prefix.
import type { Store, StorageError } from '../../../shared/edge/storage.ts';
import {
  shellStore,
  type GuestSave as ShellGuestSave,
  type HostSave as ShellHostSave,
  type LocalSave as ShellLocalSave,
  type PlayMode,
  type Save as ShellSave,
} from '../../../shared/edge/prefs.ts';
import {
  HIVE_MOTION,
  nextSetting,
  readSetting,
  writeSetting,
} from '../../../shared/edge/settings.ts';
import { literal, object } from '../../../shared/lib/json.ts';
import { decodeState, type State } from './engine/view.ts';

export type { PlayMode, Store, StorageError };

export const STORAGE_KEYS = {
  /** The game in progress: pass-and-play, or the host's table and game, or the guest's table. */
  save: 'hiveMP_v1',
  name: 'hive_name',
  p2Name: 'hive_p2Name',
  homeTab: 'hive_homeTab',
  playMode: 'hive_playMode',
  sound: 'hive_sound',
  soundFont: 'hive_soundFont',
  recentGames: 'hive_recentGames',
  flipTable: 'hive_flipTable',
} as const;

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

export const HOME_TABS = ['play', 'rules', 'about'] as const;
export type HomeTab = (typeof HOME_TABS)[number];
export const DEFAULT_HOME_TAB: HomeTab = 'play';
export const DEFAULT_PLAY_MODE: PlayMode = 'online';

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
export const { enabled: soundEnabled, write: writeSoundState } = SHELL_STORE.sound;
