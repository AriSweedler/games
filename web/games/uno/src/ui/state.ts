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
  act,
  andThen as then,
  cueStep,
  fx,
  step,
  type Ctx,
  type CueMachine,
  type Effect as SharedEffect,
  type HomeSnapshot as SharedHomeSnapshot,
  type Intent as SharedIntent,
  type Resume as SharedResume,
  type ShellApp,
  type ShellConfig,
  type ShellState,
  type GameTypes,
  type Step as SharedStep,
} from '../../../../shared/ui/shell.ts';
import { shellReducer } from '../../../../shared/ui/shellReducer.ts';
import type { SeatedRaw } from '../../../../shared/ui/seatCopy.ts';
import { viewFor, type Action, type State, type View } from '../engine/view.ts';
import { UNO_SHELL } from '../shellConfig.ts';
import {
  DEFAULT_PLAY_MODE,
  HOME_TABS,
  type HomeTab,
  type Opts,
  type PlayMode,
  type Store,
} from '../storage.ts';
import { cuesBetween, type Cue } from './sound.ts';

export { DEFAULT_PLAY_MODE, HOME_TABS, cuesBetween, type HomeTab, type PlayMode };

/** The raw option values `host/click` and `local/click` carry: the seated home's (the two seat-count steppers; the third to twelfth names ride as the shell's `names`). */
export type Raw = SeatedRaw;

export type Table = Readonly<{
  /** The pass-and-play seat the curtain names, or null (the shell writes it, `local.viewer`). */
  curtain: number | null;
}>;

export type TableIntent = Readonly<{ type: 'act'; action: Action }>;

/** UNO's types for the shared shell (`GameTypes` over what it names; the rest are the shell's defaults): two to twelve seats, the seat count as the room's terms. */
export type Uno = GameTypes<{
  Opts: Opts;
  Raw: Raw;
  State: State;
  View: View;
  Action: Action;
  Table: Table;
  Cue: Cue;
  Intent: TableIntent;
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
  // Pass-and-play: the seat whose turn it is acts (`revealer`); Play again is the shell's `again/click`, which lowers the curtain for the new game's first player.
  local: { viewer, revealer },
};

/** The table's one intent: a tap's click, then the shell's `act` by role (the sheets and Escape are the shell's). */
const tableIntent = (app: App, intent: TableIntent, ctx: Ctx): Step =>
  then(step(app, fx('tap')), (a) => act(a, intent.action, ctx, UNO));

/**
 * The boot's reducer block (web/shared/ui/shellReducer.ts): the shell's flows over `UNO` (its
 * `local/click` seats two to twelve, its `seatNames` where the click carries none, and deals
 * through `engine.create`), the table's one intent; every effect is the shell's (the seat count's
 * write is its `writeOpts`, a seat name's its `rememberSeatName`).
 */
export const reducer = shellReducer(UNO, { intent: tableIntent });
export const { initialApp, reduce, runEffect, readHome, resumeFor, hostContextOf, guestContextOf } =
  reducer;
export const initialShell: Shell = initialApp.shell;

/** The view the table paints: my seat's, or null at home. */
export const viewOf = (app: App): View | null => app.shell.view;
export { viewFor };

/** The seats' names in order: the shell's labels read them (web/shared/lib/name.ts `handoffLabel`, `resumeLabel`). */
export const namesOf = (game: State): ReadonlyArray<string> => game.game.names;
