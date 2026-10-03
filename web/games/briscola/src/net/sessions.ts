// Briscola's sessions: the shared pair (web/shared/net/sessions.ts, docs/design/n-seat-sessions.md)
// bound to 'briscola', so the peer id is `briscola-<CODE>` (web/shared/lib/roomCode.ts, D19), with
// protocol.ts as the codec in its N-seat form: the welcome carries the six options (`Room`) in
// place of gin's `target` and, past two seats, the table as the host knows it (`seats`, read off the
// context the shell fills) and the seat the channel took; `joinName` hands the session the name a
// join carries so a guest back from a dead tab is reseated where that name last sat (D6). At two
// seats the welcome is PR-4's byte for byte (protocol.ts `seated`); sessions.test.ts pins both forms.
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

/** What the welcome reads off the host context beyond the shell's fields: the six options and the guest seats as the shell holds them (not read at two seats). */
export type HostRoom = Room & Readonly<{ seats: ReadonlyArray<TableSeat> }>;

/** The six options alone off the context (the shell's fields and `seats` sit beside them). */
const roomOf = (ctx: HostRoom): Room => ({
  seatCount: ctx.seatCount,
  gamesToWin: ctx.gamesToWin,
  removedTwo: ctx.removedTwo,
  exchange: ctx.exchange,
  scoperta: ctx.scoperta,
  partnerPeek: ctx.partnerPeek,
});

export const { Host: HostSession, Guest: GuestSession } = sessionsFor<
  GuestFrame,
  HostFrame,
  HostRoom
>('briscola', {
  decodeGuestFrame,
  decodeHostFrame,
  welcome: (ctx, seat) => welcome(ctx.myName, roomOf(ctx), ctx.seats, seat),
  full,
  join,
  joinName,
});
