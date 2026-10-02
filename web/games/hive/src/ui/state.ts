// Hive's reducer on the shared shell (docs/design/hive.md §7; web/shared/ui/shell.ts): the shell's
// flows (the home screen, the waiting rooms, the leave, the resume) over this game's config
// (shellConfig.ts `HIVE_SHELL` completed here as `HIVE`), and the table's own intents: a tap on a
// hand tile shows where it may be placed, a tap on a board tile where it may move, a tap on a lit
// hex plays. Every role plays through `act`: pass-and-play and the host apply the action to the
// engine and broadcast each seat its view, a guest sends one `action` frame and waits for its
// view. Pass-and-play raises no curtain (the owner, 2026-10-02: "hive is like backgammon, where
// you don't need to pass the phone for turns. It's just a game."): nothing is hidden, so both
// players share the one screen and the view changes hands as the turn does, the way backgammon's
// does with its curtain off; the game's end is a sheet over the final board whose Continue leaves
// the board on show. Pure: the clock comes in through `Ctx`; Hive rolls nothing.
import {
  NOT_CONNECTED_MSG,
  andThen as then,
  broadcast,
  guestContextOf as shellGuestContextOf,
  hostContextOf as shellHostContextOf,
  initialShell as shellInitial,
  isShellEffect,
  isShellIntent,
  localBroadcast,
  localNamesOf,
  localSeats,
  pure,
  readHome as shellReadHome,
  reduceShell,
  resumeFor as shellResumeFor,
  startLocal,
  step,
  toast,
  withShell,
  withTable,
  type Ctx,
  type Effect as SharedEffect,
  type GuestContextOf,
  type HomeSnapshot as SharedHomeSnapshot,
  type HostContextOf,
  type Intent as SharedIntent,
  type Resume as SharedResume,
  type ShellApp,
  type ShellConfig,
  type ShellState,
  type Step as SharedStep,
  type TableReset,
} from '../../../../shared/ui/shell.ts';
import { runShellEffect, type ShellEffectDeps } from '../../../../shared/ui/shellEffects.ts';
import { keyOf, sameHex, type Hex } from '../engine/hex.ts';
import type { Bug } from '../engine/pieces.ts';
import {
  applyAction,
  createState,
  turnSeat,
  viewFor,
  type Action,
  type Seat,
  type State,
  type View,
} from '../engine/view.ts';
import { action as actionFrame } from '../protocol.ts';
import { HIVE_SHELL } from '../shellConfig.ts';
import {
  DEFAULT_PLAY_MODE,
  HOME_TABS,
  type HomeTab,
  type Opts,
  type PlayMode,
  type Save,
  type Store,
} from '../storage.ts';
import { INITIAL_CUES, type Cue, type CueState } from './sound.ts';

export { DEFAULT_PLAY_MODE, HOME_TABS, INITIAL_CUES, type CueState, type HomeTab, type PlayMode };

export const SCREENS = [
  'homeScreen',
  'hostWaitScreen',
  'guestWaitScreen',
  'tableScreen',
  'endgameScreen',
] as const;
export type ScreenId = (typeof SCREENS)[number];

/** `host/click` and `local/click` carry nothing beyond the names: a game for two has no option (the field is never set). */
export type Raw = Readonly<{ seats?: never }>;

/** `initHome` reads nothing beyond the shell's keys. */
export type Home = Readonly<{ opts?: never }>;

/** What the player has picked up: a bug from the hand, or a tile on the board. */
export type Picked = Readonly<{ kind: 'hand'; bug: Bug }> | Readonly<{ kind: 'hex'; hex: Hex }>;

export type Table = Readonly<{
  /** The shell's pass-and-play curtain seat (`ShellTypes.Table`; the shell writes it from `local.viewer`): always null here, Hive raises none. */
  curtain: Seat | null;
  picked: Picked | null;
  /** A tile dragged by hand (ui/dragger.ts): the lit hex it is over while the drag lasts; `picked` is its source. */
  drag: Readonly<{ over: Hex | null }> | null;
  /** The result sheet's Continue was tapped: the final board stays on show. */
  resultSeen: boolean;
  /** `#historyOverlay` open. */
  historyOpen: boolean;
}>;

export type TableIntent =
  | Readonly<{ type: 'act'; action: Action }>
  | Readonly<{ type: 'pick/hand'; bug: Bug }>
  | Readonly<{ type: 'tap/hex'; hex: Hex }>
  | Readonly<{ type: 'pick/clear' }>
  | Readonly<{ type: 'drag/start'; picked: Picked }>
  | Readonly<{ type: 'drag/over'; hex: Hex | null }>
  | Readonly<{ type: 'drag/end' }>
  | Readonly<{ type: 'result/continue' }>
  | Readonly<{ type: 'rules/open' }>
  | Readonly<{ type: 'rules/close' }>
  | Readonly<{ type: 'history/open' }>
  | Readonly<{ type: 'history/close' }>
  | Readonly<{ type: 'escape' }>;

