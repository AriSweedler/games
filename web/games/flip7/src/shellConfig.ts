// The half of Flip 7's shell config the game spells from its engine, protocol and storage alone
// (docs/design/flip7.md §8; docs/design/shared-shell.md §4.3): the id the room codes are made for,
// the copy the shared flows paint (the shell's N-seat forms, web/shared/ui/seatCopy.ts, dealt),
// the option codec (the shell's `seatCountOpts`: the room's one term is the seat count), the
// engine adapters (engine/index.ts: every action is checked against the seat that sent it), the
// protocol, the finished game's record and the shell's store; the names, tabs, modes, status copy
// and cue memory are the shell's defaults (dry-review-2026-10.md §7 row 2). Two to twelve at a
// table online and on one phone (the owner, 2026-10-02: "flip7 caps out at 12"); a room starts
// when every seat is taken (`fixed`), so the host deals to the table it opened. ui/state.ts
// completes the record with the table hooks.
import { seatCountOpts, seatedCopy } from '../../../shared/ui/seatCopy.ts';
import type { ShellGameData } from '../../../shared/ui/shell.ts';
import {
  MAX_SEATS,
  MIN_SEATS,
  SEAT_COUNTS,
  applyAction,
  createGame,
  decodeState,
  nameOf,
  viewFor,
} from './engine/index.ts';
import { PROTOCOL } from './protocol.ts';
import { SHELL_STORE } from './storage.ts';
import { CUES } from './ui/sound.ts';
import type { Flip7, FlipSeat } from './ui/state.ts';

/** The engine's seat index as the shell's seat type (0 to 11: the table's range). */
export const asSeat = (seat: number): FlipSeat => seat as FlipSeat;

export const FLIP7_SHELL: ShellGameData<Flip7> = {
  id: 'flip7',
  copy: seatedCopy({ verb: 'deal' }),
  seats: { min: MIN_SEATS, max: MAX_SEATS, fixed: true },
  opts: seatCountOpts(SEAT_COUNTS, (game) => game.seats.length),
  engine: {
    /** The deal over every seat the shell listed (the host first, or pass-and-play's inputs in order): the shell seats the room's capacity, so the names are the list's. */
    create: (players, _opts, rng, now) =>
      createGame(
        players.map((p) => p.name),
        rng,
        now,
      ),
    apply: (game, seat, act, rng) => applyAction(game, seat, act, rng),
    viewFor,
    decodeState,
    over: (view) => view.phase.kind === 'gameOver',
    finished: (game) => game.phase.kind === 'gameOver',
    names: (game) => [nameOf(game, 0), nameOf(game, 1)],
    renameGuest: (game, name, seat) => ({
      ...game,
      seats: game.seats.map((s, i) => (i === seat ? { ...s, name } : s)),
    }),
  },
  result: {
    playersOf: (view) => view.seats.map((s) => s.name),
    scoreOf: (view) => view.scores.map(String).join('–'),
    winnerOf: (view) => (view.phase.kind === 'gameOver' ? asSeat(view.phase.winner) : null),
  },
  frames: PROTOCOL,
  cues: { table: CUES },
  // The seat count is the shell's remembered terms (`opts/set`, `writeOpts`) and the third to twelfth names its `seatNames` (`seatName/typed`, `rememberSeatName`): both the seated store's (storage.ts).
  prefs: SHELL_STORE,
};
