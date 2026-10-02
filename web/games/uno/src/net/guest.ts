// UNO's guest session: the shared session (web/shared/net/guest.ts) with protocol.ts as its codec
// and 'uno' as the table's game, so it connects to `uno-<CODE>` (web/shared/lib/roomCode.ts).
import {
  GuestSession as SharedGuestSession,
  type GuestCodec,
  type GuestDeps as SharedGuestDeps,
  type GuestOptions as SharedGuestOptions,
} from '../../../../shared/net/guest.ts';
import { decodeHostFrame, join, type GuestFrame, type HostFrame } from '../protocol.ts';

export { connectingMsg } from '../../../../shared/net/guest.ts';

export type GuestDeps = SharedGuestDeps<HostFrame>;
export type GuestOptions = Omit<SharedGuestOptions, 'game'>;

const codec: GuestCodec<GuestFrame, HostFrame> = { decode: decodeHostFrame, join };

export class GuestSession extends SharedGuestSession<GuestFrame, HostFrame> {
  constructor(deps: GuestDeps, opts: GuestOptions) {
    super(deps, codec, { ...opts, game: 'uno' });
  }
}
