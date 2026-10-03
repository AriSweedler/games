// Sheshbesh's sessions: the shared two-seat pair (web/shared/net/sessions.ts) bound to
// 'backgammon', so the peer id is `sheshbesh-<CODE>` and the welcome carries `matchLength` and
// `variant` in place of gin's `target` (docs/design/backgammon-board.md §5.2; sessions.test.ts pins
// both), with protocol.ts as the codec.
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
  'backgammon',
  {
    decodeGuestFrame,
    decodeHostFrame,
    welcome: (ctx) => welcome(ctx.myName, { matchLength: ctx.matchLength, variant: ctx.variant }),
    full,
    join,
  },
);
