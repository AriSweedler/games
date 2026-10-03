// The N-seat wire protocol (docs/design/n-seat-sessions.md D3, §7; docs/design/shell-hoist.md §3
// L): `twoSeatProtocol`'s seven frames with the table on the two room frames. After `hostName`
// and the game's options, `welcome` and `lobby` carry, past two seats, the table (`seats`: one row
// per guest seat 1..N-1 in order, its name once its join has been heard and whether its channel is
// up) and `you`, the receiving guest's own seat; at two seats the builders leave both out, so a
// two-seat room's frames are the pair's byte for byte (briscola's PR-4 corpus under
// test/fixtures/briscola-wire/ pins that shape, the one uno copied and flip7 now takes). Both are
// optional field decoders, so a frame that carries them is checked against its seat count after
// the fields (`seatingFault`): the wrong number of rows, or a seat beyond the table, is refused
// with the words a field decoder would use. The shell reads the seating off the frame itself
// (web/shared/ui/shell.ts `roomSeatingOf`); `seatingOf` here is the same reader typed to the game.
// `join` and `action` carry no seat: the host session knows a guest's seat by its channel (D1), and
// `joinName` hands it the name a join carries so a same-named rejoin is reseated (D6). Before this
// module the three N-seat games each spelled this (uno 123 lines, flip7 75, briscola 235), and
// flip7's copy skipped the fit check and put the seating on every frame: one shape now, one check.
import {
  arrayOf,
  boolean,
  integer,
  nullable,
  object,
  optional,
  string,
  type Decoder,
} from './json.ts';
import {
  twoSeatProtocol,
  type DecodeFailure,
  type EphemeralFrame,
  type GuestFrame,
  type LobbyFrame,
  type TwoSeatProtocol,
  type WelcomeFrame,
} from './protocol.ts';
import { err, type Result } from './result.ts';

/** A guest seat as the lobby lists it: its name once its join has been heard (null until then), and whether its channel is up. */
export type TableSeat = Readonly<{ name: string | null; connected: boolean }>;
const tableSeat: Decoder<TableSeat> = object({ name: nullable(string), connected: boolean });

/** The table a room frame carries past two seats: `seats` one row per guest seat 1..N-1, `you` the receiver's seat among them. */
export type Seating = Readonly<{ seats: ReadonlyArray<TableSeat>; you: number }>;
/** What `welcome` and `lobby` carry after `hostName`: the game's options `R`, and the seating past two seats. */
export type SeatedRoom<R> = R & Partial<Seating>;

/** The one option every seated room opens with: how many sit down, the host counted. */
export type SeatedOptions = Readonly<{ seatCount: number }>;
/** One decoder per option, in wire order (`seatCount` first): `object(fields)` spells `R` from it. */
export type OptionFields<R> = { readonly [K in keyof R]: Decoder<R[K]> };

/**
 * `twoSeatProtocol`'s members over the seated room, with the two room builders taking the options
 * and the table apart, and the two readers the N-seat session and the tests use.
 */
export type SeatedProtocol<
  A,
  V,
  R extends SeatedOptions,
  E extends EphemeralFrame = never,
> = Readonly<
  Omit<TwoSeatProtocol<A, V, SeatedRoom<R>, E>, 'welcome' | 'lobby'> & {
    /** The frame sent when a guest's channel opens: `seats` is the table as the host knows it then (the newcomer's own row is not yet named: its join follows). */
    welcome: (
      hostName: string,
      opts: R,
      seats: ReadonlyArray<TableSeat>,
      you: number,
    ) => WelcomeFrame<SeatedRoom<R>>;
    /** Repeated to every seated guest on every seating change while the host waits, each with its own `you`. */
    lobby: (
      hostName: string,
      opts: R,
      seats: ReadonlyArray<TableSeat>,
      you: number,
    ) => LobbyFrame<SeatedRoom<R>>;
    /** The table a welcome or lobby carries past two seats; null at two (the frame carries none). */
    seatingOf: (frame: WelcomeFrame<SeatedRoom<R>> | LobbyFrame<SeatedRoom<R>>) => Seating | null;
    /** The name a join carries (the session reseats a same-named rejoin, D6), null for any other guest frame. */
    joinName: (frame: GuestFrame<A> | E) => string | null;
  }
