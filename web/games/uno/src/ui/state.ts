// UNO's reducer on the shared shell (docs/design/uno.md §9; web/shared/ui/shell.ts): the shell's
// flows (the home screen, the waiting rooms, the curtain, the leave, the resume) over this game's
// config (shellConfig.ts `UNO_SHELL` completed here as `UNO`), and the table's own intents. Every
// role plays through `act`: pass-and-play and the host apply the action to the engine and
// broadcast each seat its own view, a guest sends one `action` frame and waits for its view. In
// pass-and-play the curtain comes up whenever the turn moves to another seat, and the round's
// result is everyone's (no curtain). Pure: the shuffles and the clock come in through `Ctx`.
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
  type SeatState,
  type ShellApp,
  type ShellConfig,
  type ShellState,
  type Step as SharedStep,
  type TableReset,
} from '../../../../shared/ui/shell.ts';
import { runShellEffect, type ShellEffectDeps } from '../../../../shared/ui/shellEffects.ts';
import {
  applyAction,
  createState,
  viewFor,
  type Action,
  type State,
  type View,
} from '../engine/view.ts';
import { action as actionFrame } from '../protocol.ts';
import { UNO_SHELL, parseOpts, seatNames } from '../shellConfig.ts';
import {
  DEFAULT_PLAY_MODE,
  HOME_TABS,
  writeOpts,
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

/** The raw option values `host/click` and `local/click` carry: the two seat-count selects and the third and fourth names. */
export type Raw = Readonly<{ players?: string; localPlayers?: string; p3?: string; p4?: string }>;

/** What `initHome` reads beyond the shell's keys: the remembered seat count. */
export type Home = Readonly<{ opts: Opts }>;

export type Table = Readonly<{
  /** The pass-and-play seat the curtain names, or null (the shell writes it, `local.viewer`). */
  curtain: number | null;
  /** `#historyOverlay` open. */
  historyOpen: boolean;
}>;

export type TableIntent =
  | Readonly<{ type: 'act'; action: Action }>
  | Readonly<{ type: 'opts/set'; raw: Raw }>
  | Readonly<{ type: 'rules/open' }>
  | Readonly<{ type: 'rules/close' }>
  | Readonly<{ type: 'history/open' }>
  | Readonly<{ type: 'history/close' }>
  | Readonly<{ type: 'escape' }>;

export type TableEffect = Readonly<{ type: 'writeOpts'; opts: Opts }>;

/** UNO's types for the shared shell: two to four seats, the seat count as the room's terms. */
export type Uno = Readonly<{
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
  Seat: Exclude<Seat, 0 | 1>;
}>;

/** A seat at the table: the host (or the first player) is 0; twelve at most. */
export type Seat = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type Shell = ShellState<Uno>;
export type App = ShellApp<Uno>;
export type Intent = SharedIntent<Uno>;
export type Effect = SharedEffect<Uno>;
export type Step = SharedStep<Uno>;
export type Resume = SharedResume<Uno>;
export type HomeSnapshot = SharedHomeSnapshot<Uno>;

export const initialTable: Table = { curtain: null, historyOpen: false };

const fx = (cue: Cue | 'tap'): Effect => ({ type: 'fx', cue });

const refuse = (app: App, message: string): Step => step(app, toast(message));

/** The cues for the change from `prev` to `next` as `role` hears it: a card played, a draw, a round won or lost. */
export const cuesBetween = (prev: View, next: View): ReadonlyArray<Cue> => {
  if (next.winner !== null && prev.winner === null)
    return [next.winner === next.seat ? 'win' : 'lose'];
  if (next.top.id !== prev.top.id) return ['play'];
  return next.drawCount < prev.drawCount ? ['draw'] : [];
};

/** One key per position, so a re-sent frame plays nothing. */
const cueKey = (v: View): string =>
  `${String(v.startedAt)}:${String(v.round)}:${String(v.drawCount)}:${v.top.id}:${String(v.turn)}:${v.phase}`;

/**
 * The state side of a paint: the table is the screen while a view is held; the cues come from the
 * change since `prev`, once per position, and "your turn" when an online turn lands on my seat.
 */
const rendered = (app: App, prev: View | null): Step => {
  const view = app.shell.view;
  if (view === null) return pure(app);
  const key = cueKey(view);
  const fresh = prev !== null && key !== app.shell.cues.key;
  const online = app.shell.role === 'host' || app.shell.role === 'guest';
  const myTurnNow =
    online && fresh && view.turn === view.seat && prev.turn !== view.seat && view.winner === null;
  const cues: ReadonlyArray<Cue> = fresh
    ? [...cuesBetween(prev, view), ...(myTurnNow ? (['yourTurn'] as const) : [])]
    : [];
  return step(
    { shell: { ...app.shell, cues: { key }, screen: 'tableScreen' }, table: app.table },
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
      return table;
  }
};

/** Whose turn it is, or null once the round is over (the result is everyone's). */
const actorOf = (game: State): number | null => {
  const kind = game.game.phase.kind;
  return kind === 'roundOver' || kind === 'gameOver' ? null : game.game.turn;
};

/**
 * `localBroadcast`'s seat: the actor's view while the round is on, the phone holder's once it is
 * over; the curtain comes up when the phone must change hands and the incoming seat has not lifted
 * it this turn.
 */
const viewer: ShellConfig<Uno>['local']['viewer'] = (app, game) => {
  const actor = actorOf(game);
  const holder = app.shell.view?.seat ?? app.shell.revealed ?? game.game.turn;
  const seat = (actor ?? holder) as Seat;
  const curtain = actor !== null && app.shell.revealed !== seat ? seat : null;
  return { seat, curtain, effects: [] };
};

const revealer: ShellConfig<Uno>['local']['revealer'] = (game) => ({
  seat: game.game.turn as Seat,
  effects: [],
});

export const UNO: ShellConfig<Uno> = {
  ...UNO_SHELL,
  table: { initial: initialTable, reset, rendered, refuse },
  local: { viewer, revealer },
  home: {
    ...UNO_SHELL.home,
    apply: (app, home) => ({ shell: { ...app.shell, opts: home.opts }, table: app.table }),
    resume: (home) => resumeFor(home.save),
    resumeExtra: pure,
  },
};

export const initialShell: Shell = shellInitial(UNO);
export const initialApp: App = { shell: initialShell, table: initialTable };

/** Pass-and-play: the seat whose turn it is acts (any seat deals the next round); a new round lowers the curtain for its first player. */
const localAct = (app: App, action: Action, ctx: Ctx): Step => {
  const game = app.shell.game;
  if (game === null) return pure(app);
  const res = applyAction(game, game.game.turn, action, ctx.rng);
  if (!res.ok) return refuse(app, res.error);
  const fresh = res.value.game.round !== game.game.round;
  return localBroadcast(
    withShell(app, { game: res.value, revealed: fresh ? null : app.shell.revealed }),
    false,
    ctx,
    UNO,
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
      const res = applyAction(game, 0, action, ctx.rng);
      if (!res.ok) return refuse(app, res.error);
      return broadcast(withShell(app, { game: res.value }), ctx, UNO);
    }
    case 'guest':
    case null:
      return app.shell.role === 'guest' && app.shell.oppConnected
        ? step(app, { type: 'send', frame: actionFrame(action) })
        : refuse(app, NOT_CONNECTED_MSG);
  }
};

