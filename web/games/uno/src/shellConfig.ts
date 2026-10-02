// The half of UNO's shell config the game spells from its engine, protocol and storage alone
// (docs/design/uno.md §9; web/shared/ui/shell.ts `ShellGameData`): the id the table codes are made
// for, the default names, the tabs, the two stored modes, the copy the shared flows paint (the
// N-seat forms are briscola's: the shell's two-seat string at a table of two), the option codec
// (the seat count alone), the engine adapters (engine/view.ts: the host deals, every seat sees its
// own hand), the frame builders, the cue memory's start and the shell's store. The table hooks and
// the rest of `home` are the reducer's (ui/state.ts `UNO`). Online seats two to twelve (the owner,
// 2026-10-02: "uno caps out at 12"), fixed when the room opens and started full (`seats.fixed`).
import {
  OPPONENT_LEFT_MSG,
  WAITING_FOR_GUEST_MSG,
  guestGoneMsg,
  joinedMsg,
  type Player,
  type ShellGameData,
} from '../../../shared/ui/shell.ts';
import { connectingMsg } from '../../../shared/net/guest.ts';
import { OPENING_MSG, WAITING_MSG, handoffMsg } from '../../../shared/net/host.ts';
import {
  SEAT_COUNTS,
  applyAction,
  createState,
  decodeState,
  viewFor,
  type SeatCount,
} from './engine/view.ts';
import { action, join, lobby, state, toast } from './protocol.ts';
import {
  DEFAULT_HOME_TAB,
  DEFAULT_OPTS,
  DEFAULT_PLAY_MODE,
  EXTRA_NAME_PREFS,
  HOME_TABS,
  SHELL_STORE,
  readOpts,
  type Opts,
  type PlayMode,
} from './storage.ts';
import { INITIAL_CUES } from './ui/sound.ts';
import type { Raw, Seat, Uno } from './ui/state.ts';

export const DEFAULT_NAME = 'Ari';
/** The seat counts the room and the home's steppers allow (the owner, 2026-10-02: "uno caps out at 12"). */
export const MIN_SEATS = 2;
export const MAX_SEATS = 12;
/** The pass-and-play seats when nothing is typed: the shell's two, then the third and fourth. */
export const LOCAL_NAMES: ReadonlyArray<string> = ['Ari', 'Lavi', 'Sandro', 'Grant'];
export const LEAVE_LOCAL_MSG = 'End this game? The score will be cleared.';
export const LEAVE_ONLINE_MSG = 'Leave this game? The table will close.';

/** "Seat 3": a seat nobody has named yet (the host is Seat 1). */
export const emptySeatName = (seat: number): string => `Seat ${String(seat + 1)}`;
export const hostRoomMsg = (hostName: string, seated = 2, capacity = 2): string =>
  capacity === 2
    ? `Connected — waiting for ${hostName} to deal`
    : `Connected — ${String(seated)} of ${String(capacity)} seated · waiting for ${hostName} to deal`;
export const waitingMsg = (capacity: number): string =>
  capacity === 2 ? WAITING_MSG : `Waiting for ${String(capacity - 1)} players to join`;
export const joinedText = (name: string, remaining: number): string =>
  remaining === 0 ? joinedMsg(name) : `${name} joined! Waiting for ${String(remaining)} more.`;
export const seatLeftMsg = (
  name: string | null,
  seat: number,
  seated: number,
  capacity: number,
): string =>
  capacity === 2
    ? OPPONENT_LEFT_MSG
    : `${name ?? emptySeatName(seat)} left. ${String(seated)} of ${String(capacity)} seated.`;
export const seatGoneMsg = (name: string | null, code: string | null, seat: number): string =>
  guestGoneMsg(name ?? emptySeatName(seat), code);
export const notEnoughMsg = (seated: number, min: number): string =>
  min === 2
    ? WAITING_FOR_GUEST_MSG
    : `${String(seated)} of ${String(min)} seated — waiting for ${String(min - seated)} more.`;
export const TABLE_FULL_MSG = 'That table is full.';

/** A seat count from a select's raw value (`"3"`), else `fallback`. */
export const parseSeatCount = (raw: string | undefined, fallback: SeatCount): SeatCount =>
  SEAT_COUNTS.find((n) => String(n) === raw) ?? fallback;

/** The room's terms off the raw inputs: the Online select or its pass-and-play twin, whichever the click carried. */
export const parseOpts = (raw: Raw, current: Opts): Opts => ({
  seatCount: parseSeatCount(raw.players ?? raw.localPlayers, current.seatCount),
});

/** Every seat's name in order for a table of `n` (the shell lists the host, then every guest seat). */
export const seatNames = (n: number, seats: ReadonlyArray<Player>): ReadonlyArray<string> =>
  Array.from({ length: n }, (_, i) => seats[i]?.name ?? `Player ${String(i + 1)}`);

export const UNO_SHELL: ShellGameData<Uno> = {
  id: 'uno',
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
    hostRoom: (hostName, _opts, seated, capacity) => hostRoomMsg(hostName, seated, capacity),
    waiting: waitingMsg,
    joined: (name, _names, remaining) => joinedText(name, remaining),
    seatLeft: seatLeftMsg,
    guestGone: seatGoneMsg,
    roomFull: TABLE_FULL_MSG,
    notEnough: notEnoughMsg,
  },
  seats: { min: MIN_SEATS, max: MAX_SEATS, fixed: true },
  opts: {
    initial: DEFAULT_OPTS,
    parse: parseOpts,
    ofGame: (game) => ({ seatCount: parseSeatCount(String(game.game.names.length), 2) }),
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
  cues: { initial: INITIAL_CUES },
  home: {
    read: (store) => ({
      opts: readOpts(store),
      extraNames: EXTRA_NAME_PREFS.map((pref) => {
        const name = pref.read(store);
        return name.ok ? name.value : null;
      }),
    }),
  },
  prefs: SHELL_STORE,
};
