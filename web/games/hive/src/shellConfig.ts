// The half of Hive's shell config the game spells from its engine, protocol and storage alone
// (docs/design/hive.md §7; web/shared/ui/shell.ts `ShellGameData`): the id the table codes are
// made for, the copy the shared flows paint (the leave confirms clear a board), the option codec
// (two seats, always), the engine adapters (engine/view.ts: the host holds the game, both seats
// see the whole board), the protocol and the shell's store; the names, tabs, modes, status copy
// and cue memory are the shell's defaults (dry-review-2026-10.md §7 row 2). The table hooks and
// the rest of `home` are the reducer's (ui/state.ts `HIVE`).
import { hostRoomMsg, leaveCopy } from '../../../shared/ui/seatCopy.ts';
import type { ShellGameData } from '../../../shared/ui/shell.ts';
import {
  applyAction,
  createState,
  decodeState,
  viewFor,
  winnerSeat,
  type Seat,
} from './engine/view.ts';
import { PROTOCOL } from './protocol.ts';
import { DEFAULT_OPTS, SHELL_STORE, readHints, readMotion } from './storage.ts';
import { CUES } from './ui/sound.ts';
import type { Hive } from './ui/state.ts';

/** The side a seat plays: "White" or "Black". */
export const sideName = (seat: Seat): string => (seat === 0 ? 'White' : 'Black');

export const HIVE_SHELL: ShellGameData<Hive> = {
  id: 'hive',
  copy: { ...leaveCopy({ cleared: 'The board' }), hostRoom: hostRoomMsg('start') },
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
    playersOf: (view) => view.names,
    // The score is how the game ended: a surround, a resignation, or a draw.
    scoreOf: (view) => {
      const result = view.game.result;
      if (result === null) return '';
      return result.kind === 'draw' ? 'draw' : result.by === 'resign' ? 'resigned' : 'surrounded';
    },
    winnerOf: (view) => winnerSeat(view.game.result),
  },
  frames: PROTOCOL,
  cues: { table: CUES },
  // The tiles' motion and the hints, remembered per device (settings.ts): read at boot with the shell's keys.
  home: { read: (store) => ({ motion: readMotion(store), hints: readHints(store) }) },
  prefs: SHELL_STORE,
};
