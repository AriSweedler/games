// The Hearts wire codecs (docs/design/hearts.md §7): the frames a host and its guests exchange over
// the PeerJS data channels, web/shared/lib/seatedProtocol.ts's N-seat skeleton over this engine's
// decoders (the trust boundary, docs/ARCHITECTURE.md "Module boundaries"). The room carries one
// term after `hostName`, the seat count, three or four.
import { literal, type Shape } from '../../../shared/lib/json.ts';
import type {
  GuestFrame as SharedGuestFrame,
  HostFrame as SharedHostFrame,
  LobbyFrame as SharedLobbyFrame,
  WelcomeFrame as SharedWelcomeFrame,
} from '../../../shared/lib/protocol.ts';
import { seatedProtocol, type SeatedRoom } from '../../../shared/lib/seatedProtocol.ts';
import { SEAT_COUNTS, decodeAction, decodeView, type Action, type View } from './engine/view.ts';

export type { TableSeat } from '../../../shared/lib/seatedProtocol.ts';

/** The room's terms: the seat count alone. */
const options = { seatCount: literal(...SEAT_COUNTS) };
export type Room = Shape<typeof options>;
type RoomWire = SeatedRoom<Room>;

export type GuestFrame = SharedGuestFrame<Action>;
export type HostFrame = SharedHostFrame<View, RoomWire>;
export type WelcomeFrame = SharedWelcomeFrame<RoomWire>;
export type LobbyFrame = SharedLobbyFrame<RoomWire>;

/** The protocol whole: what the sessions take (web/shared/net/sessions.ts `seatedSessions`). */
export const PROTOCOL = seatedProtocol({
  decodeAction,
  decodeView,
  options,
  seatCounts: SEAT_COUNTS,
});
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
} = PROTOCOL;
