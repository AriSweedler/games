// The fidice wire codecs on the shell path (docs/design/fidice-shell-adoption.md §3 "Protocol and
// sessions", §4 M3; docs/design/n-seat-sessions.md D3, §7): the seven frames a host and its guests
// exchange over the PeerJS data channel, web/shared/lib/seatedProtocol.ts's seated form over this
// game's decoders (codec.ts: the legacy `decodeAction` imported, `decodeView` spelled there),
// briscola's protocol.ts shape for shape (until dry-review-2026-10.md §7 row 15 this file spelled
// the seating and its fit check itself). What the room `welcome` and `lobby` carry after
// `hostName` is the table's terms (`Opts`, shellConfig.ts, in the host save's order: `lives`,
// `seatCount`, `bots`, `botChoice`, `watch`), since a guest must know how many chairs the host
// opened, how many computers sit down with it and whether it plays or watches (plan §7 D6, D7,
// D10). Past two seats the same two frames go on to carry the table (`seats`: one row per guest
// seat 1..N-1, its name once it has joined and whether its channel is up) and `you`, the receiving
// guest's own seat; both optional on the wire, left off by the builders at two seats, checked
// against the seat count after the field decoders (`seatingFault`) and read by the shell through
// `seatingOf`. The legacy wire (src/net/protocol.ts `hello`/`act`/`state`/`error`/`info`, its
// tokens, its spectator role) is not spoken here: D5 rejoins by name, D6 keeps no spectator
// online. The N-seat wire pins are the skeleton's (`NAME_MAX` 20, `TOAST_MAX` 500,
// `DEFAULT_GUEST_NAME` 'Guest', the `{t, hostName, ...room}` key order; plan §7 D1) and the
// goldens under test/fixtures/fidice-wire/ (2p-*, 6p-*) are recorded by protocol.test.ts as
// briscola's are. A wire-visible change adds a version field to the skeleton.
import { boolean, integer, literal, string, type Shape } from '../../../shared/lib/json.ts';
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
import { decodeAction, decodeView } from './codec.ts';
import type { Action, PublicState } from './domain/types.ts';

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
export { seatingFault, type TableSeat } from '../../../shared/lib/seatedProtocol.ts';

/** The chairs a room may open, the host's included (domain/types.ts `MAX_SEATS` 6; plan §7 D10). */
export const SEAT_COUNTS = [2, 3, 4, 5, 6] as const;
export type SeatCount = (typeof SEAT_COUNTS)[number];
/** At most five computers: one chair is the host's, or a human's when the host watches. */
export const MAX_BOTS = 5;

/**
 * The room after `hostName`: the table's terms in the host save's order (storage.ts `HostExtra`):
 * the kayaks each (0 keeps score), the chairs, the computers and their strategy choice (a
 * bots/registry.ts id or `random`), and whether the host watches instead of taking a chair.
 */
const options = {
  lives: integer(0),
  seatCount: literal(...SEAT_COUNTS),
  bots: integer(0, MAX_BOTS),
  botChoice: string,
  watch: boolean,
};
/** Structurally shellConfig.ts's `Opts`. */
export type Room = Shape<typeof options>;
/** What `welcome` and `lobby` carry after `hostName`: the options, and the seating past two seats. */
type RoomWire = SeatedRoom<Room>;

export type ActionFrame = SharedActionFrame<Action>;
/** What a host hears: the two guest frames. */
export type GuestFrame = SharedGuestFrame<Action>;
export type WelcomeFrame = SharedWelcomeFrame<RoomWire>;
export type LobbyFrame = SharedLobbyFrame<RoomWire>;
/** `viewFor(game, seat)`: one guest seat's redaction, after every applied action and on (re)connect. */
export type StateFrame = SharedStateFrame<PublicState>;
/** What a guest hears: the five host frames. */
export type HostFrame = SharedHostFrame<PublicState, RoomWire>;
export type Frame = SharedFrame<Action, PublicState, RoomWire>;

/** The protocol whole: what the sessions take (net/shell/sessions.ts) and the shell config's `frames`. */
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
  seatingOf,
  joinName,
} = PROTOCOL;
