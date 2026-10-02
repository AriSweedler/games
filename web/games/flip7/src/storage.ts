// Flip 7's browser storage (docs/design/flip7.md §8): the shell's keys under the `flip7_` prefix
// (web/shared/edge/prefs.ts `shellStore`; tools/games.ts REGISTRY pins the save key and the prefix),
// the seat count the two Players selects share, and the third to sixth pass-and-play names.
import type { Store, StorageError } from '../../../shared/edge/storage.ts';
import {
  namePref,
  readTextWith,
  shellStore,
  type GuestSave as ShellGuestSave,
  type HostSave as ShellHostSave,
  type LocalSave as ShellLocalSave,
  type PlayMode,
  type Save as ShellSave,
  type TextPref,
} from '../../../shared/edge/prefs.ts';
import { literal, map, object, refine, string, type Decoder } from '../../../shared/lib/json.ts';
import { SEAT_COUNTS, decodeState, type SeatCount, type State } from './engine/index.ts';

export type { PlayMode, Store, StorageError };

export const STORAGE_KEYS = {
  save: 'flip7MP_v1',
  name: 'flip7_name',
  p2Name: 'flip7_p2Name',
  p3Name: 'flip7_p3Name',
  p4Name: 'flip7_p4Name',
  p5Name: 'flip7_p5Name',
  p6Name: 'flip7_p6Name',
  p7Name: 'flip7_p7Name',
  p8Name: 'flip7_p8Name',
  p9Name: 'flip7_p9Name',
  p10Name: 'flip7_p10Name',
  p11Name: 'flip7_p11Name',
  p12Name: 'flip7_p12Name',
  homeTab: 'flip7_homeTab',
  playMode: 'flip7_playMode',
  sound: 'flip7_sound',
  soundFont: 'flip7_soundFont',
  flipTable: 'flip7_flipTable',
  recentGames: 'flip7_recentGames',
  players: 'flip7_players',
} as const;

export const HOME_TABS = ['play', 'rules', 'about'] as const;
export type HomeTab = (typeof HOME_TABS)[number];
export const DEFAULT_HOME_TAB: HomeTab = 'play';
export const DEFAULT_PLAY_MODE: PlayMode = 'online';

/** The room's one term. */
export type Opts = Readonly<{ seatCount: SeatCount }>;
export const DEFAULT_OPTS: Opts = { seatCount: 2 };

export type LocalSave = ShellLocalSave<State>;
export type HostSave = ShellHostSave<State, Opts>;
export type GuestSave = ShellGuestSave;
export type Save = ShellSave<State, Opts>;

const decodeSeatCountField: Decoder<SeatCount> = literal(...SEAT_COUNTS);
const decodeOpts: Decoder<Opts> = object({ seatCount: decodeSeatCountField });

export const SHELL_STORE = shellStore<State, Opts, HomeTab>(STORAGE_KEYS, {
  game: 'flip7',
  decodeGame: decodeState,
  hostExtra: { decode: decodeOpts, literal: (save) => ({ seatCount: save.seatCount }) },
  decodeHomeTab: literal(...HOME_TABS),
});
export const { enabled: soundEnabled } = SHELL_STORE.sound;

/** The seats past the shell's two (the third to the twelfth): their names, remembered as typed. */
export type ExtraSeat = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export const EXTRA_SEATS: ReadonlyArray<ExtraSeat> = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
export const EXTRA_NAME_PREFS: Readonly<Record<ExtraSeat, TextPref<string>>> = {
  2: namePref(STORAGE_KEYS.p3Name),
  3: namePref(STORAGE_KEYS.p4Name),
  4: namePref(STORAGE_KEYS.p5Name),
  5: namePref(STORAGE_KEYS.p6Name),
  6: namePref(STORAGE_KEYS.p7Name),
  7: namePref(STORAGE_KEYS.p8Name),
  8: namePref(STORAGE_KEYS.p9Name),
  9: namePref(STORAGE_KEYS.p10Name),
  10: namePref(STORAGE_KEYS.p11Name),
  11: namePref(STORAGE_KEYS.p12Name),
};

/** A seat count from its digit (`"3"`). */
export const decodeSeatCount: Decoder<SeatCount> = map(
  refine(string, (s) => SEAT_COUNTS.some((n) => String(n) === s), 'an integer in [2, 12]'),
  (s) => Number(s) as SeatCount,
);

export const readOpts = (store: Store): Opts => {
  const read = readTextWith(store, STORAGE_KEYS.players, decodeSeatCount);
  return { seatCount: read.ok ? read.value : DEFAULT_OPTS.seatCount };
};

export const writeOpts = (store: Store, opts: Opts): void => {
  store.writeText(STORAGE_KEYS.players, String(opts.seatCount));
};