>;

/**
 * Why a decoded welcome or lobby's seating does not fit its seat count, worded as the field
 * decoders word a refusal, or null when it fits: a `seats` it carries has one row per guest seat
 * (N-1), a `you` it carries is one of them. A frame carrying neither fits at every count.
 */
export const seatingFault = (frame: SeatedRoom<SeatedOptions>): DecodeFailure | null => {
  const guests = frame.seatCount - 1;
  if (frame.seats !== undefined && frame.seats.length !== guests)
    return `$.seats: expected ${String(guests)} seat rows (seatCount - 1)`;
  if (frame.you !== undefined && frame.you > guests)
    return `$.you: expected integer in [1, ${String(guests)}]`;
  return null;
};

/** The two frames that carry a room, by tag: every decoded one has the game's `seatCount` beside the skeleton's `hostName`. */
const isRoomFrame = <F extends Readonly<{ t: string }>>(
  frame: F,
): frame is F & SeatedRoom<SeatedOptions> => frame.t === 'welcome' || frame.t === 'lobby';

/** The skeleton's verdict, then the seating check on the two room frames; every other frame passes as decoded. */
const fitted = <F extends Readonly<{ t: string }>>(
  decoded: Result<F, DecodeFailure>,
): Result<F, DecodeFailure> => {
  if (!decoded.ok) return decoded;
  const frame = decoded.value;
  const fault = isRoomFrame(frame) ? seatingFault(frame) : null;
  return fault === null ? decoded : err(fault);
};

/**
 * A game's N-seat protocol: its engine decoders guard `action` and `state`, its `options` (with
 * `seatCount` first) the two room frames, `seatCounts` bounds the seat a frame may name, and
 * `extra.ephemeral`, when given, the lane (as `twoSeatProtocol` takes it).
 */
export const seatedProtocol = <A, V, R extends SeatedOptions, E extends EphemeralFrame = never>(
  game: Readonly<{
    decodeAction: Decoder<A>;
    decodeView: Decoder<V>;
    options: OptionFields<R>;
    seatCounts: ReadonlyArray<number>;
  }>,
  extra?: Readonly<{ ephemeral: Decoder<E> }>,
): SeatedProtocol<A, V, R, E> => {
  const maxGuestSeat = Math.max(...game.seatCounts) - 1;
  const seating = {
    seats: optional(arrayOf(tableSeat)),
    you: optional(integer(1, maxGuestSeat)),
  };
  // The skeleton spells its room type from the field table; over a type parameter `R` that Shape
  // stays unresolved, so the protocol states the type the table already says (the cast
  // `twoSeatProtocol` makes for its two engine-typed frames, once, here).
  const protocol = twoSeatProtocol(
    {
      decodeAction: game.decodeAction,
      decodeView: game.decodeView,
      room: { ...game.options, ...seating },
    },
    extra,
  ) as unknown as TwoSeatProtocol<A, V, SeatedRoom<R>, E>;

  /** The room a welcome or lobby carries: the options alone at two seats, the table and the receiver's seat after them past two. */
  const seated = (opts: R, seats: ReadonlyArray<TableSeat>, you: number): SeatedRoom<R> =>
    opts.seatCount === 2 ? opts : { ...opts, seats, you };

  return {
    ...protocol,
    decodeFrame: (raw) => fitted(protocol.decodeFrame(raw)),
    decodeHostFrame: (raw) => fitted(protocol.decodeHostFrame(raw)),
    welcome: (hostName, opts, seats, you) => protocol.welcome(hostName, seated(opts, seats, you)),
    lobby: (hostName, opts, seats, you) => protocol.lobby(hostName, seated(opts, seats, you)),
    seatingOf: (frame) =>
      frame.seats !== undefined && frame.you !== undefined
        ? { seats: frame.seats, you: frame.you }
        : null,
    joinName: (frame) => (frame.t === 'join' ? frame.name : null),
  };
};
