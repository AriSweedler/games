// The skeleton `tools/new-game.ts` writes (docs/design/new-game.md §3): every file of a shell game
// under web/games/<slug>/, its e2e fixture and spec, and its design doc, each spelled from the
// NewGameSpec. The shape is Hive's (web/games/hive, the newest two-seat shell game, docs/design/hive.md
// §7) with the game cut out: a placeholder engine (two seats, Pass and Resign, a seeded draw of the
// winner after MAX_TURNS passes, so the Rng seam and the seat checks are exercised), the reducer with
// the pause the end raises (AGENT.md "Understand what happened before proceeding"), the cue table
// over SHELL_CUES, the one-screen Rules items, the table (the names strip, the status line, the
// controls, the result sheet) and the curtain when a hand is hidden. Everything a real game adds
// replaces a TODO row of docs/design/<slug>.md; nothing here is meant to survive the first rule.
import { namesOf, type NewGameSpec } from './spec.ts';

export type GeneratedFile = Readonly<{ path: string; content: string }>;

const engineTs = (
  slug: string,
  title: string,
): string => `// ${title}'s rules engine (docs/design/${slug}.md §2): the scaffold's placeholder rules, pure and
// seat-checked, for the real rules to replace. Two seats take turns; a turn is Pass (the placeholder
// move) or Resign; after MAX_TURNS passes the injected Rng draws the winner, so the seam every real
// game needs (a seeded deal, a roll) is in place and tested. Pure: no clock, no DOM, the Rng injected.
import type { Rng } from '../../../../shared/lib/rng.ts';
import { err, ok, type Result } from '../../../../shared/lib/result.ts';

/** The shell's two seats: seat 0 is the host (or the first name typed), seat 1 the guest. */
export type Seat = 0 | 1;
export const SEATS: ReadonlyArray<Seat> = [0, 1];
export type Names = Readonly<[string, string]>;

export type Outcome =
  | Readonly<{ kind: 'win'; winner: Seat; by: 'resign' | 'luck' }>
  | Readonly<{ kind: 'draw' }>;

export type Game = Readonly<{
  names: Names;
  turn: Seat;
  /** Turns taken so far. */
  turns: number;
  result: Outcome | null;
  /** What just happened, for the status line. */
  note: string;
}>;

export type Intent = Readonly<{ type: 'pass' }> | Readonly<{ type: 'resign' }>;

/** The placeholder end: after this many turns the Rng picks the winner. */
export const MAX_TURNS = 10;

export const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

export const newGame = (names: Names): Game => ({
  names,
  turn: 0,
  turns: 0,
  result: null,
  note: \`\${names[0]} to play.\`,
});

/** What the seat to move may do now; nothing once the game is over. */
export const legalIntents = (game: Game): ReadonlyArray<Intent> =>
  game.result === null ? [{ type: 'pass' }, { type: 'resign' }] : [];

/** One turn by the seat to move; a refusal is the reason. */
export const apply = (game: Game, intent: Intent, rng: Rng): Result<Game, string> => {
  if (game.result !== null) return err('The game is over.');
  const mover = game.names[game.turn];
  switch (intent.type) {
    case 'resign':
      return ok({
        ...game,
        result: { kind: 'win', winner: other(game.turn), by: 'resign' },
        note: \`\${mover} resigned.\`,
      });
    case 'pass': {
      const turns = game.turns + 1;
      const next = other(game.turn);
      if (turns < MAX_TURNS)
        return ok({ ...game, turns, turn: next, note: \`\${mover} passed. \${game.names[next]} to play.\` });
      const winner: Seat = rng() < 0.5 ? 0 : 1;
      return ok({
        ...game,
        turns,
        turn: next,
        result: { kind: 'win', winner, by: 'luck' },
        note: \`\${mover} passed. \${game.names[winner]} wins on the draw.\`,
      });
    }
  }
};
`;

const engineTestTs = (
  slug: string,
  title: string,
): string => `// The placeholder engine (docs/design/${slug}.md §2): positions by hand, and whole bot games at the
// seat count with the counts checked at every step (AGENT.md "A new game" step 2). Replace the
// cases as the rules land; keep the bot game.
import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { MAX_TURNS, apply, legalIntents, newGame, other, type Game } from './engine.ts';

const NAMES = ['Ann', 'Bob'] as const;

/** Every seat passes until the game ends; each step is checked. */
const botGame = (seed: number): Game =>
  Array.from({ length: MAX_TURNS }).reduce<Game>((game, _, i) => {
    expect(game.result).toBeNull();
    expect(game.turn).toBe(i % 2);
    expect(game.turns).toBe(i);
    expect(legalIntents(game)).toEqual([{ type: 'pass' }, { type: 'resign' }]);
    const next = apply(game, { type: 'pass' }, mulberry32(seed));
    if (!next.ok) throw new Error(next.error);
    expect(next.value.turn).toBe(other(game.turn));
    expect(next.value.turns).toBe(i + 1);
    return next.value;
  }, newGame(NAMES));

describe('${title}: the placeholder engine', () => {
  test('a fresh game: seat 0 to play, nothing decided', () => {
    const game = newGame(NAMES);
    expect(game).toMatchObject({ turn: 0, turns: 0, result: null });
    expect(game.note).toBe('Ann to play.');
  });

  test('a pass hands the turn over and says so', () => {
    const next = apply(newGame(NAMES), { type: 'pass' }, mulberry32(1));
    if (!next.ok) throw new Error(next.error);
    expect(next.value).toMatchObject({ turn: 1, turns: 1, result: null });
    expect(next.value.note).toBe('Ann passed. Bob to play.');
  });

  test('a resign ends the game for the other seat; nothing is legal after', () => {
    const over = apply(newGame(NAMES), { type: 'resign' }, mulberry32(1));
    if (!over.ok) throw new Error(over.error);
    expect(over.value.result).toEqual({ kind: 'win', winner: 1, by: 'resign' });
    expect(legalIntents(over.value)).toEqual([]);
    expect(apply(over.value, { type: 'pass' }, mulberry32(1))).toEqual({
      ok: false,
      error: 'The game is over.',
    });
  });

  test('a bot game at two seats: MAX_TURNS passes end on the seeded draw, the same for the same seed', () => {
    const a = botGame(7);
    const b = botGame(7);
    expect(a.result?.kind).toBe('win');
    expect(a.result).toMatchObject({ by: 'luck' });
    expect(a).toEqual(b);
    expect(a.turns).toBe(MAX_TURNS);
    expect(legalIntents(a)).toEqual([]);
  });
});
`;

