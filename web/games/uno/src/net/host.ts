// UNO's host session: the shared session (web/shared/net/host.ts, docs/design/n-seat-sessions.md)
// with protocol.ts as its codec and 'uno' as the table's game, so the peer id is `uno-<CODE>`
// (web/shared/lib/roomCode.ts). The session hosts `capacity - 1` guest seats; the welcome carries
// the seat count and, past two seats, the table as the host knows it and the seat the channel took.
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
  type TableSeat,
} from '../protocol.ts';

export { OPENING_MSG, WAITING_MSG, handoffMsg } from '../../../../shared/net/host.ts';

/** What the codec reads off the app beyond the shell's fields: the seat count and the guest seats. */
export type HostRoom = Room & Readonly<{ seats: ReadonlyArray<TableSeat> }>;
export type HostContext = SharedHostContext<HostRoom>;
export type HostDeps = SharedHostDeps<GuestFrame, HostRoom>;
export type HostOptions = Omit<SharedHostOptions, 'game'>;

const codec: HostCodec<GuestFrame, HostFrame, HostRoom> = {
  decode: decodeGuestFrame,
  welcome: (ctx, seat) => welcome(ctx.myName, { seatCount: ctx.seatCount }, ctx.seats, seat),
  full,
  joinName,
};

export class HostSession extends SharedHostSession<GuestFrame, HostFrame, HostRoom> {
  constructor(deps: HostDeps, opts: HostOptions) {
    super(deps, codec, { ...opts, game: 'uno' });
  }
}
