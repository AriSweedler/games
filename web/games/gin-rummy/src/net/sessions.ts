// Gin's sessions: the shared two-seat pair (web/shared/net/sessions.ts; gin's own sessions moved
// to web/shared/net by docs/design/shared-shell.md A1) bound to 'gin-rummy', so the peer id stays
// `ginrummy-ari-<CODE>` and the welcome `{t, hostName, target}` byte for byte
// (test/parity/gin.sessions.test.ts), with protocol.ts as the codec.
import { sessionsFor } from '../../../../shared/net/sessions.ts';
import {
  decodeGuestFrame,
  decodeHostFrame,
  full,
  join,
  welcome,
  type GuestFrame,
  type HostFrame,
  type Room,
} from '../protocol.ts';

export const { Host: HostSession, Guest: GuestSession } = sessionsFor<GuestFrame, HostFrame, Room>(
  'gin-rummy',
  {
    decodeGuestFrame,
    decodeHostFrame,
    welcome: (ctx) => welcome(ctx.myName, { target: ctx.target }),
    full,
    join,
  },
);