const viewTs = (
  slug: string,
  title: string,
): string => `// ${title}'s engine as the shared shell plays it (docs/design/${slug}.md §3; web/shared/ui/shell.ts
// \`ShellConfig.engine\`): the host (or the phone) holds the whole \`State\`, each seat gets its \`View\`
// (the whole game here; a game that hides a hand cuts the other seat's out of \`viewFor\`). \`State\`
// wraps the engine's \`Game\` with the game's clock (the finished game's key in the device's history).
// \`applyAction\` refuses a play out of turn; \`again\` may come from either seat once the game is
// over. The decoders are the trust boundary for the wire and the save (docs/ARCHITECTURE.md
// "Module boundaries").
import {
  arrayOf,
  integer,
  literal,
  nullable,
  object,
  string,
  taggedUnion,
  type Decoder,
} from '../../../../shared/lib/json.ts';
import type { Rng } from '../../../../shared/lib/rng.ts';
import { err, ok, type Result } from '../../../../shared/lib/result.ts';
import {
  apply,
  legalIntents,
  newGame,
  type Game,
  type Intent,
  type Names,
  type Outcome,
  type Seat,
} from './engine.ts';

export type { Seat };

export type State = Readonly<{ game: Game; startedAt: number }>;
export type Action = Intent | Readonly<{ type: 'again' }>;

/** One seat's picture of the table: the whole game, and what the seat may do now (empty off its turn). */
export type View = Readonly<{
  seat: Seat;
  names: Names;
  game: Game;
  startedAt: number;
  legal: ReadonlyArray<Intent>;
}>;

export const createState = (names: Names, now: () => number): State => ({
  game: newGame(names),
  startedAt: now(),
});

export const NOT_YOUR_TURN_MSG = 'Not your turn.';

export const applyAction = (
  state: State,
  seat: Seat,
  action: Action,
  rng: Rng,
  now: () => number,
): Result<State, string> => {
  const game = state.game;
  if (action.type === 'again') {
    if (game.result === null) return err('The game is still on.');
    return ok({ game: newGame(game.names), startedAt: now() });
  }
  if (game.result !== null) return err('The game is over.');
  if (seat !== game.turn) return err(NOT_YOUR_TURN_MSG);
  const next = apply(game, action, rng);
  return next.ok ? ok({ game: next.value, startedAt: state.startedAt }) : next;
};

export const viewFor = (state: State, seat: Seat): View => {
  const game = state.game;
  const mine = seat === game.turn && game.result === null;
  return {
    seat,
    names: game.names,
    game,
    startedAt: state.startedAt,
    legal: mine ? legalIntents(game) : [],
  };
};

/** The seat whose turn it is, or null once the game is over. */
export const turnSeat = (game: Game): Seat | null => (game.result === null ? game.turn : null);

/** The winning seat, or null (the game on, or drawn). */
export const winnerSeat = (result: Outcome | null): Seat | null =>
  result?.kind === 'win' ? result.winner : null;

/** What a guest may send: its legal intents, Play again once over. */
export const legalActions = (view: View): ReadonlyArray<Action> =>
  view.game.result !== null ? [{ type: 'again' }] : view.legal;

// ---- the decoders ---------------------------------------------------------------------------

const seat: Decoder<Seat> = literal(0, 1);

/** The two names, seat 0's first. */
const names: Decoder<Names> = (input) => {
  const pair = arrayOf(string)(input);
  if (!pair.ok) return pair;
  const [a, b] = pair.value;
  return a !== undefined && b !== undefined && pair.value.length === 2
    ? ok([a, b] as const)
    : err({ path: [], expected: 'two names' });
};

const outcome: Decoder<Outcome> = taggedUnion('kind', {
  win: object({ kind: literal('win'), winner: seat, by: literal('resign', 'luck') }),
  draw: object({ kind: literal('draw') }),
});

const intent: Decoder<Intent> = taggedUnion('type', {
  pass: object({ type: literal('pass') }),
  resign: object({ type: literal('resign') }),
});

export const decodeAction: Decoder<Action> = taggedUnion('type', {
  pass: object({ type: literal('pass') }),
  resign: object({ type: literal('resign') }),
  again: object({ type: literal('again') }),
});

const game: Decoder<Game> = object({
  names,
  turn: seat,
  turns: integer(0),
  result: nullable(outcome),
  note: string,
});

export const decodeView: Decoder<View> = object({
  seat,
  names,
  game,
  startedAt: integer(0),
  legal: arrayOf(intent),
});

/** The save's game and \`position/load\`'s hand-made object: the engine's state and the game's clock. */
export const decodeState: Decoder<State> = object({ game, startedAt: integer(0) });
`;

const viewTestTs = (title: string): string => `import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../../shared/lib/rng.ts';
import {
  applyAction,
  createState,
  decodeState,
  decodeView,
  legalActions,
  turnSeat,
  viewFor,
  winnerSeat,
} from './view.ts';

const NOW = (): number => 77;
const rng = mulberry32(1);

describe('${title}: the shell adapters', () => {
  test('the start, the view per seat, a play out of turn refused, the result', () => {
    const state = createState(['Ann', 'Bob'], NOW);
    expect(state.startedAt).toBe(77);
    expect(turnSeat(state.game)).toBe(0);
    expect(viewFor(state, 0).legal).toHaveLength(2);
    expect(viewFor(state, 1).legal).toEqual([]);
    expect(applyAction(state, 1, { type: 'pass' }, rng, NOW).ok).toBe(false);
    expect(applyAction(state, 0, { type: 'again' }, rng, NOW).ok).toBe(false);
    const resigned = applyAction(state, 0, { type: 'resign' }, rng, NOW);
    if (!resigned.ok) throw new Error(resigned.error);
    expect(turnSeat(resigned.value.game)).toBeNull();
    expect(winnerSeat(resigned.value.game.result)).toBe(1);
    expect(legalActions(viewFor(resigned.value, 0))).toEqual([{ type: 'again' }]);
    const again = applyAction(resigned.value, 1, { type: 'again' }, rng, () => 99);
    if (!again.ok) throw new Error(again.error);
    expect(again.value).toMatchObject({ startedAt: 99, game: { turns: 0, result: null } });
  });

  test('the decoders round-trip a view and a state, and refuse a stranger', () => {
    const state = createState(['Ann', 'Bob'], NOW);
    const view = viewFor(state, 0);
    expect(decodeView(JSON.parse(JSON.stringify(view)))).toEqual({ ok: true, value: view });
    expect(decodeState(JSON.parse(JSON.stringify(state)))).toEqual({ ok: true, value: state });
    expect(decodeView({ seat: 2 }).ok).toBe(false);
    expect(decodeState({ game: { names: ['Ann'] } }).ok).toBe(false);
  });
});
`;

const protocolTs = (
  slug: string,
  title: string,
): string => `// The ${title} wire codecs (docs/design/${slug}.md §3): the frames a host and its guest exchange over
// the PeerJS data channel, web/shared/lib/protocol.ts's two-seat skeleton over this engine's
// decoders (the trust boundary, docs/ARCHITECTURE.md "Module boundaries"). The room carries one
// term after \`hostName\`, the seat count, always 2.
import { literal } from '../../../shared/lib/json.ts';
import {
  twoSeatProtocol,
  type ActionFrame as SharedActionFrame,
  type Frame as SharedFrame,
  type GuestFrame as SharedGuestFrame,
  type HostFrame as SharedHostFrame,
  type LobbyFrame as SharedLobbyFrame,
  type StateFrame as SharedStateFrame,
  type WelcomeFrame as SharedWelcomeFrame,
} from '../../../shared/lib/protocol.ts';
import { decodeAction, decodeView, type Action, type View } from './engine/view.ts';

export {
  DEFAULT_GUEST_NAME,
  NAME_MAX,
  TOAST_MAX,
  WIRE_TAGS,
  guestNameFor,
  isGuestFrame,
  type DecodeFailure,
  type FullFrame,
  type JoinFrame,
  type ToastFrame,
  type WireTag,
} from '../../../shared/lib/protocol.ts';

/** The room after \`hostName\`: two seats, always. */
const room = { seatCount: literal(2) };
export type Room = Readonly<{ seatCount: 2 }>;

export type ActionFrame = SharedActionFrame<Action>;
export type GuestFrame = SharedGuestFrame<Action>;
export type WelcomeFrame = SharedWelcomeFrame<Room>;
export type LobbyFrame = SharedLobbyFrame<Room>;
export type StateFrame = SharedStateFrame<View>;
export type HostFrame = SharedHostFrame<View, Room>;
export type Frame = SharedFrame<Action, View, Room>;

/** The protocol whole: what the shell sends from (shellConfig.ts \`frames\`). */
export const PROTOCOL = twoSeatProtocol({ decodeAction, decodeView, room });

export const {
  decodeFrame,
  decodeGuestFrame,
  decodeHostFrame,
  join,
  action,
  full,
  toast,
  state,
  welcome,
  lobby,
} = PROTOCOL;

/** The name a join carries (the session reseats a same-named rejoin), null for an action. */
export const joinName = (frame: GuestFrame): string | null =>
  frame.t === 'join' ? frame.name : null;
`;

const sessionsTs = (
  slug: string,
  title: string,
): string => `// ${title}'s sessions: the shared pair (web/shared/net/sessions.ts) bound to '${slug}', so the peer
// id is \`${slug}-<CODE>\` (web/shared/lib/roomCode.ts), with protocol.ts as the codec. One guest
// seat: the welcome carries the room's one term, two seats.
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

/** The pair the boot takes whole (\`net: SESSIONS\`). */
export const SESSIONS = sessionsFor<GuestFrame, HostFrame, Room>(
  '${slug}',
  {
    decodeGuestFrame,
    decodeHostFrame,
    welcome: (ctx) => welcome(ctx.myName, { seatCount: 2 }),
    full,
    join,
    joinName,
  },
);
`;

const storageTs = (
  slug: string,
  title: string,
): string => `// ${title}'s storage (docs/design/${slug}.md §3): the shared shell's keys under this game's prefix
// (web/shared/edge/prefs.ts \`shellStore\`) and no key of its own. tools/games.ts REGISTRY pins the
// save key and the prefix.
import type { Store, StorageError } from '../../../shared/edge/storage.ts';
import {
  shellStore,
  DEFAULT_PLAY_MODE,
  HOME_TABS,
  type HomeTab,
  type PlayMode,
} from '../../../shared/edge/prefs.ts';
import { literal, object } from '../../../shared/lib/json.ts';
import { decodeState, type State } from './engine/view.ts';

export type { PlayMode, Store, StorageError };

export const STORAGE_KEYS = {
  /** The game in progress: pass-and-play, or the host's table and game, or the guest's table. */
  save: '${slug}MP_v1',
  name: '${slug}_name',
  p2Name: '${slug}_p2Name',
  homeTab: '${slug}_homeTab',
  playMode: '${slug}_playMode',
  sound: '${slug}_sound',
  soundFont: '${slug}_soundFont',
  recentGames: '${slug}_recentGames',
  flipTable: '${slug}_flipTable',
} as const;

// The tabs and the stored mode's default are the shell's (prefs.ts); re-exported for ui/state.ts, which may not import prefs.ts's edge.
export { DEFAULT_PLAY_MODE, HOME_TABS, type HomeTab };

/** The room's terms: two seats, always (the shell's option record needs one field). */
export type Opts = Readonly<{ seatCount: 2 }>;
export const DEFAULT_OPTS: Opts = { seatCount: 2 };

export const SHELL_STORE = shellStore<State, Opts, HomeTab>(STORAGE_KEYS, {
  game: '${slug}',
  decodeGame: decodeState,
  hostExtra: {
    decode: object({ seatCount: literal(2) }),
    literal: () => DEFAULT_OPTS,
  },
  decodeHomeTab: literal(...HOME_TABS),
});
`;

