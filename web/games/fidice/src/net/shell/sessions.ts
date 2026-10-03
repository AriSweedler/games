// Fidice's sessions on the shell path (docs/design/fidice-shell-adoption.md §3 "Protocol and
// sessions", §4 M3): the shared pair (web/shared/net/sessions.ts, docs/design/n-seat-sessions.md)
// bound to 'fidice', so the peer id is `fidice-<code>` lower-cased (web/shared/lib/roomCode.ts),
// with protocol.ts as the codec in its N-seat form: the welcome carries the table's terms (`Room`:
// lives, seatCount, bots, botChoice, watch) and, past two seats, the table as the host knows it
// (`seats`, read off the context the shell fills) and the seat the channel took; `joinName` hands
// the session the name a join carries so a guest back from a dead tab is reseated where that name
// last sat (D6; plan §7 D5: no tokens). The guest runs the shared retry ladder (plan §7 D4) in
// place of the legacy client's one 12 s timeout. NOT in the session (n-seat-sessions.md D9; plan §7
// D5-D7): bots (a term of the room the reducer seats at the deal), spectators (Watch is a local
// mode), tokens, seat swaps, a mixed local/remote table. The legacy src/net/host.ts and client.ts
// (their own transport, tokens, spectators and the bot loop) stay on disk unimported until M6.
import { sessionsFor } from '../../../../../shared/net/sessions.ts';
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
} from '../../protocol.ts';

/** What the welcome reads off the host context beyond the shell's fields: the room's terms and the guest seats as the shell holds them (not read at two seats). */
export type HostRoom = Room & Readonly<{ seats: ReadonlyArray<TableSeat> }>;

/** The room's terms alone off the context (the shell's fields and `seats` sit beside them). */
const roomOf = (ctx: HostRoom): Room => ({
  lives: ctx.lives,
  seatCount: ctx.seatCount,
  bots: ctx.bots,
  botChoice: ctx.botChoice,
  watch: ctx.watch,
});

export const { Host: HostSession, Guest: GuestSession } = sessionsFor<
  GuestFrame,
  HostFrame,
  HostRoom
>('fidice', {
  decodeGuestFrame,
  decodeHostFrame,
  welcome: (ctx, seat) => welcome(ctx.myName, roomOf(ctx), ctx.seats, seat),
  full,
  join,
  joinName,
});
