// Hive's host session: the shared session (web/shared/net/host.ts) with protocol.ts as its codec
// and 'hive' as the table's game, so the peer id is `hive-<CODE>` (web/shared/lib/roomCode.ts).
// One guest seat: the welcome carries the room's one term, two seats.
import {
  HostSession as SharedHostSession,
  type HostCodec,
  type HostContext as SharedHostContext,
  type HostDeps as SharedHostDeps,
  type HostOptions as SharedHostOptions,
} from '../../../../shared/net/host.ts';
import {
  decodeGuestFrame,
  full,
  joinName,
  welcome,
  type GuestFrame,
  type HostFrame,
  type Room,
} from '../protocol.ts';

export { OPENING_MSG, WAITING_MSG, handoffMsg } from '../../../../shared/net/host.ts';

export type HostContext = SharedHostContext<Room>;
export type HostDeps = SharedHostDeps<GuestFrame, Room>;
export type HostOptions = Omit<SharedHostOptions, 'game'>;

const codec: HostCodec<GuestFrame, HostFrame, Room> = {
  decode: decodeGuestFrame,
  welcome: (ctx) => welcome(ctx.myName, { seatCount: 2 }),
  full,
  joinName,
};

export class HostSession extends SharedHostSession<GuestFrame, HostFrame, Room> {
  constructor(deps: HostDeps, opts: HostOptions) {
    super(deps, codec, { ...opts, game: 'hive' });
  }
}
