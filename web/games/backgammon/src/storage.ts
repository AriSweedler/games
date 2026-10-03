// The backgammon page's localStorage (docs/design/backgammon-board.md §5.2, the keys):
// gin's storage.ts key for key under this game's own names, so two games on one origin never
// read each other's saves or preferences (docs/ARCHITECTURE.md "Module boundaries": only this
// module names the keys). Every read goes through a decoder built on the engine's `decodeState`
// and refuses anything else; every write produces the literal the decoder reads back, so a save
// re-encodes byte for byte (R32). It takes a `Store` from web/shared/edge/storage.ts, so tests run
// it over a Map. The save is JSON; every preference is a bare string (`backgammon_name`,
// `backgammon_homeTab`, `backgammon_playMode`, `backgammon_sound`, `backgammon_soundFont`,
// `backgammon_flipTable`, `backgammon_variant`, `backgammon_matchLength`, `backgammon_curtain`), as
// gin's are. The shell's keys come off the prefix (`shellKeys`, shell-hoist.md §3 M); the readers
// and writers both shells share (the name rule, the bare-string preferences, the save's three
// roles) are built by web/shared/edge/prefs.ts (docs/design/shared-shell.md §5 A3) over the keys,
// the engine decoder and the host save's own fields spelled here, grouped as the `SHELL_STORE` the
// shell config carries (§5 C2 `shellStore`); the keys and the literals did not move.
import type { Store, StorageError } from '../../../shared/edge/storage.ts';
import {
  NAME_MAX,
  PLAY_MODES,
  SOUND_STATES,
  decodeName,
  decodePlayMode,
  decodeFlipState,
  decodeDigitsOf,
  decodeSoundFont,
  decodeSoundState,
  digitsPref,
  shellKeys,
  shellStore,
  textPref,
  type FlipState,
  type GuestSave as ShellGuestSave,
  type HostSave as ShellHostSave,
  type LocalSave as ShellLocalSave,
  type PlayMode,
  type Save as ShellSave,
  type SoundState,
  DEFAULT_HOME_TAB,
  DEFAULT_PLAY_MODE,
  HOME_TABS,
  type HomeTab,
} from '../../../shared/edge/prefs.ts';

// ui/state.ts names the Store through this module: the reducer may import everything below it
// but never an edge (docs/ARCHITECTURE.md "Module boundaries").
export type { Store, StorageError };
// The shell's shared literals, named through this module too, so the page has one storage import.
export {
  NAME_MAX,
  PLAY_MODES,
  SOUND_STATES,
  decodeFlipState,
  decodeName,
  decodePlayMode,
  decodeSoundFont,
  decodeSoundState,
  type FlipState,
  type PlayMode,
  type SoundState,
};
import { integer, literal, object, type Decoder } from '../../../shared/lib/json.ts';
import {
  decodeState,
  MATCH_LENGTHS,
  SHIPPED_VARIANTS,
  type ShippedVariant,
  type State,
} from './engine/index.ts';

export const STORAGE_KEYS = {
  /** The shell's keys (prefs.ts `ShellKeysOf`): the save and the eight preferences every shell keeps. */
  ...shellKeys('backgammon_', 'backgammonMP_v1'),
  /** The ruleset the home screen last chose (bare string, a shipped variant only). */
  variant: 'backgammon_variant',
  /** The match length the home screen last chose (bare string naming one of MATCH_LENGTHS). */
  matchLength: 'backgammon_matchLength',
  /** The pass-and-play curtain: `always` or `never` (bare string; backgammon-board.md §4.9). */
  curtain: 'backgammon_curtain',
} as const;
export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// The tabs and the stored mode's default are the shell's (prefs.ts); re-exported for ui/state.ts, which may not import prefs.ts's edge.
export { DEFAULT_HOME_TAB, DEFAULT_PLAY_MODE, HOME_TABS, type HomeTab };
export const CURTAIN_MODES = ['always', 'never'] as const;
export type CurtainMode = (typeof CURTAIN_MODES)[number];
export const DEFAULT_CURTAIN_MODE: CurtainMode = 'always';
export {
  DEFAULT_SOUND_FONT,
  SOUND_FONTS,
  type SoundFontName,
} from '../../../shared/lib/sound/fonts.ts';
export {
  DEFAULT_MATCH_LENGTH,
  DEFAULT_VARIANT,
  MATCH_LENGTHS,
  SHIPPED_VARIANTS,
  type ShippedVariant,
} from './engine/index.ts';