const shellConfigTs = (
  slug: string,
  upper: string,
  pascal: string,
  title: string,
): string => `// The half of ${title}'s shell config the game spells from its engine, protocol and storage alone
// (docs/design/${slug}.md §3; web/shared/ui/shell.ts \`ShellGameData\`): the id the table codes are
// made for, the copy the shared flows paint (the leave confirms over a game, a score and a table:
// the shell's words), the option codec (two seats, always), the engine adapters (engine/view.ts),
// the protocol, the cue table and the shell's store; the names, tabs, modes, status copy and cue
// memory are the shell's defaults (docs/design/dry-review-2026-10.md §7 row 2). The table hooks
// are the reducer's (ui/state.ts \`${upper}\`).
import { hostRoomMsg, leaveCopy } from '../../../shared/ui/seatCopy.ts';
import type { ShellGameData } from '../../../shared/ui/shell.ts';
import { applyAction, createState, decodeState, viewFor, winnerSeat } from './engine/view.ts';
import { PROTOCOL } from './protocol.ts';
import { DEFAULT_OPTS, SHELL_STORE } from './storage.ts';
import { CUES } from './ui/sound.ts';
import type { ${pascal} } from './ui/state.ts';

export const ${upper}_SHELL: ShellGameData<${pascal}> = {
  id: '${slug}',
  copy: { ...leaveCopy(), hostRoom: hostRoomMsg('start') },
  opts: {
    initial: DEFAULT_OPTS,
    parse: () => DEFAULT_OPTS,
    ofGame: () => DEFAULT_OPTS,
    pick: () => DEFAULT_OPTS,
  },
  engine: {
    create: (players, _opts, _rng, now) => createState([players[0].name, players[1].name], now),
    apply: (game, seat, act, rng, now) => applyAction(game, seat, act, rng, now),
    viewFor,
    decodeState,
    over: (view) => view.game.result !== null,
    finished: (game) => game.game.result !== null,
    names: (game) => game.game.names,
    renameGuest: (game, name) => ({
      ...game,
      game: { ...game.game, names: [game.game.names[0], name] },
    }),
  },
  result: {
    playersOf: (view) => view.names,
    scoreOf: (view) => {
      const result = view.game.result;
      if (result === null) return '';
      return result.kind === 'draw' ? 'draw' : result.by;
    },
    winnerOf: (view) => winnerSeat(view.game.result),
  },
  frames: PROTOCOL,
  cues: { table: CUES },
  prefs: SHELL_STORE,
};
`;

const shellConfigTestTs = (
  upper: string,
): string => `import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../shared/lib/rng.ts';
import { defaultModeOf, keyOfView } from '../../../shared/ui/shell.ts';
import { viewFor } from './engine/view.ts';
import { ${upper}_SHELL } from './shellConfig.ts';

const PLAYERS = [
  { id: 'h', name: 'Ann' },
  { id: 'g', name: 'Bob' },
] as const;

describe('the shell config', () => {
  test('the copy and the modes', () => {
    expect(${upper}_SHELL.copy.hostRoom('Ann', { seatCount: 2 }, 2, 2)).toBe(
      'Connected — waiting for Ann to start',
    );
    // The play mode is the shell's default (local or online; shell.test.ts).
    expect(${upper}_SHELL.modes).toBeUndefined();
    expect(defaultModeOf(${upper}_SHELL)).toBe('online');
    expect(${upper}_SHELL.opts.parse({}, { seatCount: 2 })).toEqual({ seatCount: 2 });
  });

  test('the engine adapters: the start over the two seats, the names, a rename, the result', () => {
    const e = ${upper}_SHELL.engine;
    const game = e.create(PLAYERS, { seatCount: 2 }, mulberry32(1), () => 77);
    expect(e.names(game)).toEqual(['Ann', 'Bob']);
    expect(e.renameGuest(game, 'Bea', 1).game.names).toEqual(['Ann', 'Bea']);
    expect(e.finished(game)).toBe(false);
    const view = viewFor(game, 0);
    expect(e.over(view)).toBe(false);
    expect(keyOfView(${upper}_SHELL, view)).toBe('77');
    expect(${upper}_SHELL.result.playersOf(view)).toEqual(['Ann', 'Bob']);
    expect(${upper}_SHELL.result.scoreOf(view)).toBe('');
    expect(${upper}_SHELL.result.winnerOf(view)).toBeNull();
    const refused = e.apply(game, 1, { type: 'pass' }, mulberry32(1), () => 0);
    expect(refused.ok).toBe(false);
    const resigned = e.apply(game, 0, { type: 'resign' }, mulberry32(1), () => 0);
    if (!resigned.ok) throw new Error(resigned.error);
    expect(e.finished(resigned.value)).toBe(true);
    const over = viewFor(resigned.value, 0);
    expect(e.over(over)).toBe(true);
    expect(${upper}_SHELL.result.scoreOf(over)).toBe('resign');
    expect(${upper}_SHELL.result.winnerOf(over)).toBe(1);
  });
});
`;

const homeTs = (
  slug: string,
  pascal: string,
): string => `// The home screen's game half (docs/design/${slug}.md §3): the shared shell's tabs, modes, inputs and
// resume box (web/shared/ui/home.ts) and nothing of this page's own: a game for two has no option
// (a game with a seat range composes web/shared/ui/seatedHome.ts instead, as the three seated games
// do). The input writes the reducer raises (the names, the code) are the boot's defaults.
import type { DocumentLike, PageLike } from '../../../../shared/edge/dom.ts';
import {
  bindHomeShell,
  homeView,
  paintHomeShell,
  shellIntents,
} from '../../../../shared/ui/home.ts';
import {
  HOME_TABS,
  resumeLabel,
  type App,
  type Intent,
  type PlayMode,
  type Raw,
  type ${pascal},
} from './state.ts';

const PLAY_MODES: ReadonlyArray<PlayMode> = ['online', 'local'];

const noOptions = (): Raw => ({});

/** The tabs and panels, the play mode, the submenu and the resume box. */
export const paintHome = (doc: DocumentLike, app: App): void => {
  paintHomeShell(doc, homeView(app.shell, resumeLabel), { tabs: HOME_TABS, modes: PLAY_MODES });
};

/** Every control of the home screen and the two waiting screens. */
export const bindHome = (doc: PageLike, dispatch: (intent: Intent) => void): void => {
  bindHomeShell(doc, dispatch, {
    tabs: HOME_TABS,
    startOptions: { host: noOptions, local: noOptions },
    intents: shellIntents<${pascal}>(),
  });
};
`;

const rulesTs = (
  slug: string,
  title: string,
): string => `// The Rules tab and the in-game rules sheet (docs/design/${slug}.md §4; the owner, 2026-10-02: "the
// ruleset to teach players should be as short as possible, ideally fitting on 1 screen"): the goal,
// the turn, then the special cases one line each; the long form is docs/design/${slug}.md. The About
// copy names the page. Both are tables the boot renders once (web/shared/edge/boot.ts \`copy\`). TODO: the
// real rules, as few lines as fit 390x844.
import type { Glossary, RuleItem } from '../../../../shared/ui/glossary.ts';

/** The words linked to their rule (docs/design/glossary-links.md): "pass" in the goal opens the Turn rule. */
export const GLOSSARY: Glossary = [{ rule: 'turn', terms: ['pass', 'passes'] }];

export const RULES_ITEMS: ReadonlyArray<RuleItem> = [
  {
    id: 'goal',
    heading: 'Goal',
    body: 'Be the seat the draw favours after ten passes, or outlast a resignation.',
  },
  { id: 'turn', heading: 'A turn', body: 'Pass, or resign. The turn then goes to the other seat.' },
  { id: 'end', heading: 'The end', body: 'After the tenth pass the draw names the winner.' },
];

export const ABOUT_PARAGRAPHS: ReadonlyArray<string> = [
  '${title.replace(/'/g, '’')}, for two. This is the scaffold’s placeholder: each pass hands the turn over, and the tenth decides the game on a draw.',
  'Pass one phone back and forth, or open a table online and send the link.',
];
`;

