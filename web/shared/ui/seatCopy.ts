// The waiting-room copy every game with a table past two seats paints
// (docs/design/n-seat-sessions.md §7; docs/design/shell-hoist.md §4 B, where uno, flip7 and
// briscola each carried this byte for byte): at a table of two every form is the shell's two-seat
// string, so the two-seat pins and specs read what they read; past two, the count rides along. The
// one word a game chooses is its verb (a card game deals, a board game starts). The session's
// two-seat `waiting` line is web/shared/lib/shellDefaults.ts's WAITING_MSG (web/shared/net speaks
// it too); a game with a line of its own hands it over (`waitingAtTwo`). The two leave confirms
// (dry-review-2026-10.md §2.3) are spelled here too, from the three nouns a game chooses
// (`leaveCopy`), so no config carries a sentence the shell could have written.
import { WAITING_MSG } from '../lib/shellDefaults.ts';
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

/** The N-seat forms of `ShellConfig['copy']` and the two leave confirms, each present (a game spreads them, then overrides its own). */
export type SeatedCopy = Required<
  Pick<
    ShellConfig<ShellTypes>['copy'],
    | 'leaveLocal'
    | 'leaveOnline'
    | 'hostRoom'
    | 'waiting'
    | 'joined'
    | 'seatLeft'
    | 'guestGone'
    | 'roomFull'
    | 'notEnough'
  >
>;

/**
 * The three nouns the leave confirms turn on: what the player ends (a game, or backgammon's
 * match), what a pass-and-play leave clears (the score; hive's board; gin says "Scores") and what
 * an online leave closes (the table; gin's and backgammon's room). Each defaults to the card
 * games' word, so a game spells only the noun that differs.
 */
export type LeaveNouns = Readonly<{
  ends?: 'game' | 'match';
  cleared?: 'The score' | 'The board' | 'Scores';
  closes?: 'table' | 'room';
}>;

/** `ShellConfig['copy']`'s `leaveLocal` and `leaveOnline`: "End this game? The score will be cleared." / "Leave this game? The table will close." at the defaults. */
export const leaveCopy = (
  nouns: LeaveNouns = {},
): Pick<SeatedCopy, 'leaveLocal' | 'leaveOnline'> => ({
  leaveLocal: `End this ${nouns.ends ?? 'game'}? ${nouns.cleared ?? 'The score'} will be cleared.`,
  leaveOnline: `Leave this ${nouns.ends ?? 'game'}? The ${nouns.closes ?? 'table'} will close.`,
});

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
 * The two leave confirms (`leaveCopy` over `leave`) and the seven N-seat forms: the host's open
 * status (at two the session's line, or the game's `waitingAtTwo`), a join (the shell's line once
 * the table is full, else how many are still to come), a seat that left the lobby (the shell's
 * line at two; past two, who left and the count), a seat's channel down mid-game (the shell's
 * toast, the seat named or numbered), the full table, and Start below a short table (the shell's
 * line at two seats, else the count).
 */
export const seatedCopy = (
  o: Readonly<{ verb: SeatedVerb; waitingAtTwo?: string; leave?: LeaveNouns }>,
): SeatedCopy => ({
  ...leaveCopy(o.leave),
  hostRoom: hostRoomMsg(o.verb),
  waiting: (capacity) =>
    capacity === 2
      ? (o.waitingAtTwo ?? WAITING_MSG)
      : `Waiting for ${String(capacity - 1)} players to join`,
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
