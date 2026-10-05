// The half of Hearts's shell config the game spells from its engine, protocol and storage alone
// (docs/design/hearts.md §3; web/shared/ui/shell.ts `ShellGameData`): the id the table codes are
// made for, the copy the shared flows paint (the leave confirms over a game, a score and a table:
// the shell's words), the option codec (two seats, always), the engine adapters (engine/view.ts),
// the protocol, the cue table and the shell's store; the names, tabs, modes, status copy and cue
// memory are the shell's defaults (docs/design/dry-review-2026-10.md §7 row 2). The table hooks
// are the reducer's (ui/state.ts `HEARTS`).
import { hostRoomMsg, leaveCopy } from '../../../shared/ui/seatCopy.ts';
import type { ShellGameData } from '../../../shared/ui/shell.ts';
import { applyAction, createState, decodeState, viewFor, winnerSeat } from './engine/view.ts';
import { PROTOCOL } from './protocol.ts';
import { DEFAULT_OPTS, SHELL_STORE } from './storage.ts';
import { CUES } from './ui/sound.ts';
import type { Hearts } from './ui/state.ts';

export const HEARTS_SHELL: ShellGameData<Hearts> = {
  id: 'hearts',
  copy: { ...leaveCopy(), hostRoom: hostRoomMsg('start') },
  opts: {
    initial: DEFAULT_OPTS,
    parse: () => DEFAULT_OPTS,
    ofGame: () => DEFAULT_OPTS,
    pick: () => DEFAULT_OPTS,
  },
  engine: {
    create: (players, _opts, _rng, now) => createState([players[0].name, players[1].name], now),
    apply: (game, seat, act, rng, now) => applyAction(game, seat, act, rng, now),
    viewFor,
    decodeState,
    over: (view) => view.game.result !== null,
    finished: (game) => game.game.result !== null,
    names: (game) => game.game.names,
    renameGuest: (game, name) => ({
      ...game,
      game: { ...game.game, names: [game.game.names[0], name] },
    }),
  },
  result: {
    playersOf: (view) => view.names,
    scoreOf: (view) => {
      const result = view.game.result;
      if (result === null) return '';
      return result.kind === 'draw' ? 'draw' : result.by;
    },
    winnerOf: (view) => winnerSeat(view.game.result),
  },
  frames: PROTOCOL,
  cues: { table: CUES },
  prefs: SHELL_STORE,
};