const rulesTestTs = (): string => `import { describe, expect, test } from 'vitest';

import { aboutHtml, rulesListHtml } from '../../../../shared/ui/glossary.ts';
import { ABOUT_PARAGRAPHS, GLOSSARY, RULES_ITEMS } from './rules.ts';

describe('the rules', () => {
  test('short enough for one phone screen: the goal, the turn and the end, under 150 words in all', () => {
    expect(RULES_ITEMS.map((r) => r.id)).toEqual(['goal', 'turn', 'end']);
    const words = RULES_ITEMS.flatMap((r) => \`\${r.heading} \${r.body}\`.split(/\\s+/));
    expect(words.length).toBeLessThan(150);
  });

  test('the jargon links: the goal to the turn, the About to the turn', () => {
    const html = rulesListHtml(RULES_ITEMS, GLOSSARY);
    expect(html).toContain('<li id="rule-goal">');
    expect(html).toMatch(/id="rule-goal">.*data-rule="turn"/);
    expect(aboutHtml(ABOUT_PARAGRAPHS, GLOSSARY)).toContain('data-rule="turn">pass</a>');
  });
});
`;

const soundTs = (
  slug: string,
  title: string,
): string => `// ${title}'s cues (docs/design/${slug}.md §3): the shell's four (a tap, my turn, win, lose) and the
// table's own, each a cue of the active font with its buzz (web/shared/lib/sound/cues.ts). The
// reducer picks them from the change between two views (ui/state.ts \`cuesBetween\`), once per view
// (\`CueMemory\`). TODO: one row per key moment of the real game.
import { SHELL_CUES, type CueSpec } from '../../../../shared/lib/sound/cues.ts';

export type Cue = 'yourTurn' | 'pass' | 'win' | 'lose';

export const CUES: Readonly<Record<Cue | 'tap', CueSpec>> = {
  ...SHELL_CUES,
  pass: { cue: 'move', buzz: 10 },
};
`;

const soundTestTs = (): string => `import { describe, expect, test } from 'vitest';

import { SHELL_CUES } from '../../../../shared/lib/sound/cues.ts';
import { CUES } from './sound.ts';

describe('the cue table', () => {
  test("spreads the shell's cues and adds the table's own", () => {
    expect(CUES).toMatchObject(SHELL_CUES);
    expect(CUES.pass).toEqual({ cue: 'move', buzz: 10 });
  });
});
`;

const stateTs = (
  slug: string,
  upper: string,
  pascal: string,
  title: string,
  hidden: boolean,
): string => `// ${title}'s reducer on the shared shell (docs/design/${slug}.md §3; web/shared/ui/shell.ts): the shell's
// flows (the home screen, the waiting rooms, the leave, the resume) over this game's config
// (shellConfig.ts \`${upper}_SHELL\` completed here as \`${upper}\`), and the table's own intents. Every role
// plays through \`act\`: pass-and-play and the host apply the action to the engine and broadcast each
// seat its view, a guest sends one \`action\` frame and waits for its view. ${
  hidden
    ? 'Pass-and-play raises the curtain on every change of turn: a seat holds something the other must not see (AGENT.md "Hidden hands").'
    : "Pass-and-play raises no curtain: nothing is hidden, so both players share the one screen and the view changes hands as the turn does (Hive's shape)."
}
// The game's end is a pause (AGENT.md "Understand what happened before proceeding"): the shell's
// pause sheet holds the table until Continue (\`table.pause\` below), then the result sheet offers
// Play again (the shell's \`again/click\`). Pure: the clock and the rng come in through \`Ctx\`.
import {
  act as shellAct,
  andThen as then,
  pure,
  step,
  withShell,
  type Ctx,
  type Effect as SharedEffect,
  type GameTypes,
  type HomeSnapshot as SharedHomeSnapshot,
  type Intent as SharedIntent,
  type Pause,
  type Resume as SharedResume,
  type ShellApp,
  type ShellConfig,
  type ShellState,
  type Step as SharedStep,
  type TableReset,
} from '../../../../shared/ui/shell.ts';
import { shellReducer } from '../../../../shared/ui/shellReducer.ts';
import {
  turnSeat,
  viewFor,
  type Action,
  type Seat,
  type State,
  type View,
} from '../engine/view.ts';
import { ${upper}_SHELL } from '../shellConfig.ts';
import {
  DEFAULT_PLAY_MODE,
  HOME_TABS,
  type HomeTab,
  type Opts,
  type PlayMode,
  type Store,
} from '../storage.ts';
import type { Cue } from './sound.ts';

export { DEFAULT_PLAY_MODE, HOME_TABS, type HomeTab, type PlayMode };

/** \`host/click\` and \`local/click\` carry nothing beyond the names: a game for two has no option. */
export type Raw = Readonly<{ seats?: never }>;

/** \`initHome\` reads nothing beyond the shell's keys. */
export type Home = Readonly<{ opts?: never }>;

/** The table's own state: the curtain seat alone (the sheets, the pause and the result are the shell's, \`ShellState\`). */
export type Table = Readonly<{
  /** The shell's pass-and-play curtain seat (\`ShellTypes.Table\`; the shell writes it from \`local.viewer\`). */
  curtain: Seat | null;
}>;

/** The table's one intent: a play; the sheets (\`rules/*\`, \`history/*\`, \`escape\`) are the shell's intents. */
export type TableIntent = Readonly<{ type: 'act'; action: Action }>;

export type TableEffect = never;

/** ${title}'s types for the shared shell (\`GameTypes\` over what it names; the rest are the shell's defaults): two seats, no option, the whole game as every seat's view. */
export type ${pascal} = GameTypes<{
  Opts: Opts;
  Raw: Raw;
  State: State;
  View: View;
  Action: Action;
  Table: Table;
  Cue: Cue;
  Home: Home;
  Intent: TableIntent;
  Effect: TableEffect;
  Store: Store;
  Seat: never;
}>;

export type Shell = ShellState<${pascal}>;
export type App = ShellApp<${pascal}>;
export type Intent = SharedIntent<${pascal}>;
export type Effect = SharedEffect<${pascal}>;
export type Step = SharedStep<${pascal}>;
export type Resume = SharedResume<${pascal}>;
export type HomeSnapshot = SharedHomeSnapshot<${pascal}>;

export const initialTable: Table = { curtain: null };

const fx = (cue: Cue | 'tap'): Effect => ({ type: 'fx', cue });

/** The cues for the change from \`prev\` to \`next\`: a pass taken, the game won or lost. */
export const cuesBetween = (prev: View, next: View): ReadonlyArray<Cue> => {
  const result = next.game.result;
  if (result !== null && prev.game.result === null) {
    if (result.kind === 'draw') return [];
    return [result.winner === next.seat ? 'win' : 'lose'];
  }
  return next.game.turns > prev.game.turns ? ['pass'] : [];
};

/** The end's words: who won (or a draw) and how it came, for the pause and the result sheet alike. */
export const endWords = (view: View): Pause | null => {
  const result = view.game.result;
  if (result === null) return null;
  const title =
    result.kind === 'draw'
      ? 'A draw'
      : result.winner === view.seat
        ? 'You win!'
        : \`\${view.names[result.winner]} wins!\`;
  return { title, detail: view.game.note };
};

/** The shell's \`table.pause\` adapter (AGENT.md "Understand what happened before proceeding"): the pause a new view raises against the one it replaces: the end, with how it came; a cold paint raises none. */
export const pauseFor = (prev: View | null, next: View): Pause | null =>
  prev?.game.result !== null ? null : endWords(next);

/** One key per position, so a re-sent frame plays nothing. */
const cueKey = (v: View): string =>
  \`\${String(v.startedAt)}:\${String(v.game.turns)}:\${String(v.game.turn)}:\${v.game.result === null ? 'on' : 'over'}\`;

/**
 * The state side of a paint: the table is the screen while a view is held; the cues come from the
 * change since \`prev\`, once per position, and "your turn" when an online turn lands on my seat
 * (the end's pause is the shell's, through \`table.pause\`).
 */
const rendered = (app: App, prev: View | null): Step => {
  const view = app.shell.view;
  if (view === null) return pure(app);
  const key = cueKey(view);
  const fresh = prev !== null && key !== app.shell.cues.key;
  const online = app.shell.role === 'host' || app.shell.role === 'guest';
  const myTurnNow =
    online && fresh && turnSeat(view.game) === view.seat && turnSeat(prev.game) !== view.seat;
  const cues: ReadonlyArray<Cue> = fresh
    ? [...cuesBetween(prev, view), ...(myTurnNow ? (['yourTurn'] as const) : [])]
    : [];
  return step(withShell(app, { cues: { key }, screen: 'tableScreen' }), ...cues.map(fx));
};

const reset = (table: Table, at: TableReset): Table => {
  switch (at) {
    case 'startLocal':
    case 'handoff':
    case 'leave':
    case 'lost':
      return initialTable;
    case 'deal':
    case 'view':
    case 'applied':
    case 'frame':
      return table;
  }
};

/**
 * \`localBroadcast\`'s seat: the actor's view while the game is on, the phone holder's once it is
 * over. ${hidden ? 'The curtain rises whenever the seat to view is not the one that lifted it last.' : 'Never a curtain: nothing is hidden, so the view just changes hands on screen.'}
 */
const viewer: ShellConfig<${pascal}>['local']['viewer'] = (app, game) => {
  const actor = turnSeat(game.game);
  const holder: Seat = app.shell.view?.seat ?? app.shell.revealed ?? 0;
  const seat = actor ?? holder;
  const curtain = ${hidden ? 'actor !== null && app.shell.revealed !== seat ? seat : null' : 'null'};
  return { seat, curtain };
};

/** \`curtain/reveal\`: whoever must act lifts the curtain, and acts from this phone (the shell's \`act\`); the shell's \`position/load\` reads the seat to move off this. */
const revealer: ShellConfig<${pascal}>['local']['revealer'] = (game) => ({
  seat: turnSeat(game.game) ?? 0,
});

export const ${upper}: ShellConfig<${pascal}> = {
  ...${upper}_SHELL,
  // The end is a pause (the shell holds it until Continue; nothing moves meanwhile); Play again is the shell's \`again/click\`.
  table: { initial: initialTable, reset, rendered, pause: (_app, prev, view) => pauseFor(prev, view) },
  local: { viewer, revealer },
};

/** \`act(action)\`: the shell's by role (the mover acts on a pass-and-play phone: \`revealer\`; a pause up holds it there). */
const act = (app: App, action: Action, ctx: Ctx): Step => shellAct(app, action, ctx, ${upper});

/** A play with its tap: the table's one intent (the sheets are the shell's, reduced before this). */
const tableIntent = (app: App, intent: TableIntent, ctx: Ctx): Step =>
  then(step(app, fx('tap')), (a) => act(a, intent.action, ctx));

/**
 * The boot's reducer block (web/shared/ui/shellReducer.ts): the shell's flows over \`${upper}\` and
 * the table's intents; every effect is the shell's (the table has none of its own). The
 * pass-and-play start is the shell's \`local/click\` (the two names through its \`localSeats\` rule
 * with this game's defaults, then \`engine.create\`): a game writes its own only where the start
 * depends on something the shell cannot see (docs/design/fidice-shell-adoption.md §9).
 */
export const reducer = shellReducer(${upper}, {
  intent: tableIntent,
});
export const { initialApp, reduce, runEffect, readHome, resumeFor, hostContextOf, guestContextOf } =
  reducer;

/** The view the table paints: my seat's, or null at home. */
export const viewOf = (app: App): View | null => app.shell.view;
export { viewFor };

/** \`#handoffBtn\`'s offer: seat 0 hosts, seat 1 joins by invite. */
export const handoffLabel = (game: State): string =>
  \`Continue online: \${game.game.names[0]} hosts, \${game.game.names[1]} joins by invite\`;

/** The resume box's line for an offer. */
export const resumeLabel = (resume: Resume): string => {
  switch (resume.kind) {
    case 'local':
      return \`Resume pass & play: \${resume.game.game.names[0]} vs \${resume.game.game.names[1]}\`;
    case 'host':
      return resume.handoff && resume.game !== null
        ? handoffLabel(resume.game)
        : \`Resume hosting room \${resume.code}\`;
    case 'guest':
      return \`Rejoin room \${resume.code}\`;
  }
};
`;

