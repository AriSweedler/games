// The half of UNO's shell config the game spells from its engine, protocol and storage alone
// (docs/design/uno.md §9; web/shared/ui/shell.ts `ShellGameData`): the id the table codes are made
// for, the default names, the tabs, the two stored modes, the copy the shared flows paint (the
// N-seat forms are the shell's, web/shared/ui/seatCopy.ts, dealt), the option codec
// (the seat count alone), the engine adapters (engine/view.ts: the host deals, every seat sees its
// own hand), the frame builders, the cue memory's start and the shell's store. The table hooks and
// the rest of `home` are the reducer's (ui/state.ts `UNO`). Online seats two to twelve (the owner,
// 2026-10-02: "uno caps out at 12"), fixed when the room opens and started full (`seats.fixed`).
import { parseSeatCount, seatedCopy } from '../../../shared/ui/seatCopy.ts';
import { INITIAL_CUE_MEMORY, type Player, type ShellGameData } from '../../../shared/ui/shell.ts';
import { connectingMsg } from '../../../shared/net/guest.ts';
import { OPENING_MSG, WAITING_MSG, handoffMsg } from '../../../shared/net/host.ts';
import { SEAT_COUNTS, applyAction, createState, decodeState, viewFor } from './engine/view.ts';
import { action, join, lobby, state, toast } from './protocol.ts';
import {
  DEFAULT_HOME_TAB,
  DEFAULT_OPTS,
  DEFAULT_PLAY_MODE,
  EXTRA_NAME_PREFS,
  HOME_TABS,
  SHELL_STORE,
  readOpts,
  writeOpts,
  type Opts,
} from './storage.ts';
import { CUES } from './ui/sound.ts';
import type { Raw, Seat, Uno } from './ui/state.ts';

export const DEFAULT_NAME = 'Ari';
/** The seat counts the room and the home's steppers allow (the owner, 2026-10-02: "uno caps out at 12"). */
export const MIN_SEATS = 2;
export const MAX_SEATS = 12;
/** The pass-and-play seats when nothing is typed: the shell's two, then the third and fourth. */
export const LOCAL_NAMES: ReadonlyArray<string> = ['Ari', 'Lavi', 'Sandro', 'Grant'];
export const LEAVE_LOCAL_MSG = 'End this game? The score will be cleared.';
export const LEAVE_ONLINE_MSG = 'Leave this game? The table will close.';

/** The room's terms off the raw inputs: the Online stepper or its pass-and-play twin, whichever the click carried. */
export const parseOpts = (raw: Raw, current: Opts): Opts => ({
  seatCount: parseSeatCount(SEAT_COUNTS, raw.players ?? raw.localPlayers, current.seatCount),
});

/** Every seat's name in order for a table of `n` (the shell lists the host, then every guest seat). */
export const seatNames = (n: number, seats: ReadonlyArray<Player>): ReadonlyArray<string> =>
  Array.from({ length: n }, (_, i) => seats[i]?.name ?? `Player ${String(i + 1)}`);

export const UNO_SHELL: ShellGameData<Uno> = {
  id: 'uno',
  names: { default: DEFAULT_NAME },
  localNames: LOCAL_NAMES,
  tabs: { list: HOME_TABS, default: DEFAULT_HOME_TAB },
  modes: { default: DEFAULT_PLAY_MODE },
  copy: {
    ...seatedCopy({ verb: 'deal', waitingAtTwo: WAITING_MSG }),
    leaveLocal: LEAVE_LOCAL_MSG,
    leaveOnline: LEAVE_ONLINE_MSG,
    opening: OPENING_MSG,
    connecting: connectingMsg,
    handoff: handoffMsg,
  },
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
    keyOf: (view) => String(view.startedAt),
    playersOf: (view) => view.names,
    // One round is the game (the owner, 2026-10-02): the score is the cards each seat still held.
    scoreOf: (view) => view.counts.map(String).join('–'),
    winnerOf: (view) => (view.winner === null ? null : (view.winner as Seat)),
  },
  frames: { lobby, state, toast, action, join },
  cues: { initial: INITIAL_CUE_MEMORY, table: CUES },
  home: {
    read: (store) => ({
      extraNames: EXTRA_NAME_PREFS.map((pref) => {
        const name = pref.read(store);
        return name.ok ? name.value : null;
      }),
    }),
  },
  // The seat count is the shell's remembered terms (`opts/set`, `writeOpts`), under this game's `players` key.
  prefs: { ...SHELL_STORE, opts: { read: readOpts, write: writeOpts } },
};
