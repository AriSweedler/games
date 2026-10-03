// Flip 7's reducer on the shared shell (docs/design/flip7.md §8; web/shared/ui/shell.ts): the shell
// runs the home screen, the waiting rooms, the sessions, the curtain, the resume offer and the leave
// flow; this file keeps the table's slice (the curtain, the third to sixth names) and its hooks.
// Every card is face up, so online there is nothing to hide, only turn authority: the host deals
// and holds the game, each seat's Hit, Stay or give goes to the host as an action frame and the
// engine checks it against the seat that sent it (engine/index.ts `applyAction`); every seat is
// sent its view after each move. On one phone the curtain rises once, for the first player; after
// it the table follows whoever must act (nothing is hidden, so the phone just goes round).
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
  actorOf,
  applyAction,
  createGame,
  isMyTurn,
  nameOf,
  type Action,
  type State,
  type Status,
  type View,
} from '../engine/index.ts';
import { action as actionFrame } from '../protocol.ts';
import { FLIP7_BONUS, cardName, scoreLine } from '../engine/cards.ts';
import { FLIP7_SHELL, asSeat, parseOpts, seatNames } from '../shellConfig.ts';
import { cueKey, cuesBetween, type Cue } from './sound.ts';
import {
  EXTRA_NAME_PREFS,
  EXTRA_SEATS,
  HOME_TABS,
  type ExtraSeat,
  type HomeTab,
  type Opts,
  type PlayMode,
  type Save,
  type Store,
} from '../storage.ts';

export { EXTRA_SEATS, HOME_TABS, type ExtraSeat, type HomeTab, type PlayMode };

/** The raw values `host/click` and `local/click` carry: the two Players selects and the third to sixth names. */
export type Raw = Readonly<{
  players?: string;
  localPlayers?: string;
  names?: ReadonlyArray<string>;
}>;

/** Null where nothing was remembered; a cleared seat is '' so the repaint after the tap leaves it empty. */
export type ExtraNames = Readonly<Record<ExtraSeat, string | null>>;
export const NO_EXTRA_NAMES: ExtraNames = {
  2: null,
  3: null,
  4: null,
  5: null,
  6: null,
  7: null,
  8: null,
  9: null,
  10: null,
  11: null,
};

/** What `initHome` reads beyond the shell's keys: the third to sixth names (the seat count is the shell's `prefs.opts`). */
export type Home = Readonly<{ extraNames: ExtraNames }>;

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

/** The table's slice: the curtain (the shell's), the pause, the history sheet and the names past the second as last typed. */
export type Table = Readonly<{
  curtain: number | null;
  pause: Pause | null;
  historyOpen: boolean;
  extraNames: ExtraNames;
}>;

export type FlipSeat = 0 | 1 | ExtraSeat;

export type TableIntent =
  | Readonly<{ type: 'act'; action: Action }>
  | Readonly<{ type: 'hit/click' }>
  | Readonly<{ type: 'stay/click' }>
  | Readonly<{ type: 'give/click'; seat: number }>
  | Readonly<{ type: 'nextRound/click' }>
  | Readonly<{ type: 'replay/click' }>
  | Readonly<{ type: 'continue/click' }>
  | Readonly<{ type: 'pname/typed'; seat: ExtraSeat; value: string }>
  | Readonly<{ type: 'rules/open' }>
  | Readonly<{ type: 'rules/close' }>
  | Readonly<{ type: 'history/open' }>
  | Readonly<{ type: 'history/close' }>
  | Readonly<{ type: 'escape' }>;

export type TableEffect = Readonly<{ type: 'rememberPName'; seat: ExtraSeat; name: string }>;

/** Flip 7's types for the shared shell (`ShellTypes`). */
export type Flip7 = Readonly<{
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
  Seat: ExtraSeat;
}>;

export type Shell = ShellState<Flip7>;
export type App = ShellApp<Flip7>;
export type Intent = SharedIntent<Flip7>;
export type Effect = SharedEffect<Flip7>;
export type Step = SharedStep<Flip7>;
export type Resume = SharedResume<Flip7>;
export type HomeSnapshot = SharedHomeSnapshot<Flip7>;

