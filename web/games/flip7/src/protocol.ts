// Flip 7's wire (docs/design/flip7.md §8; web/shared/lib/protocol.ts): the shared seven frames over
// this game's view and action decoders, the room's one term (`seatCount`) and, on every welcome and
// lobby, the table as the host holds it (`seats`, one row per guest seat) and the receiver's seat
// (`you`), which the shell reads off the frame (shell.ts `roomSeatingOf`). Flip 7 has no two-seat
// corpus to keep, so the seating rides at every table size.
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
  type GuestFrame as SharedGuestFrame,
  type HostFrame as SharedHostFrame,
  type LobbyFrame as SharedLobbyFrame,
  type WelcomeFrame as SharedWelcomeFrame,
} from '../../../shared/lib/protocol.ts';
import {
  MAX_SEAT,
  SEAT_COUNTS,
  decodeAction,
  decodeView,
  type Action,
  type View,
} from './engine/index.ts';

export { isGuestFrame } from '../../../shared/lib/protocol.ts';

const tableSeat = object({ name: nullable(string), connected: boolean });
export type TableSeat = Decoded<typeof tableSeat>;

// The seating is optional in the type (the shell's frames type the room as its options alone) and
// always sent: `welcome` and `lobby` below put it on every frame.
const room = {
  seatCount: literal(...SEAT_COUNTS),
  seats: optional(arrayOf(tableSeat)),
  you: optional(integer(1, MAX_SEAT)),
};
type RoomWire = Shape<typeof room>;
/** The room's terms: the seat count alone. */
export type Room = Pick<RoomWire, 'seatCount'>;

export type GuestFrame = SharedGuestFrame<Action>;
export type HostFrame = SharedHostFrame<View, RoomWire>;
export type WelcomeFrame = SharedWelcomeFrame<RoomWire>;
export type LobbyFrame = SharedLobbyFrame<RoomWire>;

const protocol = twoSeatProtocol({ decodeAction, decodeView, room });

export const { decodeGuestFrame, decodeHostFrame, join, action, full, toast, state } = protocol;

export const welcome = (
  hostName: string,
  opts: Room,
  seats: ReadonlyArray<TableSeat>,
  you: number,
): WelcomeFrame => protocol.welcome(hostName, { seatCount: opts.seatCount, seats, you });

export const lobby = (
  hostName: string,
  opts: Room,
  seats: ReadonlyArray<TableSeat>,
  you: number,
): LobbyFrame => protocol.lobby(hostName, { seatCount: opts.seatCount, seats, you });

/** The name a join carries, so a guest back from a dead tab is reseated where it last sat. */
export const joinName = (frame: GuestFrame): string | null =>
  frame.t === 'join' ? frame.name : null;
