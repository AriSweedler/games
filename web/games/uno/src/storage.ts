// UNO's storage (docs/design/uno.md §9): the shared shell's keys under this game's prefix
// (web/shared/edge/prefs.ts `shellStore`: the save of the game in progress, the names, the tab,
// the mode, sound, the font, the finished games, the far seat's flip) and one key of its own, the
// seat count the home screen last chose. tools/games.ts REGISTRY pins the save key and the prefix.
import type { Store, StorageError } from '../../../shared/edge/storage.ts';
import {
  shellStore,
  textPref,
  type GuestSave as ShellGuestSave,
  type HostSave as ShellHostSave,
  type LocalSave as ShellLocalSave,
  type PlayMode,
  type Save as ShellSave,
} from '../../../shared/edge/prefs.ts';
import { literal, object, type Decoder } from '../../../shared/lib/json.ts';
import { SEAT_COUNTS, decodeState, type SeatCount, type State } from './engine/view.ts';

export type { PlayMode, Store, StorageError };

export const STORAGE_KEYS = {
  /** The game in progress: pass-and-play, or the host's table and game, or the guest's table. */
  save: 'unoMP_v1',
  name: 'uno_name',
  p2Name: 'uno_p2Name',
  homeTab: 'uno_homeTab',
  playMode: 'uno_playMode',
  sound: 'uno_sound',
  soundFont: 'uno_soundFont',
  recentGames: 'uno_recentGames',
  flipTable: 'uno_flipTable',
  /** The seat count the home screen last chose, a bare string: `2` to `12`. */
  players: 'uno_players',
} as const;

export const HOME_TABS = ['play', 'rules', 'about'] as const;
export type HomeTab = (typeof HOME_TABS)[number];
export const DEFAULT_HOME_TAB: HomeTab = 'play';
export const DEFAULT_PLAY_MODE: PlayMode = 'online';

/** The room's terms: how many sit down (the target is the engine's 500). */
export type Opts = Readonly<{ seatCount: SeatCount }>;
export const DEFAULT_OPTS: Opts = { seatCount: 2 };

export type HostExtra = Opts;
export type LocalSave = ShellLocalSave<State>;
export type HostSave = ShellHostSave<State, HostExtra>;
export type GuestSave = ShellGuestSave;
export type Save = ShellSave<State, HostExtra>;

const decodeSeatCount: Decoder<SeatCount> = literal(...SEAT_COUNTS);

export const SHELL_STORE = shellStore<State, HostExtra, HomeTab>(STORAGE_KEYS, {
  game: 'uno',
  decodeGame: decodeState,
  hostExtra: {
    decode: object({ seatCount: decodeSeatCount }),
    literal: (save) => ({ seatCount: save.seatCount }),
  },
  decodeHomeTab: literal(...HOME_TABS),
});
export const { enabled: soundEnabled, write: writeSoundState } = SHELL_STORE.sound;

const SEATS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const;
const PLAYERS_PREF = textPref(STORAGE_KEYS.players, literal(...SEATS));

/** The remembered seat count, else two. */
export const readOpts = (store: Store): Opts => {
  const stored = PLAYERS_PREF.read(store);
  return stored.ok ? { seatCount: Number(stored.value) as SeatCount } : DEFAULT_OPTS;
};

export const writeOpts = (store: Store, opts: Opts): void => {
  PLAYERS_PREF.write(store, String(opts.seatCount) as (typeof SEATS)[number]);
};