export type TableEffect = never;

/** Hive's types for the shared shell: two seats, no option, the whole game as every seat's view. */
export type Hive = Readonly<{
  Opts: Opts;
  Raw: Raw;
  State: State;
  View: View;
  Action: Action;
  Table: Table;
  Tab: HomeTab;
  Mode: PlayMode;
  Screen: ScreenId;
  Timer: never;
  Cue: Cue;
  Cues: CueState;
  Resume: never;
  Home: Home;
  Intent: TableIntent;
  Effect: TableEffect;
  Store: Store;
  Seat: never;
}>;

export type Shell = ShellState<Hive>;
export type App = ShellApp<Hive>;
export type Intent = SharedIntent<Hive>;
export type Effect = SharedEffect<Hive>;
export type Step = SharedStep<Hive>;
export type Resume = SharedResume<Hive>;
export type HomeSnapshot = SharedHomeSnapshot<Hive>;

export const initialTable: Table = {
  curtain: null,
  picked: null,
  drag: null,
  resultSeen: false,
  historyOpen: false,
};

const fx = (cue: Cue | 'tap'): Effect => ({ type: 'fx', cue });

const refuse = (app: App, message: string): Step =>
  step(withTable(app, { picked: null, drag: null }), toast(message));

/** The cues for the change from `prev` to `next`: a tile placed or moved, the game won or lost. */
export const cuesBetween = (prev: View, next: View): ReadonlyArray<Cue> => {
  const result = next.game.result;
  if (result !== null && prev.game.result === null) {
    if (result.kind === 'draw') return [];
    return [result.winner === (next.seat === 0 ? 'white' : 'black') ? 'win' : 'lose'];
  }
  const placed =
    Object.values(next.game.board).flat().length > Object.values(prev.game.board).flat().length;
  const moved = !placed && next.game.turns !== prev.game.turns && turnsOf(next) > turnsOf(prev);
  return placed ? ['place'] : moved ? ['move'] : [];
};

const turnsOf = (v: View): number => v.game.turns.white + v.game.turns.black;

/** One key per position, so a re-sent frame plays nothing. */
const cueKey = (v: View): string =>
  `${String(v.startedAt)}:${String(turnsOf(v))}:${v.game.turn}:${v.game.result === null ? 'on' : 'over'}`;

/**
 * The state side of a paint: the table is the screen while a view is held; the cues come from the
 * change since `prev`, once per position, and "your turn" when an online turn lands on my seat. A
 * new position drops the pick; a new game (its clock) drops the result sheet's memory.
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
  // A rematch: its clock, or (on a clock that stood still) the result cleared.
  const newGame =
    prev?.startedAt !== view.startedAt || (prev.game.result !== null && view.game.result === null);
  const table: Table = {
    ...app.table,
    picked: fresh || newGame ? null : app.table.picked,
    drag: newGame ? null : app.table.drag,
    resultSeen: newGame ? false : app.table.resultSeen,
  };
  return step(
    { shell: { ...app.shell, cues: { key }, screen: 'tableScreen' }, table },
    ...cues.map(fx),
  );
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
      return { ...table, picked: null, drag: null };
  }
};

/**
 * `localBroadcast`'s seat: the actor's view while the game is on, the phone holder's once it is
 * over. Never a curtain: Hive hides nothing, so the view just changes hands on screen (as
 * backgammon's does with its curtain off) and `#curtainOverlay` stays as the shell composed it,
 * hidden.
 */
const viewer: ShellConfig<Hive>['local']['viewer'] = (app, game) => {
  const actor = turnSeat(game.game);
  const holder: Seat = app.shell.view?.seat ?? app.shell.revealed ?? 0;
  return { seat: actor ?? holder, curtain: null, effects: [] };
};

/** `curtain/reveal` never fires (no curtain comes up); the shell's `position/load` reads the seat to move off this. */
const revealer: ShellConfig<Hive>['local']['revealer'] = (game) => ({
  seat: turnSeat(game.game) ?? 0,
  effects: [],
});

export const HIVE: ShellConfig<Hive> = {
  ...HIVE_SHELL,
  table: { initial: initialTable, reset, rendered, refuse },
  local: { viewer, revealer },
  home: {
    ...HIVE_SHELL.home,
    apply: (app) => app,
    resume: (home) => resumeFor(home.save),
    resumeExtra: pure,
  },
};

export const initialShell: Shell = shellInitial(HIVE);
export const initialApp: App = { shell: initialShell, table: initialTable };

