// Hive's sessions: the shared pair (web/shared/net/sessions.ts) bound to 'hive', so the peer id is
// `hive-<CODE>` (web/shared/lib/roomCode.ts), with protocol.ts as the codec. One guest seat: the
// welcome carries the room's one term, two seats.
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
} from '../protocol.ts';

/** The pair the boot takes whole (`net: SESSIONS`). */
export const SESSIONS = sessionsFor<GuestFrame, HostFrame, Room>('hive', {
  decodeGuestFrame,
  decodeHostFrame,
  welcome: (ctx) => welcome(ctx.myName, { seatCount: 2 }),
  full,
  join,
  joinName,
});
