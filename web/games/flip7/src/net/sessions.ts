// Flip 7's sessions: the shared pair (web/shared/net/sessions.ts) bound to 'flip7', so the peer id
// is `flip7-<CODE>` (web/shared/lib/roomCode.ts), with protocol.ts as the codec. The welcome
// carries the seat count, the table as the host knows it and the seat the channel took; `joinName`
// reseats a guest back from a dead tab where its name last sat.
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

/** What the welcome reads off the host context beyond the shell's fields: the seat count and the guest seats as the shell holds them. */
export type HostRoom = Room & Readonly<{ seats: ReadonlyArray<TableSeat> }>;

export const { Host: HostSession, Guest: GuestSession } = sessionsFor<
  GuestFrame,
  HostFrame,
  HostRoom
>('flip7', {
  decodeGuestFrame,
  decodeHostFrame,
  welcome: (ctx, seat) => welcome(ctx.myName, { seatCount: ctx.seatCount }, ctx.seats, seat),
  full,
  join,
  joinName,
});