/** One of three shapes by role; the keys are in the order `writeSave` emits them. */
export type LocalSave = ShellLocalSave<State>;
/** The host save's own fields, between `myName` and `game` in the literal: the match's terms. */
export type HostExtra = Readonly<{ matchLength: number; variant: ShippedVariant }>;
export type HostSave = ShellHostSave<State, HostExtra>;
export type GuestSave = ShellGuestSave;
export type Save = ShellSave<State, HostExtra>;

const shippedVariant: Decoder<ShippedVariant> = literal(...SHIPPED_VARIANTS);
const hostExtra: Decoder<HostExtra> = object({ matchLength: integer(1), variant: shippedVariant });

export const decodeHomeTab: Decoder<HomeTab> = literal(...HOME_TABS);
/** Shipped literals only: a stored plakoto or fevga reads as an error until they ship (Q1). */
export const decodeVariant: Decoder<ShippedVariant> = shippedVariant;
/** A bare string naming one of MATCH_LENGTHS (`"5"`), read back as the number. */
export const decodeMatchLength: Decoder<number> = decodeDigitsOf(MATCH_LENGTHS);
export const decodeCurtainMode: Decoder<CurtainMode> = literal(...CURTAIN_MODES);

// ---- the shell's store: the game save and the bare-string preferences every shell keeps -----

export const SHELL_STORE = shellStore<State, HostExtra, HomeTab>(STORAGE_KEYS, {
  game: 'backgammon',
  decodeGame: decodeState,
  hostExtra: {
    decode: hostExtra,
    literal: (save) => ({ matchLength: save.matchLength, variant: save.variant }),
  },
  decodeHomeTab,
});
export const { decodeSave, readSave, writeSave, clearSave } = SHELL_STORE.save;
export const { read: readName, write: writeName } = SHELL_STORE.name;
/** The pass-and-play second name, under the same rule. */
export const { read: readP2Name, write: writeP2Name } = SHELL_STORE.p2Name;
export const { read: readHomeTab, write: writeHomeTab } = SHELL_STORE.homeTab;
export const { read: readPlayMode, write: writePlayMode } = SHELL_STORE.playMode;
export const {
  read: readSoundState,
  write: writeSoundState,
  enabled: soundEnabled,
} = SHELL_STORE.sound;
export const { read: readSoundFont, write: writeSoundFont } = SHELL_STORE.soundFont;
/** The far seat's flip, `on` or `off` (prefs.ts `FLIP_STATES`). */
export const { read: readFlipTable, write: writeFlipTable } = SHELL_STORE.flipTable;
/** The finished matches: the stored list or [], and one match put first under the cap. */
export const {
  read: readRecentGames,
  write: writeRecentGames,
  append: appendRecentGame,
} = SHELL_STORE.recentGames;

// ---- this page's own preferences -----------------------------------------------------------

export const { read: readVariant, write: writeVariant } = textPref(
  STORAGE_KEYS.variant,
  decodeVariant,
);

/** The match length is a number in the app and its digits in the store (prefs.ts `digitsPref`). */
export const { read: readMatchLength, write: writeMatchLength } = digitsPref(
  STORAGE_KEYS.matchLength,
  decodeMatchLength,
);

export const { read: readCurtainMode, write: writeCurtainMode } = textPref(
  STORAGE_KEYS.curtain,
  decodeCurtainMode,
);

export const ALL_KEYS: ReadonlyArray<StorageKey> = Object.values(STORAGE_KEYS);