const tableIntent = (app: App, intent: TableIntent, ctx: Ctx): Step => {
  switch (intent.type) {
    case 'act':
      return then(step(app, fx('tap')), (a) => act(a, intent.action, ctx));
    case 'opts/set': {
      const opts = parseOpts(intent.raw, app.shell.opts);
      return step(withShell(app, { opts }), { type: 'writeOpts', opts });
    }
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
      return pure(app.shell.rulesOpen ? withShell(app, { rulesOpen: false }) : app);
  }
};

/** The seat count the current game or offer is played at (the handoff is a two-seat room). */
const seatCountOf = (app: App): number => {
  const s = app.shell;
  if (s.role === 'local' && s.game !== null) return s.game.game.names.length;
  return s.resume?.kind === 'local' ? s.resume.game.game.names.length : 2;
};

/**
 * `local/click` for two, three or four seats: the seat count off the raw inputs, the names off the
 * first `seatCount` inputs through the shared `localSeats` rule with this game's defaults, the game
 * dealt and handed to the shared `startLocal`, then the seat count remembered.
 */
const localStart = (
  app: App,
  intent: Readonly<{ p1: string; p2: string }> & Raw,
  ctx: Ctx,
): Step => {
  const opts = parseOpts(intent, app.shell.opts);
  const raws = [intent.p1, intent.p2, intent.p3 ?? '', intent.p4 ?? ''].slice(0, opts.seatCount);
  const seats = localSeats(raws, localNamesOf(UNO_SHELL));
  const game = createState(seatNames(opts.seatCount, seats), ctx.rng, ctx.now);
  return then(startLocal(withShell(app, { opts }), game, ctx, UNO), (a) =>
    step(a, { type: 'writeOpts', opts }),
  );
};

