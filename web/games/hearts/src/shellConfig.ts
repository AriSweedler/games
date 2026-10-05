// The half of Hearts's shell config the game spells from its engine, protocol and storage alone
// (docs/design/hearts.md §7; web/shared/ui/shell.ts `ShellGameData`): the id the table codes are
// made for, the copy the shared flows paint (the shell's N-seat forms, web/shared/ui/seatCopy.ts,
// dealt), the option codec (the shell's `seatCountOpts`: the room's one term is the seat count,
// three or four), the engine adapters (engine/view.ts: every action is checked against the seat
// that sent it), the protocol, the cue table and the shell's store; the names, tabs, modes, status
// copy and cue memory are the shell's defaults. A room starts when every seat is taken (`fixed`),
// so the host deals to the table it opened. The table hooks are the reducer's (ui/state.ts `HEARTS`).
import { seatCountOpts, seatedCopy } from '../../../shared/ui/seatCopy.ts';
import type { ShellGameData } from '../../../shared/ui/shell.ts';
import {
  MAX_SEATS,
  MIN_SEATS,
  SEAT_COUNTS,
  applyAction,
  createState,
  decodeState,
  viewFor,
} from './engine/view.ts';
import { PROTOCOL } from './protocol.ts';
import { SHELL_STORE } from './storage.ts';
import { CUES } from './ui/sound.ts';
import type { Hearts, HeartsSeat } from './ui/state.ts';

/** The engine's seat index as the shell's seat type (0 to 3: the table's range). */
export const asSeat = (seat: number): HeartsSeat => seat as HeartsSeat;

export const HEARTS_SHELL: ShellGameData<Hearts> = {
  id: 'hearts',
  copy: seatedCopy({ verb: 'deal' }),
  seats: { min: MIN_SEATS, max: MAX_SEATS, fixed: true },
  opts: seatCountOpts(SEAT_COUNTS, (game) => game.game.names.length),
  engine: {
    /** The deal over every seat the shell listed (the host first, or pass-and-play's inputs in order). */
    create: (players, _opts, rng, now) =>
      createState(
        players.map((p) => p.name),
        rng,
        now,
      ),
    apply: (game, seat, act, rng, now) => applyAction(game, seat, act, rng, now),
    viewFor,
    decodeState,
    over: (view) => view.phase === 'gameOver',
    finished: (game) => game.game.phase === 'gameOver',
    names: (game) => [game.game.names[0] ?? '', game.game.names[1] ?? ''],
    renameGuest: (game, name, seat) => ({
      ...game,
      game: { ...game.game, names: game.game.names.map((n, i) => (i === seat ? name : n)) },
    }),
  },
  result: {
    playersOf: (view) => view.names,
    scoreOf: (view) => view.scores.map(String).join('–'),
    winnerOf: (view) => (view.winners[0] === undefined ? null : asSeat(view.winners[0])),
  },
  frames: PROTOCOL,
  cues: { table: CUES },
  // The seat count is the shell's remembered terms and the third and fourth names its `seatNames`: both the seated store's (storage.ts).
  prefs: SHELL_STORE,
};
