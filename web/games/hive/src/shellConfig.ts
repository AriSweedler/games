// The half of Hive's shell config the game spells from its engine, protocol and storage alone
// (docs/design/hive.md §7; web/shared/ui/shell.ts `ShellGameData`): the id the table codes are
// made for, the default names, the tabs, the two stored modes, the copy the shared flows paint,
// the option codec (two seats, always), the engine adapters (engine/view.ts: the host holds the
// game, both seats see the whole board), the frame builders, the cue memory's start and the
// shell's store. The table hooks and the rest of `home` are the reducer's (ui/state.ts `HIVE`).
import { INITIAL_CUE_MEMORY, type ShellGameData } from '../../../shared/ui/shell.ts';
import { connectingMsg } from '../../../shared/net/guest.ts';
import { OPENING_MSG, handoffMsg } from '../../../shared/net/host.ts';
import {
  applyAction,
  createState,
  decodeState,
  viewFor,
  winnerSeat,
  type Seat,
} from './engine/view.ts';
import { action, join, lobby, state, toast } from './protocol.ts';
import {
  DEFAULT_HOME_TAB,
  DEFAULT_OPTS,
  DEFAULT_PLAY_MODE,
  HOME_TABS,
  SHELL_STORE,
  readHints,
  readMotion,
  type PlayMode,
} from './storage.ts';
import type { Hive } from './ui/state.ts';

export const DEFAULT_NAME = 'Ari';
/** The pass-and-play seats when nothing is typed: White, then Black. */
export const LOCAL_NAMES: ReadonlyArray<string> = ['Ari', 'Lavi'];
export const LEAVE_LOCAL_MSG = 'End this game? The board will be cleared.';
export const LEAVE_ONLINE_MSG = 'Leave this game? The table will close.';

export const hostRoomMsg = (hostName: string): string =>
  `Connected — waiting for ${hostName} to start`;

/** The side a seat plays: "White" or "Black". */
export const sideName = (seat: Seat): string => (seat === 0 ? 'White' : 'Black');

export const HIVE_SHELL: ShellGameData<Hive> = {
  id: 'hive',
  names: { default: DEFAULT_NAME },
  localNames: LOCAL_NAMES,
  tabs: { list: HOME_TABS, default: DEFAULT_HOME_TAB },
  modes: {
    default: DEFAULT_PLAY_MODE,
    parse: (raw) => {
      const mode: PlayMode = raw === 'local' ? 'local' : 'online';
      return { shown: mode, stored: mode };
    },
  },
  copy: {
    leaveLocal: LEAVE_LOCAL_MSG,
    leaveOnline: LEAVE_ONLINE_MSG,
    opening: OPENING_MSG,
    connecting: connectingMsg,
    handoff: handoffMsg,
    hostRoom: (hostName) => hostRoomMsg(hostName),
  },
  opts: {
    initial: DEFAULT_OPTS,
    parse: () => DEFAULT_OPTS,
    ofGame: () => DEFAULT_OPTS,
    pick: () => DEFAULT_OPTS,
  },
  engine: {
    create: (players, _opts, _rng, now) => createState([players[0].name, players[1].name], now),
    apply: (game, seat, act, _rng, now) => applyAction(game, seat, act, now),
    viewFor,
    decodeState,
    over: (view) => view.game.result !== null,
    finished: (game) => game.game.result !== null,
    names: (game) => [game.game.names.white, game.game.names.black],
    renameGuest: (game, name) => ({
      ...game,
      game: { ...game.game, names: { ...game.game.names, black: name } },
    }),
  },
  result: {
    keyOf: (view) => String(view.startedAt),
    playersOf: (view) => view.names,
    // The score is how the game ended: a surround, a resignation, or a draw.
    scoreOf: (view) => {
      const result = view.game.result;
      if (result === null) return '';
      return result.kind === 'draw' ? 'draw' : result.by === 'resign' ? 'resigned' : 'surrounded';
    },
    winnerOf: (view) => winnerSeat(view.game.result),
  },
  frames: { lobby, state, toast, action, join },
  cues: { initial: INITIAL_CUE_MEMORY },
  // The tiles' motion and the hints, remembered per device (settings.ts): read at boot with the shell's keys.
  home: { read: (store) => ({ motion: readMotion(store), hints: readHints(store) }) },
  prefs: SHELL_STORE,
};
