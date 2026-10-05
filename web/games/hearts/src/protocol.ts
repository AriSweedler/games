// The Hearts wire codecs (docs/design/hearts.md §3): the frames a host and its guest exchange over
// the PeerJS data channel, web/shared/lib/protocol.ts's two-seat skeleton over this engine's
// decoders (the trust boundary, docs/ARCHITECTURE.md "Module boundaries"). The room carries one
// term after `hostName`, the seat count, always 2.
import { literal } from '../../../shared/lib/json.ts';
import {
  twoSeatProtocol,
  type ActionFrame as SharedActionFrame,
  type Frame as SharedFrame,
  type GuestFrame as SharedGuestFrame,
  type HostFrame as SharedHostFrame,
  type LobbyFrame as SharedLobbyFrame,
  type StateFrame as SharedStateFrame,
  type WelcomeFrame as SharedWelcomeFrame,
} from '../../../shared/lib/protocol.ts';
import { decodeAction, decodeView, type Action, type View } from './engine/view.ts';

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

/** The room after `hostName`: two seats, always. */
const room = { seatCount: literal(2) };
export type Room = Readonly<{ seatCount: 2 }>;

export type ActionFrame = SharedActionFrame<Action>;
export type GuestFrame = SharedGuestFrame<Action>;
export type WelcomeFrame = SharedWelcomeFrame<Room>;
export type LobbyFrame = SharedLobbyFrame<Room>;
export type StateFrame = SharedStateFrame<View>;
export type HostFrame = SharedHostFrame<View, Room>;
export type Frame = SharedFrame<Action, View, Room>;

/** The protocol whole: what the shell sends from (shellConfig.ts `frames`). */
export const PROTOCOL = twoSeatProtocol({ decodeAction, decodeView, room });

export const {
  decodeFrame,
  decodeGuestFrame,
  decodeHostFrame,
  join,
  action,
  full,
  toast,
  state,
  welcome,
  lobby,
} = PROTOCOL;

/** The name a join carries (the session reseats a same-named rejoin), null for an action. */
export const joinName = (frame: GuestFrame): string | null =>
  frame.t === 'join' ? frame.name : null;
