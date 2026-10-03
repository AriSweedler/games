// Flip 7's browser storage (docs/design/flip7.md §8): the shell's keys under the `flip7_` prefix
// (web/shared/edge/prefs.ts `shellStore`; tools/games.ts REGISTRY pins the save key and the prefix),
// the seat count the two Players selects share, and the third to sixth pass-and-play names.
import type { Store, StorageError } from '../../../shared/edge/storage.ts';
import {
  decodeDigitsOf,
  extraNamePrefs,
  seatCountPref,
  shellKeys,
  shellStore,
  type GuestSave as ShellGuestSave,
  type HostSave as ShellHostSave,
  type LocalSave as ShellLocalSave,
  type PlayMode,
  type Save as ShellSave,
} from '../../../shared/edge/prefs.ts';
import { literal, object, type Decoder } from '../../../shared/lib/json.ts';
import { SEAT_COUNTS, decodeState, type SeatCount, type State } from './engine/index.ts';

export type { PlayMode, Store, StorageError };

const PREFIX = 'flip7_';
export const STORAGE_KEYS = {
  /** The shell's keys (prefs.ts `ShellKeysOf`): the save and the eight preferences every shell keeps. */
  ...shellKeys(PREFIX, 'flip7MP_v1'),
  /** The third to twelfth pass-and-play names, under the name rule (this page alone seats them; `extraNamePrefs`). */
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
export const EXTRA_NAME_PREFS = extraNamePrefs(PREFIX, EXTRA_SEATS);

/** A seat count from its digit (`"3"`), one of SEAT_COUNTS (prefs.ts `decodeDigitsOf`). */
export const decodeSeatCount: Decoder<SeatCount> = decodeDigitsOf(SEAT_COUNTS);
const PLAYERS_PREF = seatCountPref(STORAGE_KEYS.players, SEAT_COUNTS);

export const readOpts = (store: Store): Opts => {
  const read = PLAYERS_PREF.read(store);
  return { seatCount: read.ok ? read.value : DEFAULT_OPTS.seatCount };
};

export const writeOpts = (store: Store, opts: Opts): void => {
  PLAYERS_PREF.write(store, opts.seatCount);
};