export const initialTable: Table = {
  curtain: null,
  pause: null,
  historyOpen: false,
  extraNames: NO_EXTRA_NAMES,
};

export const waitingToDealMsg = (hostName: string): string =>
  `Waiting for ${hostName} to deal the next round`;

/** The seats' names in order: the shell's labels read them (web/shared/lib/name.ts `handoffLabel`, `resumeLabel`). */
export const namesOf = (game: State): ReadonlyArray<string> => game.seats.map((s) => s.name);

// ---- the shell's hooks into the table --------------------------------------------------------

const reset = (table: Table, at: TableReset): Table => {
  switch (at) {
    case 'startLocal':
    case 'handoff':
    case 'leave':
    case 'lost':
      return { ...initialTable, extraNames: table.extraNames };
    case 'deal':
      return { ...table, pause: null };
    case 'view':
    case 'applied':
    case 'frame':
      return table;
  }
};

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
 * The paint's state side: the table is the screen while a view is up; the cues come from the
 * change since `prev` (sound.ts `cuesBetween`: the cards that landed, a seat's fate, the round's
 * end, the game's), once per position (`cueKey` against the shell's memory, so a re-sent frame
 * plays nothing), and "your turn" when an online turn lands on my seat.
 */
const rendered = (app: App, prev: View | null): Step => {
  const view = app.shell.view;
  if (view === null) return pure(app);
  const local = app.shell.role === 'local';
  const key = cueKey(view);
  const fresh = prev !== null && key !== app.shell.cues.key;
  const online = app.shell.role === 'host' || app.shell.role === 'guest';
  const myTurnNow = online && fresh && isMyTurn(view) && !isMyTurn(prev);
  const cues: ReadonlyArray<Cue> = fresh
    ? [...cuesBetween(prev, view, local), ...(myTurnNow ? (['yourTurn'] as const) : [])]
    : [];
  const pause = app.table.pause ?? pauseFor(local, prev, view);
  return step(
    {
      shell: { ...app.shell, cues: { key }, screen: 'tableScreen' },
      table: { ...app.table, pause },
    },
    ...cues.map((cue) => ({ type: 'fx', cue }) as const),
  );
};

const refuse = (app: App, message: string): Step => step(app, toast(message));

/** Pass-and-play: the actor's view (the host's between rounds is anybody's: the phone holder's); the curtain once, for the first player. */
const viewer: ShellConfig<Flip7>['local']['viewer'] = (app, game) => {
  const actor = actorOf(game);
  const seat = asSeat(actor ?? app.shell.view?.me ?? 0);
  const curtain = app.shell.revealed === null && actor !== null ? seat : null;
  return { seat, curtain };
};

const revealer: ShellConfig<Flip7>['local']['revealer'] = (game) => ({
  seat: asSeat(actorOf(game) ?? 0),
});

// ---- the table's reducer ---------------------------------------------------------------------

/** On one phone the action is the actor's (between rounds, whoever holds the phone deals). */
const localAct = (app: App, action: Action, ctx: Ctx): Step => {
  const game = app.shell.game;
  if (game === null) return pure(app);
  const res = applyAction(game, actorOf(game) ?? 0, action, ctx.rng);
  if (!res.ok) return refuse(app, res.error);
  return localBroadcast(withShell(app, { game: res.value }), false, ctx, FLIP7);
};

