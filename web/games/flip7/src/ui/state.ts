// Flip 7's reducer on the shared shell (docs/design/flip7.md §8; web/shared/ui/shell.ts): the shell
// runs the home screen, the waiting rooms, the sessions, the curtain, the resume offer and the leave
// flow; this file keeps the table's slice (the curtain, the pause) and its hooks.
// Every card is face up, so online there is nothing to hide, only turn authority: the host deals
// and holds the game, each seat's Hit, Stay or give goes to the host as an action frame and the
// engine checks it against the seat that sent it (engine/index.ts `applyAction`); every seat is
// sent its view after each move. On one phone the curtain rises once, for the first player; after
// it the table follows whoever must act (nothing is hidden, so the phone just goes round).
import {
  act as shellAct,
  andThen as then,
  broadcast,
  cueStep,
  localBroadcast,
  pure,
  refuse,
  startsOver,
  withShell,
  withTable,
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
  type TableReset,
} from '../../../../shared/ui/shell.ts';
import { shellReducer } from '../../../../shared/ui/shellReducer.ts';
import type { SeatedRaw } from '../../../../shared/ui/seatCopy.ts';
import {
  actorOf,
  createGame,
  isMyTurn,
  nameOf,
  type Action,
  type State,
  type Status,
  type View,
} from '../engine/index.ts';
import { FLIP7_BONUS, cardName, scoreLine } from '../engine/cards.ts';
import { FLIP7_SHELL, asSeat } from '../shellConfig.ts';
import { cueKey, cuesBetween, type Cue } from './sound.ts';
import { HOME_TABS, type HomeTab, type Opts, type PlayMode, type Store } from '../storage.ts';

export { HOME_TABS, type HomeTab, type PlayMode };

/** The raw values `host/click` and `local/click` carry: the seated home's (the two Players steppers; the third to twelfth names ride as the shell's `names`). */
export type Raw = SeatedRaw;

/**
 * What just happened to a seat, held on this phone until its Continue (the owner, 2026-10-02: "When
 * you the player bust, you need to confirm before proceeding"): a bust (the card that did it and
 * the points lost), a freeze (what it banked) or a Flip 7 (the bonus, the round's end). Online it is
 * this phone's own seat's; on one phone, any seat's (the active seat confirms). Nothing on the table
 * moves for this phone while it is up.
 */
export type Pause = Readonly<{
  seat: number;
  kind: 'bust' | 'frozen' | 'flip7';
  title: string;
  detail: string;
}>;

/** The table's slice: the curtain (the shell's), the pause and the history sheet (the names past the second are the shell's `seatNames`). */
export type Table = Readonly<{
  curtain: number | null;
  pause: Pause | null;
}>;

/** The seats past the shell's two: the third to the twelfth (the shell's `SeatOf<Flip7>` adds its own two). */
export type ExtraSeat = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type FlipSeat = 0 | 1 | ExtraSeat;

export type TableIntent =
  | Readonly<{ type: 'act'; action: Action }>
  | Readonly<{ type: 'hit/click' }>
  | Readonly<{ type: 'stay/click' }>
  | Readonly<{ type: 'give/click'; seat: number }>
  | Readonly<{ type: 'nextRound/click' }>
  | Readonly<{ type: 'replay/click' }>
  | Readonly<{ type: 'continue/click' }>;

/** Flip 7's types for the shared shell (`GameTypes` over what it names; the rest are the shell's defaults). */
export type Flip7 = GameTypes<{
  Opts: Opts;
  Raw: Raw;
  State: State;
  View: View;
  Action: Action;
  Table: Table;
  Cue: Cue;
  Intent: TableIntent;
  Store: Store;
  Seat: ExtraSeat;
}>;

export type Shell = ShellState<Flip7>;
export type App = ShellApp<Flip7>;
export type Intent = SharedIntent<Flip7>;
export type Effect = SharedEffect<Flip7>;
export type Step = SharedStep<Flip7>;
export type Resume = SharedResume<Flip7>;
export type HomeSnapshot = SharedHomeSnapshot<Flip7>;

export const initialTable: Table = { curtain: null, pause: null };

export const waitingToDealMsg = (hostName: string): string =>
  `Waiting for ${hostName} to deal the next round`;

/** The seats' names in order: the shell's labels read them (web/shared/lib/name.ts `handoffLabel`, `resumeLabel`). */
export const namesOf = (game: State): ReadonlyArray<string> => game.seats.map((s) => s.name);

// ---- the shell's hooks into the table --------------------------------------------------------

/** The shell's split (a start, the handoff, a leave and the host lost start the table over), and a deal drops the pause. */
const reset = (table: Table, at: TableReset): Table =>
  startsOver(at) ? initialTable : at === 'deal' ? { ...table, pause: null } : table;

const PAUSE_STATUSES: ReadonlyArray<Status> = ['busted', 'frozen', 'flip7'];

/**
 * The pause a new view raises, against the view it replaces: the first seat (this phone's own
 * online; any on one phone) that went from active to busted, frozen or a Flip 7 within one round.
 * A cold paint (a resume, a reconnect) raises none.
 */
