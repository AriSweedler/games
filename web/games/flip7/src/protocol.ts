// Flip 7's wire (docs/design/flip7.md §8): web/shared/lib's seated protocol over this game's view
// and action decoders, the room's one term (`seatCount`) and, past two seats, the table as the
// host holds it and the receiver's seat, which the shell reads off the frame (shell.ts
// `roomSeatingOf`). Until docs/design/shell-hoist.md §3 L this file put the seating on every frame
// and skipped the fit check the other N-seat games carry; it now speaks the one shared shape: at
// two seats the seat count alone, and a seating that does not fit its seat count is refused.
import { literal, type Shape } from '../../../shared/lib/json.ts';
import type {
  GuestFrame as SharedGuestFrame,
  HostFrame as SharedHostFrame,
  LobbyFrame as SharedLobbyFrame,
  WelcomeFrame as SharedWelcomeFrame,
} from '../../../shared/lib/protocol.ts';
import { seatedProtocol, type SeatedRoom } from '../../../shared/lib/seatedProtocol.ts';
import { SEAT_COUNTS, decodeAction, decodeView, type Action, type View } from './engine/index.ts';

export { isGuestFrame } from '../../../shared/lib/protocol.ts';
export type { TableSeat } from '../../../shared/lib/seatedProtocol.ts';

/** The room's terms: the seat count alone. */
const options = { seatCount: literal(...SEAT_COUNTS) };
export type Room = Shape<typeof options>;
type RoomWire = SeatedRoom<Room>;

export type GuestFrame = SharedGuestFrame<Action>;
export type HostFrame = SharedHostFrame<View, RoomWire>;
export type WelcomeFrame = SharedWelcomeFrame<RoomWire>;
export type LobbyFrame = SharedLobbyFrame<RoomWire>;

export const {
  decodeGuestFrame,
  decodeHostFrame,
  join,
  action,
  welcome,
  lobby,
  full,
  toast,
  state,
  joinName,
} = seatedProtocol({ decodeAction, decodeView, options, seatCounts: SEAT_COUNTS });
