// Hearts's sessions: the shared N-seat pair (web/shared/net/sessions.ts `seatedSessions`) bound to
// 'hearts', so the peer id is `hearts-<CODE>` (web/shared/lib/roomCode.ts), with protocol.ts as
// the codec. Two or three guest seats: the welcome carries the room's one term, the seat count.
import { seatedSessions } from '../../../../shared/net/sessions.ts';
import { PROTOCOL, type Room } from '../protocol.ts';

/** The pair the boot takes whole (`net: SESSIONS`). */
export const SESSIONS = seatedSessions('hearts', PROTOCOL, (from): Room => ({
  seatCount: from.seatCount,
}));
