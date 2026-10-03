// UNO's reducer on the shared shell (docs/design/uno.md §9; web/shared/ui/shell.ts): the shell's
// flows (the home screen, the waiting rooms, the curtain, the leave, the resume) over this game's
// config (shellConfig.ts `UNO_SHELL` completed here as `UNO`), and the table's own intents. Every
// role plays through `act`: pass-and-play and the host apply the action to the engine and
// broadcast each seat its own view, a guest sends one `action` frame and waits for its view. In
// pass-and-play the curtain comes up whenever the turn moves to another seat, and the game's
// result is everyone's (no curtain). One round is the game (the owner, 2026-10-02): the first
// empty hand wins, and Play again deals the same seats anew. Pure: the shuffles and the clock come
// in through `Ctx`.
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
  type CueMemory,
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
  EXTRA_NAME_PREFS,
  EXTRA_SEATS,
  HOME_TABS,
  writeOpts,
  type HomeTab,
  type Opts,
  type PlayMode,
  type Save,
  type Store,
} from '../storage.ts';
import { cuesBetween, type Cue } from './sound.ts';

export { DEFAULT_PLAY_MODE, HOME_TABS, cuesBetween, type HomeTab, type PlayMode };

/** The raw option values `host/click` and `local/click` carry: the two seat-count steppers and the third to twelfth names. */
export type Raw = Readonly<{
  players?: string;
  localPlayers?: string;
  names?: ReadonlyArray<string>;
}>;

/** The names of the seats past the shell's two as last typed, index 0 the third seat; null where nothing was. */
export type ExtraNames = ReadonlyArray<string | null>;
export const NO_EXTRA_NAMES: ExtraNames = EXTRA_SEATS.map(() => null);

/** What `initHome` reads beyond the shell's keys: the remembered seat count and the third to twelfth names. */
export type Home = Readonly<{ opts: Opts; extraNames: ExtraNames }>;

export type Table = Readonly<{
  /** The pass-and-play seat the curtain names, or null (the shell writes it, `local.viewer`). */
  curtain: number | null;
  /** `#historyOverlay` open. */
  historyOpen: boolean;
  /** The third to twelfth pass-and-play names as last typed (web/shared/ui/seatNames.ts paints them). */
  extraNames: ExtraNames;
}>;

export type TableIntent =
  | Readonly<{ type: 'act'; action: Action }>
  | Readonly<{ type: 'opts/set'; raw: Raw }>
  | Readonly<{ type: 'pname/typed'; seat: number; value: string }>
  | Readonly<{ type: 'rules/open' }>
  | Readonly<{ type: 'rules/close' }>
  | Readonly<{ type: 'history/open' }>
  | Readonly<{ type: 'history/close' }>
  | Readonly<{ type: 'escape' }>;

export type TableEffect =
  | Readonly<{ type: 'writeOpts'; opts: Opts }>
  | Readonly<{ type: 'rememberPName'; seat: number; name: string }>;

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
  Screen: never;
  Timer: never;
  Cue: Cue;
  Cues: CueMemory;
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

export const initialTable: Table = {
  curtain: null,
  historyOpen: false,
  extraNames: NO_EXTRA_NAMES,
};

const fx = (cue: Cue | 'tap'): Effect => ({ type: 'fx', cue });

const refuse = (app: App, message: string): Step => step(app, toast(message));

/** One key per position, so a re-sent frame plays nothing. */
const cueKey = (v: View): string =>
  `${String(v.startedAt)}:${String(v.drawCount)}:${v.top.id}:${String(v.turn)}:${v.phase}`;

/**
 * The state side of a paint: the table is the screen while a view is held; the cues come from the
 * change since `prev` (sound.ts `cuesBetween`: the card's kind, the penalty, the deal), once per
 * position, and "your turn" when an online turn lands on my seat.
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
      return { ...initialTable, extraNames: table.extraNames };
    case 'deal':
    case 'view':
    case 'applied':
    case 'frame':
      return table;
  }
};

/** Whose turn it is, or null once the game is won (the result is everyone's). */
const actorOf = (game: State): number | null =>
  game.game.phase.kind === 'gameOver' ? null : game.game.turn;

