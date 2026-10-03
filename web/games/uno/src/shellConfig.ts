// The half of UNO's shell config the game spells from its engine, protocol and storage alone
// (docs/design/uno.md §9; web/shared/ui/shell.ts `ShellGameData`): the id the table codes are made
// for, the copy the shared flows paint (the N-seat forms are the shell's, web/shared/ui/seatCopy.ts,
// dealt), the option codec (the seat count alone), the engine adapters (engine/view.ts: the host
// deals, every seat sees its own hand), the protocol and the shell's store; the names, tabs,
// modes, status copy and cue memory are the shell's defaults (dry-review-2026-10.md §7 row 2). The
// table hooks are the reducer's (ui/state.ts `UNO`). Online seats two to twelve (the owner,
// 2026-10-02: "uno caps out at 12"), fixed when the room opens and started full (`seats.fixed`).
import { parseSeatCount, seatedCopy } from '../../../shared/ui/seatCopy.ts';
import type { Player, ShellGameData } from '../../../shared/ui/shell.ts';
import { SEAT_COUNTS, applyAction, createState, decodeState, viewFor } from './engine/view.ts';
import { PROTOCOL } from './protocol.ts';
import {
  DEFAULT_OPTS,
  EXTRA_NAME_PREFS,
  SHELL_STORE,
  readOpts,
  writeOpts,
  type Opts,
} from './storage.ts';
import { CUES } from './ui/sound.ts';
import type { Raw, Seat, Uno } from './ui/state.ts';

/** The seat counts the room and the home's steppers allow (the owner, 2026-10-02: "uno caps out at 12"). */
export const MIN_SEATS = 2;
export const MAX_SEATS = 12;
/** The room's terms off the raw inputs: the Online stepper or its pass-and-play twin, whichever the click carried. */
export const parseOpts = (raw: Raw, current: Opts): Opts => ({
  seatCount: parseSeatCount(SEAT_COUNTS, raw.players ?? raw.localPlayers, current.seatCount),
});

/** Every seat's name in order for a table of `n` (the shell lists the host, then every guest seat). */
export const seatNames = (n: number, seats: ReadonlyArray<Player>): ReadonlyArray<string> =>
  Array.from({ length: n }, (_, i) => seats[i]?.name ?? `Player ${String(i + 1)}`);

export const UNO_SHELL: ShellGameData<Uno> = {
  id: 'uno',
  copy: seatedCopy({ verb: 'deal' }),
  seats: { min: MIN_SEATS, max: MAX_SEATS, fixed: true },
  opts: {
    initial: DEFAULT_OPTS,
    parse: parseOpts,
    ofGame: (game) => ({
      seatCount: parseSeatCount(SEAT_COUNTS, String(game.game.names.length), 2),
    }),
    pick: (from) => ({ seatCount: from.seatCount }),
    capacity: (opts) => opts.seatCount,
  },
  engine: {
    create: (players, opts, rng, now) => createState(seatNames(opts.seatCount, players), rng, now),
    apply: applyAction,
    viewFor,
    decodeState,
    over: (view) => view.phase === 'gameOver',
    finished: (game) => game.game.phase.kind === 'gameOver',
    names: (game) => [game.game.names[0] ?? '', game.game.names[1] ?? ''],
    renameGuest: (game, name, seat) => ({
      ...game,
      game: { ...game.game, names: game.game.names.map((n, i) => (i === seat ? name : n)) },
    }),
  },
  result: {
    playersOf: (view) => view.names,
    // One round is the game (the owner, 2026-10-02): the score is the cards each seat still held.
    scoreOf: (view) => view.counts.map(String).join('–'),
    winnerOf: (view) => (view.winner === null ? null : (view.winner as Seat)),
  },
  frames: PROTOCOL,
  cues: { table: CUES },
  // The seat count is the shell's remembered terms (`opts/set`, `writeOpts`), under this game's `players` key; the third to twelfth names its `seatNames` (`seatName/typed`, `rememberSeatName`), under `p3Name` on.
  prefs: {
    ...SHELL_STORE,
    opts: { read: readOpts, write: writeOpts },
    seatNames: EXTRA_NAME_PREFS,
  },
};
