// Hearts's storage (docs/design/hearts.md §3): the shared shell's keys under this game's prefix
// (web/shared/edge/prefs.ts `shellStore`) and no key of its own. tools/games.ts REGISTRY pins the
// save key and the prefix.
import type { Store, StorageError } from '../../../shared/edge/storage.ts';
import {
  shellStore,
  DEFAULT_PLAY_MODE,
  HOME_TABS,
  type HomeTab,
  type PlayMode,
} from '../../../shared/edge/prefs.ts';
import { literal, object } from '../../../shared/lib/json.ts';
import { decodeState, type State } from './engine/view.ts';

export type { PlayMode, Store, StorageError };

export const STORAGE_KEYS = {
  /** The game in progress: pass-and-play, or the host's table and game, or the guest's table. */
  save: 'heartsMP_v1',
  name: 'hearts_name',
  p2Name: 'hearts_p2Name',
  homeTab: 'hearts_homeTab',
  playMode: 'hearts_playMode',
  sound: 'hearts_sound',
  soundFont: 'hearts_soundFont',
  recentGames: 'hearts_recentGames',
  flipTable: 'hearts_flipTable',
} as const;

// The tabs and the stored mode's default are the shell's (prefs.ts); re-exported for ui/state.ts, which may not import prefs.ts's edge.
export { DEFAULT_PLAY_MODE, HOME_TABS, type HomeTab };

/** The room's terms: two seats, always (the shell's option record needs one field). */
export type Opts = Readonly<{ seatCount: 2 }>;
export const DEFAULT_OPTS: Opts = { seatCount: 2 };

export const SHELL_STORE = shellStore<State, Opts, HomeTab>(STORAGE_KEYS, {
  game: 'hearts',
  decodeGame: decodeState,
  hostExtra: {
    decode: object({ seatCount: literal(2) }),
    literal: () => DEFAULT_OPTS,
  },
  decodeHomeTab: literal(...HOME_TABS),
});