export const reduce = (app: App, intent: Intent, ctx: Ctx): Step => {
  if (intent.type === 'local/click') return localStart(app, intent, ctx);
  if (intent.type === 'handoff/click' && seatCountOf(app) !== 2) return pure(app);
  if (!isShellIntent(intent)) return tableIntent(app, intent, ctx);
  const shell = reduceShell(app, intent, ctx, UNO);
  return intent.type === 'host/click'
    ? then(shell, (a) => step(a, { type: 'writeOpts', opts: a.shell.opts }))
    : shell;
};

/** The resume box `initHome` shows, or null (a finished game is not offered). */
export const resumeFor = (save: Save | null): Resume | null => shellResumeFor(save, UNO);

export const readHome = (store: Store): HomeSnapshot => shellReadHome(store, UNO);

/** The host session's context: the shell's fields, the seat count and the guest seats (net/host.ts `HostContext`). */
export type HostContext = HostContextOf<Uno> & Opts & Readonly<{ seats: ReadonlyArray<SeatState> }>;
export type GuestContext = GuestContextOf;

export const hostContextOf = (app: App): HostContext => ({
  ...shellHostContextOf(app.shell),
  seats: app.shell.seats,
});

export const guestContextOf = (app: App): GuestContext => shellGuestContextOf(app.shell);

export type EffectDeps = ShellEffectDeps<Uno>;

/** One effect against the adapters: the seat count's write, then the shell's runner. */
export const runEffect = (app: App, effect: Effect, deps: EffectDeps): void => {
  if (isShellEffect(effect)) {
    runShellEffect(app.shell, effect, deps, UNO);
    return;
  }
  writeOpts(deps.store, effect.opts);
};

/** The view the table paints: my seat's, or null at home. */
export const viewOf = (app: App): View | null => app.shell.view;
export { viewFor };

/** "Ann", "Ann and Cara", "Ann, Cara and Dan". */
export const listNames = (names: ReadonlyArray<string>): string =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;

/** The resume box's players: "Ann vs Bob" at two (the shell's form), the list past two. */
export const seatNamesText = (names: ReadonlyArray<string>): string =>
  names.length <= 2 ? names.join(' vs ') : listNames(names);

/** `#handoffBtn`'s offer: seat 0 hosts, seat 1 joins by invite. */
export const handoffLabel = (game: State): string =>
  `Continue online: ${game.game.names[0] ?? ''} hosts, ${game.game.names[1] ?? ''} joins by invite`;

/** The resume box's line for an offer. */
export const resumeLabel = (resume: Resume): string => {
  switch (resume.kind) {
    case 'local':
      return `Resume pass & play: ${seatNamesText(resume.game.game.names)}`;
    case 'host':
      return resume.handoff && resume.game !== null
        ? handoffLabel(resume.game)
        : `Resume hosting room ${resume.code}`;
    case 'guest':
      return `Rejoin room ${resume.code}`;
  }
};
