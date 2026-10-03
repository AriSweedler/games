// The defaults a game's shellConfig.ts leaves out (docs/design/dry-review-2026-10.md §2.3, §2.4,
// §7 row 2): until that row seven configs spelled these back to the shell, byte for byte. They
// live in lib because two zones that may not import each other read them: web/shared/ui paints
// the sessions' status copy before a session speaks (shell.ts `copyOf`) and web/shared/net
// speaks it (host.ts, guest.ts re-export the four strings for their callers), and
// web/shared/edge/prefs.ts decodes the stored tab and mode the shell defaults to.

/** The host name an empty input means, and the prefill of every name input; the first pass-and-play seat too (`DEFAULT_LOCAL_NAMES`). */
export const DEFAULT_NAME = 'Ari';

/** The three tabs every shell page carries, in the composed page's order; a game with more (gin's Score Counter, fidice's Ladder) spells its own list. */
export const HOME_TABS = ['play', 'rules', 'about'] as const;
export type HomeTab = (typeof HOME_TABS)[number];
export const DEFAULT_HOME_TAB: HomeTab = 'play';

/** The stored play modes (prefs.ts `decodePlayMode`); a game may show more (gin's sandbox, fidice's Solo and Watch), never store them. */
export const PLAY_MODES = ['online', 'local'] as const;
export type PlayMode = (typeof PLAY_MODES)[number];
export const DEFAULT_PLAY_MODE: PlayMode = 'online';

// ---- the sessions' status copy (web/shared/net/host.ts, guest.ts) ------------------------------

/** `#hostWaitStatus` from `host/click` until the Peer opens. */
export const OPENING_MSG = 'Opening room…';
/** The host's open status with no hand dealt at a table of two (`HostOptions.waiting`; seatCopy.ts counts the seats past two). */
export const WAITING_MSG = 'Waiting for your opponent to join…';
/** `#guestWaitStatus` from `guest/click` until the host's welcome names the room. */
export const connectingMsg = (code: string): string => `Connecting to room ${code}…`;
/** A pass-and-play game handed to a room (shell.ts `handoff`): nobody has joined it yet. */
export const handoffMsg = (code: string, oppName: string | null): string =>
  `Room ${code} is open — send ${oppName ?? 'your opponent'} the invite to carry on this game…`;