const act = (app: App, action: Action, ctx: Ctx): Step => {
  // Nothing moves on this phone while a pause waits for its Continue.
  if (app.table.pause !== null) return pure(app);
  switch (app.shell.role) {
    case 'local':
      return localAct(app, action, ctx);
    case 'host': {
      const game = app.shell.game;
      if (game === null) return pure(app);
      const res = applyAction(game, 0, action, ctx.rng);
      if (!res.ok) return refuse(app, res.error);
      return broadcast(withShell(app, { game: res.value }), ctx, FLIP7);
    }
    case 'guest':
    case null: {
      const view = app.shell.view;
      if (view?.phase.kind === 'roundOver' && app.shell.role === 'guest')
        return refuse(app, waitingToDealMsg(nameOf(view, 0)));
      return app.shell.role === 'guest' && app.shell.oppConnected
        ? step(app, { type: 'send', frame: actionFrame(action) })
        : refuse(app, NOT_CONNECTED_MSG);
    }
  }
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

/** `local/click` for two to six seats: the seat count, the names (the third on carried in `Raw`, else as last typed), the deal. */
const localStart = (
  app: App,
  intent: Readonly<{ p1: string; p2: string }> & Raw,
  ctx: Ctx,
): Step => {
  const opts = parseOpts(intent, app.shell.opts);
  const extra = EXTRA_SEATS.map((seat, i) => intent.names?.[i] ?? app.table.extraNames[seat] ?? '');
  const raws = [intent.p1, intent.p2, ...extra].slice(0, opts.seatCount);
  const seats = localSeats(raws, localNamesOf(FLIP7_SHELL));
  const game = createGame(seatNames(opts.seatCount, seats), ctx.rng, ctx.now);
  return then(startLocal(withShell(app, { opts }), game, ctx, FLIP7), (a) =>
    step(a, { type: 'writeOpts', opts }),
  );
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
    case 'pname/typed':
      return step(
        withTable(app, {
          extraNames: {
            ...app.table.extraNames,
            [intent.seat]: intent.value,
          },
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
      if (app.table.pause !== null) return pure(withTable(app, { pause: null }));
      return app.table.historyOpen
        ? pure(withTable(app, { historyOpen: false }))
        : pure(withShell(app, { rulesOpen: false }));
  }
};

/** Flip 7's shell config: shellConfig.ts's half completed with the table hooks and the home snapshot's own part. */
export const FLIP7: ShellConfig<Flip7> = {
  ...FLIP7_SHELL,
  table: { initial: initialTable, reset, rendered },
  local: { viewer, revealer },
  home: {
    ...FLIP7_SHELL.home,
    apply: (app, home) => ({
      shell: app.shell,
      table: { ...app.table, extraNames: home.extraNames },
    }),
  },
};

export const initialShell: Shell = shellInitial(FLIP7);
export const initialApp: App = { shell: initialShell, table: initialTable };

export const reduce = (app: App, intent: Intent, ctx: Ctx): Step => {
  if (intent.type === 'local/click') return localStart(app, intent, ctx);
  // The handoff hands a two-seat room on: at two players only.
  if (
    intent.type === 'handoff/click' &&
    app.shell.game !== null &&
    app.shell.game.seats.length !== 2
  )
    return pure(app);
  return isShellIntent(intent)
    ? reduceShell(app, intent, ctx, FLIP7)
    : tableIntent(app, intent, ctx);
};

/** My seat may act on the view now (the paint's buttons). */
export const myTurn = (app: App): boolean => {
  const view = app.shell.view;
  return view !== null && app.table.curtain === null && app.table.pause === null && isMyTurn(view);
};

export const resumeFor = (save: Save | null): Resume | null => shellResumeFor(save, FLIP7);
export const readHome = (store: Store): HomeSnapshot => shellReadHome(store, FLIP7);

export type HostContext = HostContextOf<Flip7>;
export type GuestContext = GuestContextOf;

export const hostContextOf = (app: App): HostContext => shellHostContextOf(app.shell);
export const guestContextOf = (app: App): GuestContext => shellGuestContextOf(app.shell);

export type EffectDeps = ShellEffectDeps<Flip7>;

export const runEffect = (app: App, effect: Effect, deps: EffectDeps): void => {
  if (isShellEffect(effect)) {
    runShellEffect(app.shell, effect, deps, FLIP7);
    return;
  }
  EXTRA_NAME_PREFS[effect.seat].write(deps.store, effect.name);
};