export const pauseFor = (local: boolean, prev: View | null, view: View): Pause | null => {
  if (prev?.round !== view.round || prev.startedAt !== view.startedAt) return null;
  const seat = view.seats.findIndex(
    (s, i) =>
      (local || i === view.me) &&
      prev.seats[i]?.status === 'active' &&
      PAUSE_STATUSES.includes(s.status),
  );
  const s = view.seats[seat];
  if (s === undefined) return null;
  const who = local ? s.name : 'You';
  switch (s.status) {
    case 'busted': {
      const last = s.line[s.line.length - 1];
      const lost = scoreLine(s.line.slice(0, -1));
      return {
        seat,
        kind: 'bust',
        title: local ? `${who} busts` : 'You bust',
        detail: `Another ${last === undefined ? 'number' : cardName(last)}: ${String(lost)} points lost this round.`,
      };
    }
    case 'frozen':
      return {
        seat,
        kind: 'frozen',
        title: local ? `${who} is frozen` : 'You are frozen',
        detail: `${String(scoreLine(s.line))} points banked this round.`,
      };
    case 'flip7':
      return {
        seat,
        kind: 'flip7',
        title: local ? `${who} flips 7!` : 'You flip 7!',
        detail: `+${String(FLIP7_BONUS)} bonus: the round ends for everyone.`,
      };
    case 'active':
    case 'stayed':
      return null;
  }
};

/**
 * The paint's cues (the shell's `cueStep`): once per position (`cueKey`, so a re-sent frame plays
 * nothing), sound.ts `cuesBetween` for the change (the cards that landed, a seat's fate, the
 * round's end, the game's), "your turn" when an online turn lands on my seat.
 */
const CUE_MACHINE: CueMachine<Flip7> = {
  key: cueKey,
  between: (prev, next, app) => cuesBetween(prev, next, app.shell.role === 'local'),
  myTurn: isMyTurn,
};

/** The paint's state side: the shell's cue step, then the pause a new view raises (`pauseFor`) unless one is up. */
const rendered = (app: App, prev: View | null): Step => {
  const view = app.shell.view;
  if (view === null) return pure(app);
  const local = app.shell.role === 'local';
  return then(cueStep(CUE_MACHINE)(app, prev), (a) =>
    pure(withTable(a, { pause: a.table.pause ?? pauseFor(local, prev, view) })),
  );
};

/** Pass-and-play: the actor's view (the host's between rounds is anybody's: the phone holder's); the curtain once, for the first player. */
const viewer: ShellConfig<Flip7>['local']['viewer'] = (app, game) => {
  const actor = actorOf(game);
  const seat = asSeat(actor ?? app.shell.view?.me ?? 0);
  const curtain = app.shell.revealed === null && actor !== null ? seat : null;
  return { seat, curtain };
};

/** On one phone the action is the actor's (between rounds, whoever holds the phone deals): the shell's `act` reads this seat. */
const revealer: ShellConfig<Flip7>['local']['revealer'] = (game) => ({
  seat: asSeat(actorOf(game) ?? 0),
});

// ---- the table's reducer ---------------------------------------------------------------------

/**
 * `act(action)`: the shell's by role, behind flip7's two guards: nothing moves on this phone while
 * a pause waits for its Continue, and a guest between rounds waits for the host to deal.
 */
const act = (app: App, action: Action, ctx: Ctx): Step => {
  if (app.table.pause !== null) return pure(app);
  const view = app.shell.view;
  if (app.shell.role === 'guest' && view?.phase.kind === 'roundOver')
    return refuse(app, waitingToDealMsg(nameOf(view, 0)));
  return shellAct(app, action, ctx, FLIP7);
};

/** Play again once the game is over: a fresh deal for the same seats (host or phone); a guest waits. */
const replay = (app: App, ctx: Ctx): Step => {
  const game = app.shell.game;
  const view = app.shell.view;
  if (view?.phase.kind !== 'gameOver') return pure(app);
  if (app.shell.role === 'guest') return refuse(app, waitingToDealMsg(nameOf(view, 0)));
  if (game === null) return pure(app);
  const next = createGame(
    game.seats.map((s) => s.name),
    ctx.rng,
    ctx.now,
  );
  return app.shell.role === 'local'
    ? localBroadcast(withShell(app, { game: next, revealed: null }), false, ctx, FLIP7)
    : broadcast(withShell(app, { game: next }), ctx, FLIP7);
};

const tableIntent = (app: App, intent: TableIntent, ctx: Ctx): Step => {
  switch (intent.type) {
    case 'act':
      return act(app, intent.action, ctx);
    case 'hit/click':
      return act(app, { type: 'hit' }, ctx);
    case 'stay/click':
      return act(app, { type: 'stay' }, ctx);
    case 'give/click':
      return act(app, { type: 'give', seat: intent.seat }, ctx);
    case 'nextRound/click':
      return act(app, { type: 'nextRound' }, ctx);
    case 'replay/click':
      return replay(app, ctx);
    case 'continue/click':
      return pure(withTable(app, { pause: null }));
  }
};

/** Flip 7's shell config: shellConfig.ts's half completed with the table hooks and the home snapshot's own part. */
export const FLIP7: ShellConfig<Flip7> = {
  ...FLIP7_SHELL,
  table: {
    initial: initialTable,
    reset,
    rendered,
    // Escape with no sheet open: the pause's Continue first; the shell's sheets after.
    escape: (app) => (app.table.pause === null ? null : pure(withTable(app, { pause: null }))),
  },
  local: { viewer, revealer },
};

/**
 * The boot's reducer block (web/shared/ui/shellReducer.ts): the shell's flows over `FLIP7` (its
 * `local/click` seats two to twelve, its `seatNames` where the click carries none, and deals
 * through `engine.create`), the table's intents; every effect is the shell's (the seat count's
 * write is its `writeOpts`, a seat name's its `rememberSeatName`).
 */
export const reducer = shellReducer(FLIP7, { intent: tableIntent });
export const { initialApp, reduce, runEffect, readHome, resumeFor, hostContextOf, guestContextOf } =
  reducer;

/** My seat may act on the view now (the paint's buttons). */
export const myTurn = (app: App): boolean => {
  const view = app.shell.view;
  return view !== null && app.table.curtain === null && app.table.pause === null && isMyTurn(view);
};
