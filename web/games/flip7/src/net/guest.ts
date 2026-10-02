// Flip 7's guest session: the shared session (web/shared/net/guest.ts) with this game's
// protocol.ts as its codec and 'flip7' as the table's game, so it connects to `flip7-<CODE>`.
import {
  GuestSession as SharedGuestSession,
  type GuestCodec,
  type GuestDeps as SharedGuestDeps,
  type GuestOptions as SharedGuestOptions,
} from '../../../../shared/net/guest.ts';
import { decodeHostFrame, join, type GuestFrame, type HostFrame } from '../protocol.ts';

export type GuestDeps = SharedGuestDeps<HostFrame>;
export type GuestOptions = Omit<SharedGuestOptions, 'game'>;

const codec: GuestCodec<GuestFrame, HostFrame> = { decode: decodeHostFrame, join };

export class GuestSession extends SharedGuestSession<GuestFrame, HostFrame> {
  constructor(deps: GuestDeps, opts: GuestOptions) {
    super(deps, codec, { ...opts, game: 'flip7' });
  }
}