const stateTestTs = (hidden: boolean): string => `import { describe, expect, test } from 'vitest';

import { NOW, runIntents } from '../../../../../test/shared/engine-helpers.ts';
import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { MAX_TURNS } from '../engine/engine.ts';
import {
  cuesBetween,
  handoffLabel,
  initialApp,
  pauseFor,
  reduce,
  resumeLabel,
  viewOf,
  type App,
  type Intent,
} from './state.ts';

const ctx = { rng: mulberry32(7), now: () => NOW };
const run = runIntents(reduce, ctx);

const localClick: Intent = { type: 'local/click', p1: 'Ann', p2: 'Bob' };
const pass: Intent = { type: 'act', action: { type: 'pass' } };
const reveal: Intent = { type: 'curtain/reveal' };

/** A pass-and-play table, seat 0's view, the curtain lifted when the game raises one. */
const started = (): App => {
  const s = run(initialApp, localClick).app;
  return s.table.curtain === null ? s : run(s, reveal).app;
};

describe('pass and play', () => {
  test('the start: seat 0 first, the names defaulted when empty, the curtain as the game hides or not', () => {
    const s = run(initialApp, localClick);
    expect(s.app.shell.role).toBe('local');
    expect(s.app.shell.game?.game.names).toEqual(['Ann', 'Bob']);
    expect(s.app.shell.screen).toBe('tableScreen');
    expect(s.app.table.curtain).toBe(${hidden ? '0' : 'null'});
    const defaults = run(initialApp, { type: 'local/click', p1: '', p2: '' });
    expect(defaults.app.shell.game?.game.names).toEqual(['Ari', 'Lavi']);
  });

  test('a pass hands the view to the other seat${hidden ? ', under the curtain,' : ''} with the cue; a play out of turn is refused', () => {
    const app = started();
    expect(viewOf(app)?.seat).toBe(0);
    const passed = run(app, pass);
    expect(passed.app.shell.game?.game.turns).toBe(1);
    expect(viewOf(passed.app)?.seat).toBe(1);
    expect(passed.app.table.curtain).toBe(${hidden ? '1' : 'null'});
    const cues = passed.effects.filter((e) => e.type === 'fx').map((e) => (e as { cue: string }).cue);
    expect(cues).toContain('tap');
    expect(cues).toContain('pass');
    const over = run(app, { type: 'act', action: { type: 'again' } });
    expect(over.effects.map((e) => e.type)).toContain('toast');
  });

  test('the end is a pause the shell holds: nothing moves meanwhile, Continue clears it for the result, Play again deals the same seats anew', () => {
    const app = started();
    const resigned = run(app, { type: 'act', action: { type: 'resign' } }).app;
    expect(resigned.shell.game?.game.result).toEqual({ kind: 'win', winner: 1, by: 'resign' });
    expect(resigned.shell.pause).toEqual({ title: 'Bob wins!', detail: 'Ann resigned.' });
    const stuck = run(resigned, { type: 'act', action: { type: 'again' } }).app;
    expect(stuck.shell.game?.game.result).not.toBeNull();
    const cleared = run(resigned, { type: 'pause/continue' }).app;
    expect(cleared.shell.pause).toBeNull();
    const again = run(cleared, { type: 'again/click' }).app;
    expect(again.shell.game?.game.result).toBeNull();
    expect(again.shell.game?.game.turns).toBe(0);
    expect(again.shell.game?.game.names).toEqual(['Ann', 'Bob']);
  });

  test('the draw after MAX_TURNS passes ends the game on a pause too', () => {
    const end = Array.from({ length: MAX_TURNS }).reduce<App>((a, _, i) => {
      const next = run(a, pass).app;
      return i < MAX_TURNS - 1 && next.table.curtain !== null ? run(next, reveal).app : next;
    }, started());
    expect(end.shell.game?.game.result).toMatchObject({ kind: 'win', by: 'luck' });
    expect(end.shell.pause?.title).toMatch(/wins!$/);
  });
});

describe('the helpers', () => {
  test('cuesBetween, pauseFor, the labels', () => {
    const app = started();
    const v0 = viewOf(app);
    const v1 = viewOf(run(app, pass).app);
    if (v0 === null || v1 === null) throw new Error('no view');
    expect(cuesBetween(v0, v1)).toEqual(['pass']);
    expect(cuesBetween(v0, v0)).toEqual([]);
    expect(pauseFor(v0, v1)).toBeNull();
    const game = app.shell.game;
    if (game === null) throw new Error('no game');
    expect(handoffLabel(game)).toBe('Continue online: Ann hosts, Bob joins by invite');
    expect(resumeLabel({ kind: 'local', game })).toBe('Resume pass & play: Ann vs Bob');
    expect(resumeLabel({ kind: 'guest', code: 'ABCD', name: 'x' } as never)).toBe('Rejoin room ABCD');
  });
});
`;

