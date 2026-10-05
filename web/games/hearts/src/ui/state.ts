// Hearts's reducer on the shared shell (docs/design/hearts.md §3; web/shared/ui/shell.ts): the shell's
// flows (the home screen, the waiting rooms, the leave, the resume) over this game's config
// (shellConfig.ts `HEARTS_SHELL` completed here as `HEARTS`), and the table's own intents. Every role
// plays through `act`: pass-and-play and the host apply the action to the engine and broadcast each
// seat its view, a guest sends one `action` frame and waits for its view. Pass-and-play raises the curtain on every change of turn: a seat holds something the other must not see (AGENT.md "Hidden hands").
// The game's end is a pause (AGENT.md "Understand what happened before proceeding"): the shell's
// pause sheet holds the table until Continue (`table.pause` below), then the result sheet offers
// Play again (the shell's `again/click`). Pure: the clock and the rng come in through `Ctx`.
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
import { HEARTS_SHELL } from '../shellConfig.ts';
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

/** `host/click` and `local/click` carry nothing beyond the names: a game for two has no option. */
export type Raw = Readonly<{ seats?: never }>;

/** `initHome` reads nothing beyond the shell's keys. */
export type Home = Readonly<{ opts?: never }>;

/** The table's own state: the curtain seat alone (the sheets, the pause and the result are the shell's, `ShellState`). */
export type Table = Readonly<{
  /** The shell's pass-and-play curtain seat (`ShellTypes.Table`; the shell writes it from `local.viewer`). */
  curtain: Seat | null;
}>;

/** The table's one intent: a play; the sheets (`rules/*`, `history/*`, `escape`) are the shell's intents. */
export type TableIntent = Readonly<{ type: 'act'; action: Action }>;

export type TableEffect = never;

/** Hearts's types for the shared shell (`GameTypes` over what it names; the rest are the shell's defaults): two seats, no option, the whole game as every seat's view. */
export type Hearts = GameTypes<{
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

export type Shell = ShellState<Hearts>;
export type App = ShellApp<Hearts>;
export type Intent = SharedIntent<Hearts>;
export type Effect = SharedEffect<Hearts>;
export type Step = SharedStep<Hearts>;
export type Resume = SharedResume<Hearts>;
export type HomeSnapshot = SharedHomeSnapshot<Hearts>;

export const initialTable: Table = { curtain: null };

const fx = (cue: Cue | 'tap'): Effect => ({ type: 'fx', cue });

/** The cues for the change from `prev` to `next`: a pass taken, the game won or lost. */
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
        : `${view.names[result.winner]} wins!`;
  return { title, detail: view.game.note };
};

/** The shell's `table.pause` adapter (AGENT.md "Understand what happened before proceeding"): the pause a new view raises against the one it replaces: the end, with how it came; a cold paint raises none. */
export const pauseFor = (prev: View | null, next: View): Pause | null =>
  prev?.game.result !== null ? null : endWords(next);

/** One key per position, so a re-sent frame plays nothing. */
const cueKey = (v: View): string =>
  `${String(v.startedAt)}:${String(v.game.turns)}:${String(v.game.turn)}:${v.game.result === null ? 'on' : 'over'}`;

/**
 * The state side of a paint: the table is the screen while a view is held; the cues come from the
 * change since `prev`, once per position, and "your turn" when an online turn lands on my seat
 * (the end's pause is the shell's, through `table.pause`).
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
 * `localBroadcast`'s seat: the actor's view while the game is on, the phone holder's once it is
 * over. The curtain rises whenever the seat to view is not the one that lifted it last.
 */
const viewer: ShellConfig<Hearts>['local']['viewer'] = (app, game) => {
  const actor = turnSeat(game.game);
  const holder: Seat = app.shell.view?.seat ?? app.shell.revealed ?? 0;
  const seat = actor ?? holder;
  const curtain = actor !== null && app.shell.revealed !== seat ? seat : null;
  return { seat, curtain };
};

/** `curtain/reveal`: whoever must act lifts the curtain, and acts from this phone (the shell's `act`); the shell's `position/load` reads the seat to move off this. */
const revealer: ShellConfig<Hearts>['local']['revealer'] = (game) => ({
  seat: turnSeat(game.game) ?? 0,
});

export const HEARTS: ShellConfig<Hearts> = {
  ...HEARTS_SHELL,
  // The end is a pause (the shell holds it until Continue; nothing moves meanwhile); Play again is the shell's `again/click`.
  table: {
    initial: initialTable,
    reset,
    rendered,
    pause: (_app, prev, view) => pauseFor(prev, view),
  },
  local: { viewer, revealer },
};

/** `act(action)`: the shell's by role (the mover acts on a pass-and-play phone: `revealer`; a pause up holds it there). */
const act = (app: App, action: Action, ctx: Ctx): Step => shellAct(app, action, ctx, HEARTS);

/** A play with its tap: the table's one intent (the sheets are the shell's, reduced before this). */
const tableIntent = (app: App, intent: TableIntent, ctx: Ctx): Step =>
  then(step(app, fx('tap')), (a) => act(a, intent.action, ctx));

/**
 * The boot's reducer block (web/shared/ui/shellReducer.ts): the shell's flows over `HEARTS` and
 * the table's intents; every effect is the shell's (the table has none of its own). The
 * pass-and-play start is the shell's `local/click` (the two names through its `localSeats` rule
 * with this game's defaults, then `engine.create`): a game writes its own only where the start
 * depends on something the shell cannot see (docs/design/fidice-shell-adoption.md §9).
 */
export const reducer = shellReducer(HEARTS, {
  intent: tableIntent,
});
export const { initialApp, reduce, runEffect, readHome, resumeFor, hostContextOf, guestContextOf } =
  reducer;

/** The view the table paints: my seat's, or null at home. */
export const viewOf = (app: App): View | null => app.shell.view;
export { viewFor };

/** `#handoffBtn`'s offer: seat 0 hosts, seat 1 joins by invite. */
export const handoffLabel = (game: State): string =>
  `Continue online: ${game.game.names[0]} hosts, ${game.game.names[1]} joins by invite`;

/** The resume box's line for an offer. */
export const resumeLabel = (resume: Resume): string => {
  switch (resume.kind) {
    case 'local':
      return `Resume pass & play: ${resume.game.game.names[0]} vs ${resume.game.game.names[1]}`;
    case 'host':
      return resume.handoff && resume.game !== null
        ? handoffLabel(resume.game)
        : `Resume hosting room ${resume.code}`;
    case 'guest':
      return `Rejoin room ${resume.code}`;
  }
};
