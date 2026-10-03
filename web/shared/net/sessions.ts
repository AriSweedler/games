// A game's two sessions from its protocol (docs/design/shell-hoist.md §4 K): `sessionsFor(game,
// codec)` binds the shared host and guest sessions (host.ts, guest.ts) to one game, so a game's
// `net/sessions.ts` is a declaration over its protocol.ts exports and nothing else: the two
// decoders, `welcome` read off the host context, `full`, `join` and, for an N-seat table, `joinName`.
// The game name fixes the peer id (`peerIdFor(game, code)`, web/shared/lib/roomCode.ts), so the
// boot's `startHost`/`startGuest` pass every option but the game. What a game owns stays its own:
// the `welcome` adapter reads the room's terms (and, past two seats, the guest seats) off the
// context the shell fills (shell.ts `hostContextOf`). The seven `net/host.ts` + `net/guest.ts`
// pairs that each spelled these two subclasses by hand were this module's copies.
import type { Game } from '../lib/roomCode.ts';
import type { FrameDecoder } from '../lib/protocol.ts';
import { GuestSession, type GuestCodec, type GuestDeps, type GuestOptions } from './guest.ts';
import {
  HostSession,
  type HostCodec,
  type HostContext,
  type HostDeps,
  type HostOptions,
  type Seat,
} from './host.ts';

/**
 * The game's side of the wire as its protocol.ts exports it: `G` its guest frame, `H` its host
 * frame, `X` the room payload its `welcome` reads off the host context (the game's `Room`, plus
 * the guest seats for an N-seat welcome).
 */
export type ShellCodec<G, H, X> = Readonly<{
  /** What the host accepts from its guests; a refused frame is dropped. */
  decodeGuestFrame: FrameDecoder<G>;
  /** What the guest accepts from its host; a refused frame is dropped. */
  decodeHostFrame: FrameDecoder<H>;
  /** The frame sent when a guest's channel opens, from the context and the seat the channel took. */
  welcome: (ctx: HostContext<X>, seat: Seat) => H;
  /** The frame a spare peer is told before its channel is closed. */
  full: () => H;
  /** The frame a guest sends right after its channel opens, carrying its name. */
  join: (name: string) => G;
  /** The name a join carries (an N-seat table reseats a same-named rejoin); unset for a two-seat game. */
  joinName?: (frame: G) => string | null;
}>;

/** The host session's options less the game: what the boot's `startHost` passes. */
export type SessionHostOptions = Omit<HostOptions, 'game'>;
/** The guest session's options less the game: what the boot's `startGuest` passes. */
export type SessionGuestOptions = Omit<GuestOptions, 'game'>;

/** The two constructors a game exports as `HostSession` and `GuestSession` (boot.ts `net.Host`, `net.Guest`). */
export type Sessions<G, H, X> = Readonly<{
  Host: new (deps: HostDeps<G, X>, opts: SessionHostOptions) => HostSession<G, H, X>;
  Guest: new (deps: GuestDeps<H>, opts: SessionGuestOptions) => GuestSession<G, H>;
}>;

/** The host's half of the codec, `joinName` carried only when the game set one (the session reseats by name only then). */
const hostCodecOf = <G, H, X>(codec: ShellCodec<G, H, X>): HostCodec<G, H, X> => ({
  decode: codec.decodeGuestFrame,
  welcome: codec.welcome,
  full: codec.full,
  ...(codec.joinName === undefined ? {} : { joinName: codec.joinName }),
});

const guestCodecOf = <G, H, X>(codec: ShellCodec<G, H, X>): GuestCodec<G, H> => ({
  decode: codec.decodeHostFrame,
  join: codec.join,
});

/** The shared sessions bound to one game: its peer id prefix and its protocol. */
export const sessionsFor = <G, H, X>(game: Game, codec: ShellCodec<G, H, X>): Sessions<G, H, X> => {
  const host = hostCodecOf(codec);
  const guest = guestCodecOf(codec);
  return {
    Host: class extends HostSession<G, H, X> {
      constructor(deps: HostDeps<G, X>, opts: SessionHostOptions) {
        super(deps, host, { ...opts, game });
      }
    },
    Guest: class extends GuestSession<G, H> {
      constructor(deps: GuestDeps<H>, opts: SessionGuestOptions) {
        super(deps, guest, { ...opts, game });
      }
    },
  };
};