const renderTs = (
  slug: string,
  pascal: string,
  upper: string,
  title: string,
): string => `// ${title}'s paint (docs/design/${slug}.md §3): the App onto the composed shell page (page.ts) through the
// DOM edge, and every control bound to an intent. The shell's half is web/shared/ui's (the screens,
// the waiting rooms, the home tabs, the sheets, the curtain); the table is this file's: the names
// strip (\`#myName\`, \`#oppName\`, \`#oppDot\`), the board slot (\`#board\`: TODO, the game's own), the
// status line, Pass and Resign while the game is on, and the result sheet after the end's pause
// (the shell's sheet, cleared by Continue) with Play again.
import {
  requireId,
  setDisabled,
  setText,
  toggleClass,
  type DocumentLike,
  type PageLike,
} from '../../../../shared/edge/dom.ts';
import {
  bindCurtain,
  curtainText as shellCurtainText,
  paintCurtain as paintShellCurtain,
} from '../../../../shared/ui/curtain.ts';
import { handoffLabelOf } from '../../../../shared/ui/shell.ts';
import {
  bindButtons,
  bindShellSheets,
  paintResult,
  paintShellChrome,
  paintShellSheets,
  type Dispatch,
} from '../../../../shared/ui/shellPaint.ts';
import { turnSeat, type Seat, type View } from '../engine/view.ts';
import { bindHome, paintHome } from './home.ts';
import { ${upper}, endWords, type App, type Intent, type ${pascal} } from './state.ts';

export { hideToast, showToast } from '../../../../shared/ui/shellPaint.ts';

const nameAt = (v: View, seat: Seat): string => v.names[seat];

/** The status line: the engine's note of what just happened, then whose turn (or the end). */
export const statusText = (v: View): string => {
  const turn = turnSeat(v.game);
  if (turn === null) return v.game.note;
  const whose = turn === v.seat ? 'Your turn' : \`\${nameAt(v, turn)}’s turn\`;
  return \`\${v.game.note} \${whose}.\`.trim();
};

const paintTable = (doc: DocumentLike, app: App, v: View): void => {
  const turn = turnSeat(v.game);
  const mine = turn === v.seat;
  const over = v.game.result !== null;
  toggleClass(requireId(doc, 'board'), 'turn', mine);
  toggleClass(requireId(doc, 'passBtn'), 'hidden', !mine);
  setDisabled(requireId(doc, 'passBtn'), !mine);
  toggleClass(requireId(doc, 'resignBtn'), 'hidden', !mine);
  setDisabled(requireId(doc, 'resignBtn'), !mine);
  toggleClass(requireId(doc, 'againBtn'), 'hidden', !(over && app.shell.pause === null));
  setText(requireId(doc, 'statusText'), statusText(v));
  // The end's words on the result sheet once its pause (the shell's) was read.
  const end = endWords(v);
  paintResult(doc, over && app.shell.pause === null, end === null ? null : { title: end.title, score: end.detail });
};

/** The curtain for the seat the phone goes to (ui/state.ts \`viewer\`): its name and the last note; hidden when no seat waits. The button is the page's \`revealLabel\`; "Continue online" shows under it when the shell says the game can go on as a room. */
const paintCurtain = (doc: DocumentLike, app: App): void => {
  const seat = app.table.curtain;
  const v = app.shell.view;
  paintShellCurtain(
    doc,
    seat === null || v === null ? null : shellCurtainText({ to: nameAt(v, seat), sub: '', last: v.game.note }),
    handoffLabelOf(app.shell, ${upper}) !== null,
  );
};

/** The shell's sheets (the rules, the history with the recent games, the pause the page opts into), off the shell's own flags. */
const paintOverlays = (doc: DocumentLike, app: App): void => {
  paintShellSheets(doc, app.shell);
};

/** The shell's chrome first (the screens, the rooms, the 🌐, the dot and the names strip off the view), then the page's own. */
export const paint = (doc: PageLike, app: App): void => {
  paintShellChrome(doc, app.shell, {
    handoff: handoffLabelOf(app.shell, ${upper}),
    connDot: 'oppDot',
    names: (v) => ({ me: nameAt(v, v.seat), others: nameAt(v, v.seat === 0 ? 1 : 0) }),
  });
  paintHome(doc, app);
  const v = app.shell.view;
  if (v !== null) paintTable(doc, app, v);
  paintCurtain(doc, app);
  paintOverlays(doc, app);
};

const bindTable = (doc: PageLike, dispatch: Dispatch<Intent>): void => {
  bindButtons(
    doc,
    dispatch,
    [
      ['passBtn', { type: 'act', action: { type: 'pass' } }],
      ['resignBtn', { type: 'act', action: { type: 'resign' } }],
      ['againBtn', { type: 'again/click' }],
      ['rsAgainBtn', { type: 'again/click' }],
      ['rsLeaveBtn', { type: 'leave/request' }],
      ['leaveBtn', { type: 'leave/request' }],
      ['soundBtn', { type: 'sound/toggle' }],
      ['handoffBtn', { type: 'handoff/click' }],
      ['rulesBtnGame', { type: 'rules/open' }],
      ['historyBtn', { type: 'history/open' }],
    ],
    { skipDisabled: true },
  );
};

/** Every control of the page (home, table, sheets), once, at boot. */
export const bindAll = (doc: PageLike, dispatch: Dispatch<Intent>): void => {
  bindHome(doc, dispatch);
  bindTable(doc, dispatch);
  bindCurtain<${pascal}>(doc, dispatch);
  bindShellSheets<${pascal}>(doc, dispatch);
};
`;

const mainTs = (
  slug: string,
  upper: string,
  pascal: string,
  title: string,
  hook: string,
): string => `// Boot (docs/ARCHITECTURE.md "Module boundaries": main.ts constructs the adapters and injects them;
// no logic; docs/design/${slug}.md §3). ${title} boots through the shared boot
// (web/shared/edge/boot.ts \`bootShell\`, docs/design/shared-shell.md §4.5): the browser's page
// (\`browserPage\`), the real Transport, \`Math.random\` (or the harness's \`window.__rng\`), Web Audio,
// vibration and the wake lock, handed to the reducer (src/ui/state.ts), the sessions (src/net) and
// the paint (src/ui/render.ts). \`window.${hook}\` (the documented test hook) is the boot's: \`act\`,
// \`view\`, \`game\`, \`setup\`, \`legal\` and the shared rest; a game's own members go under \`hooks.hook\`.
import { bootShell, browserPage } from '../../shared/edge/boot.ts';
import { legalActions } from './src/engine/view.ts';
import { SESSIONS } from './src/net/sessions.ts';
import { bindAll, paint } from './src/ui/render.ts';
import { ABOUT_PARAGRAPHS, GLOSSARY, RULES_ITEMS } from './src/ui/rules.ts';
import {
  reducer,
  ${upper},
  type App,
  type ${pascal},
} from './src/ui/state.ts';

bootShell<${pascal}, App>({
  page: browserPage(),
  game: { hook: '${hook}', title: '${title.replace(/'/g, "\\'")}', debug: 0 },
  reducer,
  paint: { paint, bindAll },
  config: ${upper},
  copy: { rules: RULES_ITEMS, about: ABOUT_PARAGRAPHS, glossary: GLOSSARY },
  net: SESSIONS,
  legal: legalActions,
});
`;

