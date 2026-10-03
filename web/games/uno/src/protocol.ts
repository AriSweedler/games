// The UNO wire codecs (docs/design/uno.md §9; docs/design/n-seat-sessions.md D3, §7): the seven
// frames a host and its guests exchange over the PeerJS data channel, web/shared/lib's seated
// protocol over this engine's decoders (the trust boundary, docs/ARCHITECTURE.md "Module
// boundaries"). The room `welcome` and `lobby` carry after `hostName` is the table's seat count
// and, past two seats, the table and the receiving guest's seat, as briscola's do (the shape
// web/shared/lib/seatedProtocol.ts spells once). A `state` frame carries one seat's view: its own
// hand and the others' counts, never another hand.
import { literal, type Shape } from '../../../shared/lib/json.ts';
import type {
  ActionFrame as SharedActionFrame,
  Frame as SharedFrame,
  GuestFrame as SharedGuestFrame,
  HostFrame as SharedHostFrame,
  LobbyFrame as SharedLobbyFrame,
  StateFrame as SharedStateFrame,
  WelcomeFrame as SharedWelcomeFrame,
} from '../../../shared/lib/protocol.ts';
import { seatedProtocol, type SeatedRoom } from '../../../shared/lib/seatedProtocol.ts';
import { SEAT_COUNTS, decodeAction, decodeView, type Action, type View } from './engine/view.ts';

export type { TableSeat } from '../../../shared/lib/seatedProtocol.ts';

/** The room after `hostName`: how many sit down. */
const options = { seatCount: literal(...SEAT_COUNTS) };
export type Room = Shape<typeof options>;
type RoomWire = SeatedRoom<Room>;

export type ActionFrame = SharedActionFrame<Action>;
export type GuestFrame = SharedGuestFrame<Action>;
export type WelcomeFrame = SharedWelcomeFrame<RoomWire>;
export type LobbyFrame = SharedLobbyFrame<RoomWire>;
export type StateFrame = SharedStateFrame<View>;
export type HostFrame = SharedHostFrame<View, RoomWire>;
export type Frame = SharedFrame<Action, View, RoomWire>;

/** The protocol whole: what the sessions take (web/shared/net/sessions.ts `seatedSessions`). */
export const PROTOCOL = seatedProtocol({
  decodeAction,
  decodeView,
  options,
  seatCounts: SEAT_COUNTS,
});
export const {
  decodeFrame,
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
