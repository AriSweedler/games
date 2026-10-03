// The half of Flip 7's shell config the game spells from its engine, protocol and storage alone
// (docs/design/flip7.md §8; docs/design/shared-shell.md §4.3): the id the room codes are made for,
// the default names, the tabs, the two stored modes, the copy the shared flows paint (briscola's
// N-seat forms: the two-seat string at a table of two), the option codec (the room's one term, the
// seat count), the engine adapters (engine/index.ts: every action is checked against the seat that
// sent it), the frame builders, the finished game's record and the shell's store. Two to twelve at a
// table online and on one phone (the owner, 2026-10-02: "flip7 caps out at 12"); a room starts
// when every seat is taken (`fixed`), so the host deals to the table it opened. ui/state.ts
// completes the record with the table hooks.
import {
  OPPONENT_LEFT_MSG,
  WAITING_FOR_GUEST_MSG,
  guestGoneMsg,
  joinedMsg,
  type Player,
  type ShellGameData,
  INITIAL_CUE_MEMORY,
} from '../../../shared/ui/shell.ts';
import { connectingMsg } from '../../../shared/net/guest.ts';
import { OPENING_MSG, WAITING_MSG, handoffMsg } from '../../../shared/net/host.ts';
import {
  MAX_SEATS,
  MIN_SEATS,
  SEAT_COUNTS,
  applyAction,
  createGame,
  decodeState,
  nameOf,
  viewFor,
  type SeatCount,
} from './engine/index.ts';
import { action, join, lobby, state, toast } from './protocol.ts';
import {
  DEFAULT_HOME_TAB,
  DEFAULT_OPTS,
  EXTRA_NAME_PREFS,
  EXTRA_SEATS,
  DEFAULT_PLAY_MODE,
  HOME_TABS,
  SHELL_STORE,
  readOpts,
  type ExtraSeat,
  type Opts,
  type PlayMode,
} from './storage.ts';
import { CUES } from './ui/sound.ts';
import type { Flip7, FlipSeat, Raw } from './ui/state.ts';

export const DEFAULT_NAME = 'Ari';
/** The pass-and-play seats when nothing is remembered or typed; a seat past the list is `Player N`. */
export const LOCAL_NAMES: ReadonlyArray<string> = [
  'Ari',
  'Lavi',
  'Sandro',
  'Grant',
  'Noa',
  'Ethan',
];
export const LEAVE_LOCAL_MSG = 'End this game? The score will be cleared.';
export const LEAVE_ONLINE_MSG = 'Leave this game? The table will close.';

/** "Seat 3": a seat nobody has named yet (the host is Seat 1). */
export const emptySeatName = (seat: number): string => `Seat ${String(seat + 1)}`;
/** `#guestWaitStatus` once the host's welcome or lobby names the room; past two seats the count rides in front. */
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

/** A seat count from the stepper's raw value (`"3"`), else `fallback`. */
export const parseSeatCount = (raw: string | undefined, fallback: SeatCount): SeatCount =>
  SEAT_COUNTS.find((n) => String(n) === raw) ?? fallback;

/** The room's terms off the raw inputs: the Online select or its pass-and-play twin, whichever the click carried. */
export const parseOpts = (raw: Raw, current: Opts): Opts => ({
  seatCount: parseSeatCount(raw.players ?? raw.localPlayers, current.seatCount),
});

/** The names the engine deals to: the shell's seats in order, a missing one `Player N`. */
export const seatNames = (n: number, seats: ReadonlyArray<Player>): ReadonlyArray<string> =>
  Array.from({ length: n }, (_, i) => seats[i]?.name ?? `Player ${String(i + 1)}`);

/** The engine's seat index as the shell's seat type (0 to 5: the table's range). */
export const asSeat = (seat: number): FlipSeat => seat as FlipSeat;

export const FLIP7_SHELL: ShellGameData<Flip7> = {
  id: 'flip7',
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
    ofGame: (game) => ({ seatCount: parseSeatCount(String(game.seats.length), 2) }),
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
    keyOf: (view) => String(view.startedAt),
    playersOf: (view) => view.seats.map((s) => s.name),
    scoreOf: (view) => view.scores.map(String).join('–'),
    winnerOf: (view) => (view.phase.kind === 'gameOver' ? asSeat(view.phase.winner) : null),
  },
  frames: { lobby, state, toast, action, join },
  cues: { initial: INITIAL_CUE_MEMORY, table: CUES },
  home: {
    read: (store) => ({
      opts: readOpts(store),
      extraNames: Object.fromEntries(
        EXTRA_SEATS.map((seat) => {
          const name = EXTRA_NAME_PREFS[seat].read(store);
          return [seat, name.ok ? name.value : null];
        }),
      ) as Record<ExtraSeat, string | null>,
    }),
  },
  prefs: SHELL_STORE,
};
