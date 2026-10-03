// The waiting-room copy every game with a table past two seats paints
// (docs/design/n-seat-sessions.md §7; docs/design/shell-hoist.md §4 B, where uno, flip7 and
// briscola each carried this byte for byte): at a table of two every form is the shell's two-seat
// string, so the two-seat pins and specs read what they read; past two, the count rides along. The
// one word a game chooses is its verb (a card game deals, a board game starts). The session's
// two-seat `waiting` line is web/shared/net's (host.ts WAITING_MSG), which this zone may not
// import, so the game hands it over as it hands the shell `opening`.
import {
  OPPONENT_LEFT_MSG,
  WAITING_FOR_GUEST_MSG,
  guestGoneMsg,
  joinedMsg,
  type ShellConfig,
  type ShellTypes,
} from './shell.ts';

/** What the table waits on the host to do: "waiting for Ann to deal". */
export type SeatedVerb = 'deal' | 'start' | 'roll';

/** The N-seat forms of `ShellConfig['copy']`, each present (a game spreads them, then overrides its own). */
export type SeatedCopy = Required<
  Pick<
    ShellConfig<ShellTypes>['copy'],
    'hostRoom' | 'waiting' | 'joined' | 'seatLeft' | 'guestGone' | 'roomFull' | 'notEnough'
  >
>;

/** "Seat 3": a seat nobody has named yet, numbered as the waiting room lists it (the host is Seat 1). */
export const emptySeatName = (seat: number): string => `Seat ${String(seat + 1)}`;

/** A spare peer at a full table; the `full` frame carries no count, so the line names none. */
export const TABLE_FULL_MSG = 'That table is full.';

/**
 * `#guestWaitStatus` once the host's welcome or lobby frame names the room; past two seats the
 * count rides in front. A two-seat game takes this alone (it has no table to count).
 */
export const hostRoomMsg =
  (verb: SeatedVerb): SeatedCopy['hostRoom'] =>
  (hostName, _opts, seated, capacity) =>
    capacity === 2
      ? `Connected — waiting for ${hostName} to ${verb}`
      : `Connected — ${String(seated)} of ${String(capacity)} seated · waiting for ${hostName} to ${verb}`;

/**
 * The seven N-seat forms: the host's open status (`waitingAtTwo` at two, the session's line), a
 * join (the shell's line once the table is full, else how many are still to come), a seat that
 * left the lobby (the shell's line at two; past two, who left and the count), a seat's channel
 * down mid-game (the shell's toast, the seat named or numbered), the full table, and Start below
 * a short table (the shell's line at two seats, else the count).
 */
export const seatedCopy = (
  o: Readonly<{ verb: SeatedVerb; waitingAtTwo: string }>,
): SeatedCopy => ({
  hostRoom: hostRoomMsg(o.verb),
  waiting: (capacity) =>
    capacity === 2 ? o.waitingAtTwo : `Waiting for ${String(capacity - 1)} players to join`,
  joined: (name, _names, remaining) =>
    remaining === 0 ? joinedMsg(name) : `${name} joined! Waiting for ${String(remaining)} more.`,
  seatLeft: (name, seat, seated, capacity) =>
    capacity === 2
      ? OPPONENT_LEFT_MSG
      : `${name ?? emptySeatName(seat)} left. ${String(seated)} of ${String(capacity)} seated.`,
  guestGone: (name, code, seat) => guestGoneMsg(name ?? emptySeatName(seat), code),
  roomFull: TABLE_FULL_MSG,
  notEnough: (seated, min) =>
    min === 2
      ? WAITING_FOR_GUEST_MSG
      : `${String(seated)} of ${String(min)} seated — waiting for ${String(min - seated)} more.`,
});

/** A seat count off a stepper's raw value (`"3"`): one of the game's `counts`, else `fallback`. */
export const parseSeatCount = <N extends number>(
  counts: ReadonlyArray<N>,
  raw: string | undefined,
  fallback: N,
): N => counts.find((n) => String(n) === raw) ?? fallback;