/**
 * `localBroadcast`'s seat: the actor's view while the game is on, the phone holder's once it is
 * won; the curtain comes up when the phone must change hands and the incoming seat has not lifted
 * it this turn.
 */
const viewer: ShellConfig<Uno>['local']['viewer'] = (app, game) => {
  const actor = actorOf(game);
  const holder = app.shell.view?.seat ?? app.shell.revealed ?? game.game.turn;
  const seat = (actor ?? holder) as Seat;
  const curtain = actor !== null && app.shell.revealed !== seat ? seat : null;
  return { seat, curtain };
};

const revealer: ShellConfig<Uno>['local']['revealer'] = (game) => ({
  seat: game.game.turn as Seat,
});

export const UNO: ShellConfig<Uno> = {
  ...UNO_SHELL,
  table: { initial: initialTable, reset, rendered },
  local: { viewer, revealer },
  home: {
    ...UNO_SHELL.home,
    apply: (app, home) => ({
      shell: { ...app.shell, opts: home.opts },
      table: { ...app.table, extraNames: home.extraNames },
    }),
  },
};

export const initialShell: Shell = shellInitial(UNO);
export const initialApp: App = { shell: initialShell, table: initialTable };

/** Pass-and-play: the seat whose turn it is acts (any seat deals again); a new game lowers the curtain for its first player. */
const localAct = (app: App, action: Action, ctx: Ctx): Step => {
  const game = app.shell.game;
  if (game === null) return pure(app);
  const res = applyAction(game, game.game.turn, action, ctx.rng, ctx.now);
  if (!res.ok) return refuse(app, res.error);
  const fresh = action.type === 'again';
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
      const res = applyAction(game, 0, action, ctx.rng, ctx.now);
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
    case 'pname/typed':
      return step(
        withTable(app, {
          extraNames: app.table.extraNames.map((name, i) =>
            i === intent.seat - 2 ? (intent.value === '' ? null : intent.value) : name,
          ),
        }),
        { type: 'rememberPName', seat: intent.seat, name: intent.value },
      );
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
 * `local/click` for two to twelve seats: the seat count off the raw inputs, the names off the first
 * `seatCount` inputs (the third on carried in `Raw.names`, else as last typed) through the shared
 * `localSeats` rule with this game's defaults, the game dealt and handed to the shared
 * `startLocal`, then the seat count remembered.
 */
const localStart = (
  app: App,
  intent: Readonly<{ p1: string; p2: string }> & Raw,
  ctx: Ctx,
): Step => {
  const opts = parseOpts(intent, app.shell.opts);
  const extra = EXTRA_SEATS.map((_, i) => intent.names?.[i] ?? app.table.extraNames[i] ?? '');
  const raws = [intent.p1, intent.p2, ...extra].slice(0, opts.seatCount);
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
export type HostContext = HostContextOf<Uno>;
export type GuestContext = GuestContextOf;

export const hostContextOf = (app: App): HostContext => shellHostContextOf(app.shell);

export const guestContextOf = (app: App): GuestContext => shellGuestContextOf(app.shell);

export type EffectDeps = ShellEffectDeps<Uno>;

/** One effect against the adapters: the seat count's write, a seat name's, then the shell's runner. */
export const runEffect = (app: App, effect: Effect, deps: EffectDeps): void => {
  if (isShellEffect(effect)) {
    runShellEffect(app.shell, effect, deps, UNO);
    return;
  }
  switch (effect.type) {
    case 'writeOpts':
      writeOpts(deps.store, effect.opts);
      return;
    case 'rememberPName':
      EXTRA_NAME_PREFS[effect.seat - 2]?.write(deps.store, effect.name);
      return;
  }
};

/** The view the table paints: my seat's, or null at home. */
export const viewOf = (app: App): View | null => app.shell.view;
export { viewFor };

/** The seats' names in order: the shell's labels read them (web/shared/lib/name.ts `handoffLabel`, `resumeLabel`). */
export const namesOf = (game: State): ReadonlyArray<string> => game.game.names;
