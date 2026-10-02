// The UNO wire codecs (docs/design/uno.md §9; docs/design/n-seat-sessions.md D3, §7): the seven
// frames a host and its guests exchange over the PeerJS data channel, web/shared/lib/protocol.ts's
// skeleton over this engine's decoders (the trust boundary, docs/ARCHITECTURE.md "Module
// boundaries"). The room `welcome` and `lobby` carry after `hostName` the table's seat count and,
// past two seats, the table (`seats`: one row per guest seat 1..N-1, its name once it has joined
// and whether its channel is up) and `you`, the receiving guest's own seat, as briscola's do
// (web/games/briscola/src/protocol.ts); at two seats the builders leave both out. `join` and
// `action` carry no seat: the host session knows a guest's seat by its channel (D1). A `state`
// frame carries one seat's view: its own hand and the others' counts, never another hand.
import {
  arrayOf,
  boolean,
  integer,
  literal,
  nullable,
  object,
  optional,
  string,
  type Decoded,
  type Shape,
} from '../../../shared/lib/json.ts';
import {
  twoSeatProtocol,
  type ActionFrame as SharedActionFrame,
  type DecodeFailure,
  type Frame as SharedFrame,
  type GuestFrame as SharedGuestFrame,
  type HostFrame as SharedHostFrame,
  type LobbyFrame as SharedLobbyFrame,
  type StateFrame as SharedStateFrame,
  type WelcomeFrame as SharedWelcomeFrame,
} from '../../../shared/lib/protocol.ts';
import { err, type Result } from '../../../shared/lib/result.ts';
import { SEAT_COUNTS, decodeAction, decodeView, type Action, type View } from './engine/view.ts';

export {
  DEFAULT_GUEST_NAME,
  NAME_MAX,
  TOAST_MAX,
  WIRE_TAGS,
  guestNameFor,
  isGuestFrame,
  type DecodeFailure,
  type FullFrame,
  type JoinFrame,
  type ToastFrame,
  type WireTag,
} from '../../../shared/lib/protocol.ts';

/** The room after `hostName`: how many sit down. */
const options = { seatCount: literal(...SEAT_COUNTS) };
export type Room = Shape<typeof options>;

/** A guest seat as the lobby lists it: its name once its join has been heard, and whether its channel is up. */
const tableSeat = object({ name: nullable(string), connected: boolean });
export type TableSeat = Decoded<typeof tableSeat>;
const MAX_GUEST_SEAT = Math.max(...SEAT_COUNTS) - 1;
const seating = {
  seats: optional(arrayOf(tableSeat)),
  you: optional(integer(1, MAX_GUEST_SEAT)),
};
const room = { ...options, ...seating };
type RoomWire = Shape<typeof room>;

export type ActionFrame = SharedActionFrame<Action>;
export type GuestFrame = SharedGuestFrame<Action>;
export type WelcomeFrame = SharedWelcomeFrame<RoomWire>;
export type LobbyFrame = SharedLobbyFrame<RoomWire>;
export type StateFrame = SharedStateFrame<View>;
export type HostFrame = SharedHostFrame<View, RoomWire>;
export type Frame = SharedFrame<Action, View, RoomWire>;

const protocol = twoSeatProtocol({ decodeAction, decodeView, room });

export const { decodeGuestFrame, join, action, full, toast, state } = protocol;

/** Why a welcome or lobby's seating does not fit its seat count, or null when it fits. */
const seatingFault = (frame: WelcomeFrame | LobbyFrame): DecodeFailure | null => {
  const guests = frame.seatCount - 1;
  if (frame.seats !== undefined && frame.seats.length !== guests)
    return `$.seats: expected ${String(guests)} seat rows (seatCount - 1)`;
  if (frame.you !== undefined && frame.you > guests)
    return `$.you: expected integer in [1, ${String(guests)}]`;
  return null;
};

const fitted = <F extends Frame>(decoded: Result<F, DecodeFailure>): Result<F, DecodeFailure> => {
  if (!decoded.ok) return decoded;
  const frame = decoded.value;
  const fault = frame.t === 'welcome' || frame.t === 'lobby' ? seatingFault(frame) : null;
  return fault === null ? decoded : err(fault);
};

/** Any of the seven frames; a welcome or lobby must also seat its table. */
export const decodeFrame = (raw: unknown): Result<Frame, DecodeFailure> =>
  fitted(protocol.decodeFrame(raw));
/** What a guest accepts from its host, the seating checked. */
export const decodeHostFrame = (raw: unknown): Result<HostFrame, DecodeFailure> =>
  fitted(protocol.decodeHostFrame(raw));

/** The room a welcome or lobby carries: the seat count alone at two seats, the table and the receiver's seat after it past two. */
const seated = (opts: Room, seats: ReadonlyArray<TableSeat>, you: number): RoomWire =>
  opts.seatCount === 2 ? opts : { ...opts, seats, you };

/** The frame sent when a guest's channel opens (net/host.ts's codec). */
export const welcome = (
  myName: string,
  opts: Room,
  seats: ReadonlyArray<TableSeat>,
  you: number,
): WelcomeFrame => protocol.welcome(myName, seated(opts, seats, you));

/** Repeated to every seated guest on every seating change while the host waits, each with its own `you`. */
export const lobby = (
  myName: string,
  opts: Room,
  seats: ReadonlyArray<TableSeat>,
  you: number,
): LobbyFrame => protocol.lobby(myName, seated(opts, seats, you));

/** The name a join carries (the session reseats a same-named rejoin, D6), null for an action. */
export const joinName = (frame: GuestFrame): string | null =>
  frame.t === 'join' ? frame.name : null;