/** Pass-and-play: the seat whose turn it is acts (either seat may play again); a new game shows White's view. */
const localAct = (app: App, action: Action, ctx: Ctx): Step => {
  const game = app.shell.game;
  if (game === null) return pure(app);
  const seat = turnSeat(game.game) ?? app.shell.view?.seat ?? 0;
  const res = applyAction(game, seat, action, ctx.now);
  if (!res.ok) return refuse(app, res.error);
  const fresh = action.type === 'again';
  return localBroadcast(
    withShell(app, { game: res.value, revealed: fresh ? null : app.shell.revealed }),
    false,
    ctx,
    HIVE,
  );
};

/** `act(action)` by role: pass-and-play and the host apply and broadcast; a guest sends one `action` frame. */
const act = (app: App, action: Action, ctx: Ctx): Step => {
  switch (app.shell.role) {
    case 'local':
      return localAct(app, action, ctx);
    case 'host': {
      const game = app.shell.game;
      if (game === null) return pure(app);
      const res = applyAction(game, 0, action, ctx.now);
      if (!res.ok) return refuse(app, res.error);
      return broadcast(withShell(app, { game: res.value }), ctx, HIVE);
    }
    case 'guest':
    case null:
      return app.shell.role === 'guest' && app.shell.oppConnected
        ? step(withTable(app, { picked: null }), { type: 'send', frame: actionFrame(action) })
        : refuse(app, NOT_CONNECTED_MSG);
  }
};

/** Where the picked tile may go, off the view: a hand bug's placements, a board tile's moves. */
export const reachable = (view: View, picked: Picked | null): ReadonlyArray<Hex> => {
  if (picked === null) return [];
  if (picked.kind === 'hand')
    return view.placements.filter((p) => p.bug === picked.bug).map((p) => p.to);
  return view.movable.find((m) => sameHex(m.from, picked.hex))?.to ?? [];
};

/** The bugs the viewing seat may place now (its turn, the Queen alone on the fourth tile). */
export const placeableNow = (view: View): ReadonlySet<Bug> =>
  new Set(view.placements.map((p) => p.bug));

/** The pick played to `hex` (a tap on a lit hex, a drop on one): the tap cue, then the action through `act`. */
const play = (app: App, picked: Picked, hex: Hex, ctx: Ctx): Step => {
  const action: Action =
    picked.kind === 'hand'
      ? { type: 'place', bug: picked.bug, to: hex }
      : { type: 'move', from: picked.hex, to: hex };
  return then(step(app, fx('tap')), (a) =>
    act(withTable(a, { picked: null, drag: null }), action, ctx),
  );
};

/** Whether the pick may go to `hex` now. */
const canReach = (view: View, picked: Picked | null, hex: Hex): boolean =>
  picked !== null && reachable(view, picked).some((h) => sameHex(h, hex));

/**
 * A tap on a hex: a lit hex plays the pick; one of my movable tiles becomes the pick; anything else
 * clears it. The click a drag's release fires reaches the board too: while the drag stands it is nothing.
 */
const tapHex = (app: App, hex: Hex, ctx: Ctx): Step => {
  const view = app.shell.view;
  if (view === null || app.table.drag !== null) return pure(app);
  const picked = app.table.picked;
  if (picked !== null && canReach(view, picked, hex)) return play(app, picked, hex, ctx);
  const movable = view.movable.some((m) => sameHex(m.from, hex));
  const same = picked?.kind === 'hex' && sameHex(picked.hex, hex);
  return pure(withTable(app, { picked: movable && !same ? { kind: 'hex', hex } : null }));
};

/** Whether `picked` may be picked up now: a bug I may place, or one of my movable tiles. */
const pickable = (view: View, picked: Picked): boolean =>
  picked.kind === 'hand'
    ? placeableNow(view).has(picked.bug)
    : view.movable.some((m) => sameHex(m.from, picked.hex));

/** `drag/start`: the tile pressed becomes the pick (its hexes light) and the drag stands; a tile not mine to lift is nothing. */
const dragStart = (app: App, picked: Picked): Step => {
  const view = app.shell.view;
  if (view === null || !pickable(view, picked)) return pure(app);
  return pure(withTable(app, { picked, drag: { over: null } }));
};

/** `drag/over`: the lit hex the ghost is over, or none; a hex the pick cannot reach counts as none. */
const dragOver = (app: App, hex: Hex | null): Step => {
  const view = app.shell.view;
  const d = app.table.drag;
  if (view === null || d === null) return pure(app);
  const over = hex !== null && canReach(view, app.table.picked, hex) ? hex : null;
  const same = over === d.over || (over !== null && d.over !== null && sameHex(over, d.over));
  return same ? pure(app) : pure(withTable(app, { drag: { over } }));
};

