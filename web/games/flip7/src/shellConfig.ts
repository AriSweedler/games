// The half of Flip 7's shell config the game spells from its engine, protocol and storage alone
// (docs/design/flip7.md §8; docs/design/shared-shell.md §4.3): the id the room codes are made for,
// the copy the shared flows paint (the shell's N-seat forms, web/shared/ui/seatCopy.ts, dealt),
// the option codec (the room's one term, the seat count), the engine adapters (engine/index.ts:
// every action is checked against the seat that sent it), the protocol, the finished game's record
// and the shell's store; the names, tabs, modes, status copy and cue memory are the shell's
// defaults (dry-review-2026-10.md §7 row 2). Two to twelve at a
// table online and on one phone (the owner, 2026-10-02: "flip7 caps out at 12"); a room starts
// when every seat is taken (`fixed`), so the host deals to the table it opened. ui/state.ts
// completes the record with the table hooks.
import { parseSeatCount, seatedCopy } from '../../../shared/ui/seatCopy.ts';
import type { Player, ShellGameData } from '../../../shared/ui/shell.ts';
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
import {
  DEFAULT_OPTS,
  EXTRA_NAME_PREFS,
  EXTRA_SEATS,
  SHELL_STORE,
  readOpts,
  writeOpts,
  type Opts,
} from './storage.ts';
import { CUES } from './ui/sound.ts';
import type { Flip7, FlipSeat, Raw } from './ui/state.ts';

/** The room's terms off the raw inputs: the Online stepper or its pass-and-play twin, whichever the click carried. */
export const parseOpts = (raw: Raw, current: Opts): Opts => ({
  seatCount: parseSeatCount(SEAT_COUNTS, raw.players ?? raw.localPlayers, current.seatCount),
});

/** The names the engine deals to: the shell's seats in order, a missing one `Player N`. */
export const seatNames = (n: number, seats: ReadonlyArray<Player>): ReadonlyArray<string> =>
  Array.from({ length: n }, (_, i) => seats[i]?.name ?? `Player ${String(i + 1)}`);

/** The engine's seat index as the shell's seat type (0 to 11: the table's range). */
export const asSeat = (seat: number): FlipSeat => seat as FlipSeat;

export const FLIP7_SHELL: ShellGameData<Flip7> = {
  id: 'flip7',
  copy: seatedCopy({ verb: 'deal' }),
  seats: { min: MIN_SEATS, max: MAX_SEATS, fixed: true },
  opts: {
    initial: DEFAULT_OPTS,
    parse: parseOpts,
    ofGame: (game) => ({ seatCount: parseSeatCount(SEAT_COUNTS, String(game.seats.length), 2) }),
    pick: (from) => ({ seatCount: from.seatCount }),
    capacity: (opts) => opts.seatCount,
  },
  engine: {
    create: (players, opts, rng, now) => createGame(seatNames(opts.seatCount, players), rng, now),
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
  // The seat count is the shell's remembered terms (`opts/set`, `writeOpts`), under this game's `players` key; the third to twelfth names its `seatNames` (`seatName/typed`, `rememberSeatName`), under `p3Name` on.
  prefs: {
    ...SHELL_STORE,
    opts: { read: readOpts, write: writeOpts },
    seatNames: EXTRA_SEATS.map((seat) => EXTRA_NAME_PREFS[seat]),
  },
};
