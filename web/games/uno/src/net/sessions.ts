// UNO's sessions: the shared pair (web/shared/net/sessions.ts) bound to 'uno', so the peer id is
// `uno-<CODE>` (web/shared/lib/roomCode.ts), with protocol.ts as the codec. The welcome carries
// the seat count and, past two seats, the table as the host knows it and the seat the channel took.
import { sessionsFor } from '../../../../shared/net/sessions.ts';
import {
  decodeGuestFrame,
  decodeHostFrame,
  full,
  join,
  joinName,
  welcome,
  type GuestFrame,
  type HostFrame,
  type Room,
  type TableSeat,
} from '../protocol.ts';

/** What the welcome reads off the host context beyond the shell's fields: the seat count and the guest seats. */
export type HostRoom = Room & Readonly<{ seats: ReadonlyArray<TableSeat> }>;

export const { Host: HostSession, Guest: GuestSession } = sessionsFor<
  GuestFrame,
  HostFrame,
  HostRoom
>('uno', {
  decodeGuestFrame,
  decodeHostFrame,
  welcome: (ctx, seat) => welcome(ctx.myName, { seatCount: ctx.seatCount }, ctx.seats, seat),
  full,
  join,
  joinName,
});