/** `drag/end`: over a lit hex the pick is played there; anywhere else the pick is dropped. */
const dragEnd = (app: App, ctx: Ctx): Step => {
  const view = app.shell.view;
  const d = app.table.drag;
  const picked = app.table.picked;
  if (view === null || d === null) return pure(withTable(app, { drag: null }));
  if (picked !== null && d.over !== null && canReach(view, picked, d.over))
    return play(app, picked, d.over, ctx);
  return pure(withTable(app, { picked: null, drag: null }));
};

const tableIntent = (app: App, intent: TableIntent, ctx: Ctx): Step => {
  switch (intent.type) {
    case 'act':
      return then(step(app, fx('tap')), (a) => act(a, intent.action, ctx));
    case 'pick/hand': {
      const view = app.shell.view;
      if (app.table.drag !== null) return pure(app);
      const same = app.table.picked?.kind === 'hand' && app.table.picked.bug === intent.bug;
      const can = view !== null && placeableNow(view).has(intent.bug);
      return pure(
        withTable(app, { picked: can && !same ? { kind: 'hand', bug: intent.bug } : null }),
      );
    }
    case 'tap/hex':
      return tapHex(app, intent.hex, ctx);
    case 'pick/clear':
      return app.table.drag !== null ? pure(app) : pure(withTable(app, { picked: null }));
    case 'drag/start':
      return dragStart(app, intent.picked);
    case 'drag/over':
      return dragOver(app, intent.hex);
    case 'drag/end':
      return dragEnd(app, ctx);
    case 'result/continue':
      return pure(withTable(app, { resultSeen: true }));
    case 'rules/open':
      return pure(withShell(app, { rulesOpen: true }));
    case 'rules/close':
      return pure(withShell(app, { rulesOpen: false }));
    case 'history/open':
      return pure(withTable(app, { historyOpen: true }));
    case 'history/close':
      return pure(withTable(app, { historyOpen: false }));
    case 'escape':
      if (app.table.historyOpen) return pure(withTable(app, { historyOpen: false }));
      if (app.shell.rulesOpen) return pure(withShell(app, { rulesOpen: false }));
      return pure(withTable(app, { picked: null }));
  }
};

/** `local/click`: the two names through the shared `localSeats` rule with this game's defaults, White first. */
const localStart = (app: App, intent: Readonly<{ p1: string; p2: string }>, ctx: Ctx): Step => {
  const seats = localSeats([intent.p1, intent.p2], localNamesOf(HIVE_SHELL));
  const game = createState([seats[0]?.name ?? '', seats[1]?.name ?? ''], ctx.now);
  return startLocal(app, game, ctx, HIVE);
};

export const reduce = (app: App, intent: Intent, ctx: Ctx): Step => {
  if (intent.type === 'local/click') return localStart(app, intent, ctx);
  if (!isShellIntent(intent)) return tableIntent(app, intent, ctx);
  return reduceShell(app, intent, ctx, HIVE);
};

/** The resume box `initHome` shows, or null (a finished game is not offered). */
export const resumeFor = (save: Save | null): Resume | null => shellResumeFor(save, HIVE);

export const readHome = (store: Store): HomeSnapshot => shellReadHome(store, HIVE);

export type HostContext = HostContextOf<Hive>;
export type GuestContext = GuestContextOf;

export const hostContextOf = (app: App): HostContext => shellHostContextOf(app.shell);
export const guestContextOf = (app: App): GuestContext => shellGuestContextOf(app.shell);

export type EffectDeps = ShellEffectDeps<Hive>;

/** One effect against the adapters: the shell's runner (the table has none of its own). */
export const runEffect = (app: App, effect: Effect, deps: EffectDeps): void => {
  if (isShellEffect(effect)) runShellEffect(app.shell, effect, deps, HIVE);
};

/** The view the table paints: my seat's, or null at home. */
export const viewOf = (app: App): View | null => app.shell.view;
export { keyOf, viewFor };

/** `#handoffBtn`'s offer: White hosts, Black joins by invite. */
export const handoffLabel = (game: State): string =>
  `Continue online: ${game.game.names.white} hosts, ${game.game.names.black} joins by invite`;

/** The resume box's line for an offer. */
export const resumeLabel = (resume: Resume): string => {
  switch (resume.kind) {
    case 'local':
      return `Resume pass & play: ${resume.game.game.names.white} vs ${resume.game.game.names.black}`;
    case 'host':
      return resume.handoff && resume.game !== null
        ? handoffLabel(resume.game)
        : `Resume hosting room ${resume.code}`;
    case 'guest':
      return `Rejoin room ${resume.code}`;
  }
};
