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
  cueStep,
  fx,
  guestContextOf as shellGuestContextOf,
  hostContextOf as shellHostContextOf,
  initialShell as shellInitial,
  isShellIntent,
  localBroadcast,
  pure,
  readHome as shellReadHome,
  reduceShell,
  resumeFor as shellResumeFor,
  step,
  toast,
  withShell,
  type Ctx,
  type CueMachine,
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
  type CueMemory,
} from '../../../../shared/ui/shell.ts';
import { runShellEffect, type ShellEffectDeps } from '../../../../shared/ui/shellEffects.ts';
import { applyAction, viewFor, type Action, type State, type View } from '../engine/view.ts';
import { action as actionFrame } from '../protocol.ts';
import { UNO_SHELL } from '../shellConfig.ts';
import {
  DEFAULT_PLAY_MODE,
  HOME_TABS,
  type HomeTab,
  type Opts,
  type PlayMode,
  type Save,
  type Store,
} from '../storage.ts';
import { cuesBetween, type Cue } from './sound.ts';

export { DEFAULT_PLAY_MODE, HOME_TABS, cuesBetween, type HomeTab, type PlayMode };

/** The raw option values `host/click` and `local/click` carry: the two seat-count steppers (the third to twelfth names ride as the shell's `names`). */
export type Raw = Readonly<{
  players?: string;
  localPlayers?: string;
  names?: ReadonlyArray<string>;
}>;

/** Nothing beyond the shell's keys: the seat count is the shell's `prefs.opts`, the third to twelfth names its `prefs.seatNames`. */
export type Home = object;

export type Table = Readonly<{
  /** The pass-and-play seat the curtain names, or null (the shell writes it, `local.viewer`). */
  curtain: number | null;
}>;

export type TableIntent = Readonly<{ type: 'act'; action: Action }>;

export type TableEffect = never;

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

export const initialTable: Table = { curtain: null };

const refuse = (app: App, message: string): Step => step(app, toast(message));

/**
 * The paint's cues (the shell's `cueStep`): one key per position, so a re-sent frame plays
 * nothing; sound.ts `cuesBetween` for the change (the card's kind, the penalty, the deal); "your
 * turn" when an online turn lands on my seat while the game is on.
 */
const CUE_MACHINE: CueMachine<Uno> = {
  key: (v) =>
    `${String(v.startedAt)}:${String(v.drawCount)}:${v.top.id}:${String(v.turn)}:${v.phase}`,
  between: cuesBetween,
  myTurn: (v) => v.winner === null && v.turn === v.seat,
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
  // The shell's reset: a start, the handoff, a leave and the host lost start the table over.
  table: { initial: initialTable, rendered: cueStep(CUE_MACHINE) },
  local: { viewer, revealer },
  home: { ...UNO_SHELL.home, apply: (app) => app },
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

/** The table's one intent: a tap's click, then the action by role (the sheets and Escape are the shell's). */
const tableIntent = (app: App, intent: TableIntent, ctx: Ctx): Step =>
  then(step(app, fx('tap')), (a) => act(a, intent.action, ctx));

/** The seat count the current game or offer is played at (the handoff is a two-seat room). */
const seatCountOf = (app: App): number => {
  const s = app.shell;
  if (s.role === 'local' && s.game !== null) return s.game.game.names.length;
  return s.resume?.kind === 'local' ? s.resume.game.game.names.length : 2;
};

/** The shell's `local/click` seats two to twelve (its `seatNames` where the click carries none) and deals through `engine.create`. */
export const reduce = (app: App, intent: Intent, ctx: Ctx): Step => {
  if (intent.type === 'handoff/click' && seatCountOf(app) !== 2) return pure(app);
  return isShellIntent(intent) ? reduceShell(app, intent, ctx, UNO) : tableIntent(app, intent, ctx);
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

/** Every effect is the shell's (the seat count's write is its `writeOpts`, a seat name's its `rememberSeatName`). */
export const runEffect = (app: App, effect: Effect, deps: EffectDeps): void => {
  runShellEffect(app.shell, effect, deps, UNO);
};

/** The view the table paints: my seat's, or null at home. */
export const viewOf = (app: App): View | null => app.shell.view;
export { viewFor };

/** The seats' names in order: the shell's labels read them (web/shared/lib/name.ts `handoffLabel`, `resumeLabel`). */
export const namesOf = (game: State): ReadonlyArray<string> => game.game.names;