const pageTs = (slug: string, upper: string, title: string, hidden: boolean): string => {
  const quoted = title.replace(/"/g, '&quot;');
  const tsTitle = title.replace(/'/g, "\\'");
  // The title inside a single-quoted TS string that becomes an attribute value: both escapes.
  const headTitle = quoted.replace(/'/g, "\\'");
  return `// ${title}'s shell page (docs/design/${slug}.md §3; docs/design/dry-round-2.md §3 row G2): what
// tools/shell-markup.ts fills web/shared/markup/shell/*.html with to compose ./index.html, which
// test/dist/shell-markup.test.ts pins byte for byte. The home is the shell's (the host card, the
// join card, Online or Pass the phone, the Rules tab), with no field of its own: two seats. The
// residue here (\`blocks\`) is the head, the table (the names strip, the board slot, the controls,
// the status line) and the result sheet; the Open Graph card is assets/splash.svg rendered to
// web/public/games/${slug}/splash.png.
import { GUEST_SEAT_NAME, THEME_LOOK, headHtml } from '../../shared/markup/page.ts';
import {
  type ShellBlocks,
  type ShellCopy,
  type ShellNotes,
  resultMarkup,
  type ShellPage,
} from '../../shared/markup/shell.ts';
import { topbarHtml } from '../../shared/markup/topbar.ts';

// The shell's words (web/shared/markup/shell.ts SHELL_COPY) but for a table of two, and the four
// only this game knows.
const copy: ShellCopy = {
  localNote: ${
    hidden
      ? "'One phone, no internet needed. A curtain hides the table as the phone changes hands.'"
      : "'One phone, no internet needed. Nothing is hidden: the view changes hands with the turn.'"
  },
  hostWaitSubtitle: 'Have your opponent open this same page and enter the code',
  keepOpenNote:
    'Keep this screen open while your opponent sits down. If you switch apps, come straight back and the table reconnects on its own.',
  startLabel: 'Start',
  revealLabel: 'Show the table',
  historyTitle: 'History',
};

const notes: ShellNotes = {
  homeNote: \` (docs/design/${slug}.md §3): Online (the default) or Pass the phone, two players.\`,
  rulesTabNote: ': ui/rules.ts fills both slots at boot (shellPaint.ts renderCopy).',
  glossaryDoc: 'glossary-links.md',
  aboutClose: '',
  curtainNote: ${
    hidden
      ? "': raised on every change of turn (ui/state.ts `viewer`): a seat holds something the other must not see.'"
      : "': composed by the shell, never raised: nothing is hidden, so both players share the one screen (ui/state.ts `viewer`).'"
  },
};

const blocks: ShellBlocks = {
  head: headHtml({
    slug: '${slug}',
    name: '${headTitle}',
    share: '${headTitle} for two. Pass one phone, or open a table online.',
    imageAlt: '${headTitle}',
    description: '${headTitle} for two: pass one phone, or open a table online.',
  }),
  masthead: \`        <div class="masthead">
          <h1>${quoted}</h1>
          <div class="subtitle">TODO: one line on what the game is</div>
        </div>\`,
  hostFields: \`              <button class="btn btn-go btn-block" id="hostBtn">Open a table</button>\`,
  localFields: \`            <div class="card-box">
              <div class="row">
                <input type="text" id="p1NameInput" class="grow" placeholder="Player 1" maxlength="20" autocomplete="off" />
                <input type="text" id="p2NameInput" class="grow" placeholder="Player 2" maxlength="20" autocomplete="off" />
              </div>
            </div>\`,
  guestSeatName: GUEST_SEAT_NAME,
  table: \`      <!-- TABLE (docs/design/${slug}.md §3): the names strip (me, the other seat and its connection),
           the board slot (TODO: the game's own markup, painted by render.ts), the status line and
           the controls. -->
      <div id="tableScreen" class="hidden">
\${topbarHtml({ dot: 'last', between: '<span class="vs">vs</span>', indent: '        ' })}
        <div class="board" id="board" aria-label="The table"></div>
        <p class="status-line" id="statusText" aria-live="polite"></p>
        <div class="controls">
          <button class="btn btn-secondary grow hidden" id="passBtn">Pass</button>
          <button class="btn btn-ghost grow hidden" id="resignBtn">Resign</button>
          <button class="btn btn-go grow hidden" id="againBtn">Play again</button>
        </div>
      </div>\`,
  // No endgame block: the shell's placeholder says the game ends on the result sheet over the table.
  result: resultMarkup({
    note: 'the end over the final table, after its pause (the owner: "understand what happened before proceeding"); Play again starts anew.',
    score: 'note',
    primary: { id: 'rsAgainBtn', label: 'Play again' },
    secondary: { id: 'rsLeaveBtn', label: 'Leave the table' },
  }),
};

/** The pause (\`pause: true\`, the shell's partial): the end held until Continue (ui/state.ts \`pauseFor\`). */
export const ${upper}_PAGE: ShellPage = { copy, notes, look: THEME_LOOK, blocks, pause: true };
// The title the shell heading, the share sheet and the registry spell: '${tsTitle}'.
`;
};

const themeCss = (
  slug: string,
  title: string,
): string => `/* ${title}'s theme (docs/design/${slug}.md §3). The page links web/shared/styles/tokens.css, base.css
   and shell.css before this file: the home, the waiting rooms, the sheets, the curtain and the
   toast are the shell's rules on the shared palette, and this file adds the game's one accent, the
   type scale the shell leaves to each theme, and the table. TODO: the accent, the board. Prettier
   formats this file. */
:root {
  --gutter: 12px;
  /* The one accent (AGENT.md "Theme: subtle, not gaudy"): TODO, the game's own. */
  --accent: #6c8cd5;
  --accent-dark: #4a66a8;
  --emphasis: var(--accent);
}
@media (min-width: 900px) {
  :root {
    --gutter: 16px;
  }
}

/* ---------- the shell's type scale ---------- */
html,
body {
  background: var(--felt);
}
.card-box {
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.btn-primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-dark));
  color: #fff;
}
.btn-ghost {
  border: 1px solid rgba(255, 255, 255, 0.15);
}
h1 {
  font-size: 2.2rem;
  line-height: 1.1;
  margin: 10px 0 0;
  letter-spacing: 0.04em;
  color: var(--accent);
}
.masthead {
  margin: 4px 0 14px;
}
.subtitle {
  font-size: 0.95rem;
  line-height: 1.4;
  margin: 4px 0 14px;
}
.card-box.centered,
.centered {
  text-align: center;
}
input[type='text'] {
  padding: 13px 14px;
  background: #0d2418;
  font-size: 1.05rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  min-height: 48px;
}
label {
  display: block;
  letter-spacing: 0.06em;
}
.row.between {
  justify-content: space-between;
}
.muted {
  color: var(--muted);
}
.room-code {
  letter-spacing: 0.3em;
  padding-left: 0.3em;
  margin: 6px 0 10px;
}
.tab-btn,
.mode-btn {
  min-height: 44px;
  cursor: pointer;
}
.tab-btn.active {
  box-shadow: inset 0 -2px 0 var(--accent);
}
.rules-list li {
  font-size: 0.92rem;
  line-height: 1.4;
}

/* ---------- the table ---------- */
/* The topbar (page.ts, the shared topbarHtml partial): the leave button, the names strip and the
   icon buttons in one row. */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
/* The board slot: the game's own markup goes here (render.ts). Lit on the viewing seat's turn. */
.board {
  min-height: 40vh;
  margin: 8px 0;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 12px;
}
.board.turn {
  border-color: var(--accent);
}
.controls {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
`;

const splashSvg = (
  slug: string,
  title: string,
): string => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <!-- ${title}'s link-preview card (docs/design/link-previews.md): the name on the shared felt with
       the one accent. TODO: the game's own drawing. tools/splash.ts renders it to
       web/public/games/${slug}/splash.png. -->
  <rect width="1200" height="630" fill="#0f2a1c" />
  <circle cx="300" cy="315" r="150" fill="none" stroke="#6c8cd5" stroke-width="12" />
  <text x="560" y="340" font-family="Georgia, serif" font-size="120" font-weight="700" fill="#6c8cd5">${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
  <text x="564" y="410" font-family="Helvetica, Arial, sans-serif" font-size="40" fill="#e8e1cf">For two. Pass one phone, or play online.</text>
</svg>
`;

const e2eFixtureTs = (
  slug: string,
  title: string,
  hook: string,
  hidden: boolean,
): string => `// ${title}'s fixtures (docs/design/${slug}.md §3): the seat's view read through the documented hook
// (\`window.${hook}.view()\`), the pass-and-play start over the shell's (two names, the Pass the phone
// switch${hidden ? ', the first curtain lifted' : '; no curtain: the table is on show at once'}), and one turn played through the hook (\`legal()\` -> \`act(a)\`).
import { expect, type Page } from '@playwright/test';

import type { Action, View } from '../../web/games/${slug}/src/engine/view.ts';
import type { Viewport } from './geometry.ts';
import { ${hidden ? 'reveal, ' : ''}startLocal } from './shell.ts';

export type { View };

/** The seat's view the page holds, or null before a table is up. */
export const readView = (page: Page): Promise<View | null> =>
  page.evaluate<View | null>('window.${hook}.view()');

/** A view the page must have (the table is up); throws with the reason otherwise. */
export const requireView = async (page: Page): Promise<View> => {
  const view = await readView(page);
  if (view === null) throw new Error('the page holds no game view');
  return view;
};

/** What every seat's table agrees on: the game's clock, whose turn, the turns taken, the result. */
export const ${slug}Key = (v: View | null): string =>
  v === null ? 'none' : JSON.stringify([v.startedAt, v.game.turn, v.game.turns, v.game.result]);

export const ${slug}Snapshot = async (page: Page): Promise<string> => ${slug}Key(await readView(page));

/** Pass the phone between two names at \`viewport\`: the shell's start; resolves with the table up, seat 0's view. */
export const ${slug}StartLocal = async (
  page: Page,
  url: string,
  viewport: Viewport,
  names: readonly [string, string] = ['Ann', 'Bob'],
): Promise<void> => {
  await startLocal(page, url, viewport, [names[0], names[1]]);
  ${hidden ? 'await reveal(page);' : "await expect(page.locator('#curtainOverlay')).toBeHidden();"}
};

/** One action through the hook, as the seat holding the phone. */
export const ${slug}Act = async (page: Page, action: Action): Promise<void> => {
  await page.evaluate(\`window.${hook}.act(\${JSON.stringify(action)})\`);
};

/** The seat holding the phone plays its first legal action; resolves once the turn is the other seat's (or the game is over). */
export const ${slug}PlayTurn = async (page: Page): Promise<void> => {
  const { game } = await requireView(page);
  const legal = await page.evaluate<ReadonlyArray<Action>>('window.${hook}.legal()');
  const first = legal[0];
  if (first === undefined) throw new Error(\`${slug}: seat \${String(game.turn)} has nothing to play\`);
  await ${slug}Act(page, first);
  await expect.poll(async () => (await requireView(page)).game.turn).not.toBe(game.turn);
};
`;

const e2eSpecTs = (
  slug: string,
  title: string,
  hidden: boolean,
): string => `// ${title} pass-and-play through the shared shell (docs/design/${slug}.md §3): a two-seat game on the
// shell page at a phone. Pass the phone with two names, Start${hidden ? ', lift the curtain,' : ','} and the table is seat 0's;
// a Pass hands it to seat 1${hidden ? ' under the curtain' : ' on screen'}; Resign ends the game on the shell's pause sheet, whose
// Continue clears it for the result sheet and Play again. On \`pages\` alone: this is about the page, not the origin.
// The shell's own flows (the home, the room, the handoff, resume) are the shell specs' \`@${slug}\` describes.
import { PHONE } from './fixtures/geometry.ts';
import { requireView, ${slug}StartLocal } from './fixtures/${slug}.ts';
${hidden ? "import { reveal } from './fixtures/shell.ts';\n" : ''}import { pagePath } from './fixtures/site.ts';
import { expect, test } from './fixtures/two-players.ts';

const NAMES = ['Ari', 'Lavi'] as const;

test('pass, resign, continue at a phone', async ({ phone, project }) => {
  test.skip(project !== 'pages', 'about the page, not the origin');
  const { page } = phone;
  await ${slug}StartLocal(page, pagePath(project, '${slug}'), PHONE, [...NAMES]);
  await expect(page).toHaveTitle(${JSON.stringify(title)});
  await expect(page.locator('#myName')).toHaveText(NAMES[0]);
  await expect(page.locator('#oppName')).toHaveText(NAMES[1]);
  expect(await requireView(page)).toMatchObject({ seat: 0, game: { turn: 0, turns: 0 } });

  await page.locator('#passBtn').click();
  ${hidden ? "await expect(page.locator('#curtainOverlay')).toBeVisible();\n  await reveal(page);" : "await expect(page.locator('#curtainOverlay')).toBeHidden();"}
  await expect(page.locator('#myName')).toHaveText(NAMES[1]);
  await expect(page.locator('#statusText')).toContainText('Your turn');

  await page.locator('#resignBtn').click();
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  await expect(page.locator('#pauseTitle')).toHaveText(\`\${NAMES[0]} wins!\`);
  await page.locator('#continueBtn').click();
  await expect(page.locator('#pauseOverlay')).toBeHidden();
  await expect(page.locator('#resultOverlay')).toBeVisible();
  await expect(page.locator('#rsTitle')).toHaveText(\`\${NAMES[0]} wins!\`);
  await expect(page.locator('#againBtn')).toBeVisible();
  expect((await requireView(page)).game.result).toEqual({ kind: 'win', winner: 0, by: 'resign' });
});
`;

const designMd = (spec: NewGameSpec): string => {
  const { slug, title, seats, hidden } = spec;
  return `# ${title}

TODO: the published rules for the games site. Scaffolded by \`npm run new-game\` (docs/design/new-game.md)
with ${seats.min === seats.max ? `${String(seats.min)} seats` : `${String(seats.min)} to ${String(seats.max)} seats`} and ${hidden ? 'a hidden hand (the pass-and-play curtain rises on every turn)' : 'nothing hidden (no curtain)'}.
Every section below is a TODO row until the rules land; the placeholder engine (Pass, Resign, a
seeded draw after ten passes) is what the scaffold plays until then.

## 1. Sources

- TODO: the official rules, with the link.
- TODO: a second source that agrees on every rule the engine plays.

## 2. The rules as the engine plays them

TODO: the deck or pieces, a turn, the special cases, scoring, the end. The engine is
\`web/games/${slug}/src/engine/engine.ts\`: \`Game\`, \`Intent\`, \`apply(game, intent, rng)\`; its test
plays whole bot games at every seat count with the counts checked at every step.

## 3. The page

On the shared shell (AGENT.md "Every game is a shared-shell game"): \`page.ts\` composes the home,
\`shellConfig.ts\` is the \`ShellGameData\`, \`src/ui/state.ts\` the reducer with the \`table.pause\` adapter every
consequential event is raised through (the shell holds it until its \`pause/continue\`), \`src/ui/sound.ts\`
the cue table over \`SHELL_CUES\`, \`src/ui/render.ts\` the table's paint. Seats: ${String(seats.min)}-${String(seats.max)}.
${
  seats.min < seats.max
    ? `TODO: the scaffold seats two; the stepper, the seat names and the N-seat engine are Flip 7's shape (docs/design/flip7.md §8): \`stepperHtml\` in \`page.ts\`, \`bindStepper\` in \`ui/home.ts\`, \`seats {min, max}\` in \`shellConfig.ts\`. The CONFORMANCE row declares the \`stepper\` and \`seat-names\` gaps until then.`
    : 'Two seats: no stepper.'
}

## 4. The Rules tab (one screen)

The items in \`src/ui/rules.ts\` (\`RULES_ITEMS\`), the goal first, then the turn, then one line per
special case, fitting 390x844 with no scroll:

- Goal: TODO
- A turn: TODO
- TODO: one line per special case

## 5. Tests and the suite

\`npm run test:${slug}\` (the engine, the view adapters, the reducer, the shell config, the rules, the
cues), the conformance suite (\`npm run test:harness\`), \`e2e/${slug}.spec.ts\` at a phone. TODO: raise
the coverage thresholds in \`tools/ci/suites.ts\` as the engine lands.
`;
};

/** Every file the scaffold writes, repo-relative, in the order they are written. */
export const generatedFiles = (spec: NewGameSpec): ReadonlyArray<GeneratedFile> => {
  const n = namesOf(spec);
  const g = `web/games/${n.slug}`;
  return [
    { path: `${g}/page.ts`, content: pageTs(n.slug, n.upper, n.title, spec.hidden) },
    { path: `${g}/theme.css`, content: themeCss(n.slug, n.title) },
    { path: `${g}/main.ts`, content: mainTs(n.slug, n.upper, n.pascal, n.title, n.hook) },
    { path: `${g}/assets/splash.svg`, content: splashSvg(n.slug, n.title) },
    { path: `${g}/src/engine/engine.ts`, content: engineTs(n.slug, n.title) },
    { path: `${g}/src/engine/engine.test.ts`, content: engineTestTs(n.slug, n.title) },
    { path: `${g}/src/engine/view.ts`, content: viewTs(n.slug, n.title) },
    { path: `${g}/src/engine/view.test.ts`, content: viewTestTs(n.title) },
    { path: `${g}/src/protocol.ts`, content: protocolTs(n.slug, n.title) },
    { path: `${g}/src/net/sessions.ts`, content: sessionsTs(n.slug, n.title) },
    { path: `${g}/src/storage.ts`, content: storageTs(n.slug, n.title) },
    {
      path: `${g}/src/shellConfig.ts`,
      content: shellConfigTs(n.slug, n.upper, n.pascal, n.title),
    },
    { path: `${g}/src/shellConfig.test.ts`, content: shellConfigTestTs(n.upper) },
    { path: `${g}/src/ui/home.ts`, content: homeTs(n.slug, n.pascal) },
    { path: `${g}/src/ui/rules.ts`, content: rulesTs(n.slug, n.title) },
    { path: `${g}/src/ui/rules.test.ts`, content: rulesTestTs() },
    { path: `${g}/src/ui/sound.ts`, content: soundTs(n.slug, n.title) },
    { path: `${g}/src/ui/sound.test.ts`, content: soundTestTs() },
    {
      path: `${g}/src/ui/state.ts`,
      content: stateTs(n.slug, n.upper, n.pascal, n.title, spec.hidden),
    },
    { path: `${g}/src/ui/state.test.ts`, content: stateTestTs(spec.hidden) },
    { path: `${g}/src/ui/render.ts`, content: renderTs(n.slug, n.pascal, n.upper, n.title) },
    {
      path: `e2e/fixtures/${n.slug}.ts`,
      content: e2eFixtureTs(n.slug, n.title, n.hook, spec.hidden),
    },
    { path: `e2e/${n.slug}.spec.ts`, content: e2eSpecTs(n.slug, n.title, spec.hidden) },
    { path: `docs/design/${n.slug}.md`, content: designMd(spec) },
  ];
};
