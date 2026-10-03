// Hive's reducer on the shared shell (docs/design/hive.md §7; web/shared/ui/shell.ts): the shell's
// flows (the home screen, the waiting rooms, the leave, the resume) over this game's config
// (shellConfig.ts `HIVE_SHELL` completed here as `HIVE`), and the table's own intents: a tap on a
// hand tile shows where it may be placed, a tap on a board tile where it may move, a tap on a lit
// hex plays; the lit hex the pointer is over is the `aim`, so a picked Spider's path to it reads
// 1-2-3, and every move lands as a `hop` the paint crawls along the way it went (the owner: "have
// them move in little jumps"; `moveHop` reads the move off the last two views, so the far seat's
// crawls too), the Spider's with her 1-2-3 (the owner: "the spider's moves must show the '1-2-3'
// when it moves, as a special case"). The tiles' `motion` (crawl or snap) is the device's
// remembered setting (settings.ts `HIVE_MOTION`): read at boot into the table through the home
// snapshot, toggled by `motion/toggle`, written back as an effect; the `hints` (show or hide) the
// same way (the owner: "option to not show moves... you get to click on the grid where you wanna
// put them and then confirm. But if you confirm an illegal move it will yell at you with a red
// toast and tell you why it's no good and then undo your move"): with them hidden no hex lights,
// a tap or a drop on any hex of the ring is a `proposal` the board shows the tile on, and
// `proposal/confirm` plays it when engine.ts `explainMove` allows, else the red toast names the
// rule and the tile goes back (a `hop` from the proposed hex) with the pick kept; `proposal/cancel`
// drops both. Every role plays through `act`: pass-and-play and the host apply the action to the
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
  cuesFor,
  errorToast,
  fx,
  localBroadcast,
  pure,
  startsOver,
  step,
  toast,
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
  type Step as SharedStep,
  type TableReset,
  type CueMemory,
} from '../../../../shared/ui/shell.ts';
import type { ShellEffectDeps, TableEffectRunner } from '../../../../shared/ui/shellEffects.ts';
import { shellReducer } from '../../../../shared/ui/shellReducer.ts';
import {
  explainMove,
  heightAt,
  occupied,
  pathOf,
  topAt,
  type Board,
  type Move,
  type Place,
} from '../engine/engine.ts';
import { dedupe, keyOf, sameHex, type Hex } from '../engine/hex.ts';
import type { Bug, Side } from '../engine/pieces.ts';
import {
  NOT_YOUR_TURN_MSG,
  applyAction,
  turnSeat,
  viewFor,
  type Action,
  type Seat,
  type State,
  type View,
} from '../engine/view.ts';
import { action as actionFrame } from '../protocol.ts';
import type { Hop } from './board.ts';
import { HIVE_SHELL } from '../shellConfig.ts';
import {
  DEFAULT_PLAY_MODE,
  HIVE_HINTS,
  HIVE_MOTION,
  HOME_TABS,
  nextHints,
  nextMotion,
  writeHints,
  writeMotion,
  type Hints,
  type HomeTab,
  type Motion,
  type Opts,
  type PlayMode,
  type Store,
} from '../storage.ts';
import { type Cue } from './sound.ts';

export {
  DEFAULT_PLAY_MODE,
  HIVE_HINTS,
  HIVE_MOTION,
  HOME_TABS,
  type Hints,
  type HomeTab,
  type Motion,
  type PlayMode,
};

/** `host/click` and `local/click` carry nothing beyond the names: a game for two has no option (the field is never set). */
export type Raw = Readonly<{ seats?: never }>;

/** What `initHome` reads beyond the shell's keys: the tiles' motion and the hints (shellConfig.ts `home.read`). */
export type Home = Readonly<{ motion: Motion; hints: Hints }>;

/** What the player has picked up: a bug from the hand, or a tile on the board. */
export type Picked = Readonly<{ kind: 'hand'; bug: Bug }> | Readonly<{ kind: 'hex'; hex: Hex }>;

export type { Hop };

export type Table = Readonly<{
  /** The shell's pass-and-play curtain seat (`ShellTypes.Table`; the shell writes it from `local.viewer`): always null here, Hive raises none. */
  curtain: Seat | null;
  picked: Picked | null;
  /** A tile dragged by hand (ui/dragger.ts): the lit hex it is over while the drag lasts; `picked` is its source. */
  drag: Readonly<{ over: Hex | null }> | null;
  /** The lit hex the pointer is over (or a drag's nearest), so a picked Spider's path to it reads 1-2-3; null off any. */
  aim: Hex | null;
  hop: Hop | null;
  /** The tiles' motion, the device's remembered setting: kept through every start and leave. */
  motion: Motion;
  /**
   * The stacked hex whose column is on show (render.ts `peekHtml`): opened by a hover, a tap, or
   * Enter/Space on the focused count badge; closed by a tap elsewhere, Escape, the pointer
   * leaving, focus moving on, any pick or drag, and any new position.
   */
  peek: Hex | null;
  /**
   * A badge whose peek was dismissed (Escape, a tap elsewhere) while the pointer may still rest on
   * it: the repaint puts a fresh badge under the pointer and its `pointerover` must not reopen the
   * peek at once. A hover on this hex is nothing until the pointer leaves it (`peek/close`) or
   * hovers another badge; a tap on it reopens.
   */
  peekShut: Hex | null;
  /** The hints, the device's other remembered setting: `show` lights the picked tile's hexes, `hide` takes a proposal anywhere. */
  hints: Hints;
  /** With the hints hidden: the hex the picked tile is proposed on, shown there until Confirm or Cancel; null for none. */
  proposal: Hex | null;
  /** The result sheet's Continue was tapped: the final board stays on show. */
}>;

export type TableIntent =
  | Readonly<{ type: 'act'; action: Action }>
  | Readonly<{ type: 'pick/hand'; bug: Bug }>
  | Readonly<{ type: 'tap/hex'; hex: Hex }>
  | Readonly<{ type: 'pick/clear' }>
  | Readonly<{ type: 'drag/start'; picked: Picked }>
  | Readonly<{ type: 'drag/over'; hex: Hex | null }>
  | Readonly<{ type: 'drag/end' }>
  | Readonly<{ type: 'aim/hex'; hex: Hex | null }>
  | Readonly<{ type: 'peek/hover'; hex: Hex }>
  | Readonly<{ type: 'peek/open'; hex: Hex }>
  | Readonly<{ type: 'peek/close' }>
  | Readonly<{ type: 'motion/toggle' }>
  | Readonly<{ type: 'hints/toggle' }>
  | Readonly<{ type: 'proposal/confirm' }>
  | Readonly<{ type: 'proposal/cancel' }>;
/** The tiles' motion, or the hints, into the device's storage (settings.ts `writeSetting`). */
export type TableEffect =
  | Readonly<{ type: 'motion/write'; motion: Motion }>
  | Readonly<{ type: 'hints/write'; hints: Hints }>;

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
  Screen: never;
  Timer: never;
  Cue: Cue;
  Cues: CueMemory;
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
  aim: null,
  hop: null,
  motion: HIVE_MOTION.initial,
  peek: null,
  peekShut: null,
  hints: HIVE_HINTS.initial,
  proposal: null,
};

/**
 * The table with `picked` in hand (or nothing); a new pick aims at nothing yet, proposes nothing,
 * and dismisses any peek (the pointer may still rest on its badge: `peekShut`).
 */
const pick = (app: App, picked: Picked | null): App =>
  withTable(app, { picked, aim: null, proposal: null, peek: null, peekShut: app.table.peek });

const refuse = (app: App, message: string): Step =>
  step(withTable(pick(app, null), { drag: null }), toast(message));

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

/** The hexes whose stack grew (`+1`) or shrank (`-1`) from `prev` to `next`, by one tile. */
const changed = (prev: Board, next: Board, delta: 1 | -1): ReadonlyArray<Hex> =>
  dedupe([...occupied(prev), ...occupied(next)]).filter(
    (h) => heightAt(next, h) - heightAt(prev, h) === delta,
  );

/**
 * The tile that landed between `prev` and `next`, for the paint to crawl (ui/motion.ts): a move is
 * exactly one stack shorter by a tile and one taller (a Beetle's climb counts the same way: the
 * stack it left shrinks, the one it mounts grows), its way engine.ts `pathOf` on the position it
 * left; a placement is one stack taller and none shorter, its way its hex alone (`from` null: the
 * tray is its origin). Null for any other change (a pass, a resignation, the same position again).
 */
export const moveHop = (
  prev: View,
  next: View,
): Readonly<{ bug: Bug; side: Side; from: Hex | null; path: ReadonlyArray<Hex> }> | null => {
  const [from, ...moreFrom] = changed(prev.game.board, next.game.board, -1);
  const [to, ...moreTo] = changed(prev.game.board, next.game.board, 1);
  if (to === undefined || moreFrom.length > 0 || moreTo.length > 0) return null;
  const landed = topAt(next.game.board, to);
  if (landed === undefined) return null;
  if (from === undefined) return { bug: landed.bug, side: landed.side, from: null, path: [to] };
  const lifted = topAt(prev.game.board, from);
  if (lifted === undefined) return null;
  return {
    bug: lifted.bug,
    side: lifted.side,
    from,
    path: pathOf(prev.game, from, to, lifted.bug).slice(1),
  };
};

/** One key per position, so a re-sent frame plays nothing. */
const cueKey = (v: View): string =>
  `${String(v.startedAt)}:${String(turnsOf(v))}:${v.game.turn}:${v.game.result === null ? 'on' : 'over'}`;

/** The paint's cues (the shell's `cuesFor`): once per position, `cuesBetween` for the change, "your turn" when an online turn lands on my seat. */
const CUE_MACHINE: CueMachine<Hive> = {
  key: cueKey,
  between: cuesBetween,
  myTurn: (v) => turnSeat(v.game) === v.seat,
};

/**
 * The state side of a paint: the table is the screen while a view is held; the cues are the
 * machine's. A new position drops the pick; a new game (its clock) drops the result sheet's memory.
 */
const rendered = (app: App, prev: View | null, ctx: Ctx): Step => {
  const view = app.shell.view;
  if (view === null) return pure(app);
  const { key, fresh, cues } = cuesFor(app, prev, view, CUE_MACHINE);
  // A rematch: its clock, or (on a clock that stood still) the result cleared.
  const newGame =
    prev?.startedAt !== view.startedAt || (prev.game.result !== null && view.game.result === null);
  const moved = fresh && !newGame ? moveHop(prev, view) : null;
  const snap = (ctx.reducedMotion ?? false) || app.table.motion === 'snap';
  const table: Table = {
    ...app.table,
    picked: fresh || newGame ? null : app.table.picked,
    drag: newGame ? null : app.table.drag,
    aim: fresh || newGame ? null : app.table.aim,
    peek: fresh || newGame ? null : app.table.peek,
    peekShut: fresh || newGame ? null : app.table.peekShut,
    proposal: fresh || newGame ? null : app.table.proposal,
    // A tile that landed hops once, on this position; any other fresh position hops nothing.
    hop:
      moved !== null ? { key, ...moved, reduced: snap } : fresh || newGame ? null : app.table.hop,
  };
  return step(
    {
      shell: {
        ...app.shell,
        cues: { key },
        screen: 'tableScreen',
        // A rematch lifts a put-away result: the next one shows.
        resultDismissed: newGame ? false : app.shell.resultDismissed,
      },
      table,
    },
    ...cues.map(fx),
  );
};

/** A start keeps the two preferences; every other site keeps the table and drops what was picked up. */
const reset = (table: Table, at: TableReset): Table =>
  startsOver(at)
    ? { ...initialTable, motion: table.motion, hints: table.hints }
    : { ...table, picked: null, drag: null, aim: null, proposal: null, peek: null, peekShut: null };

/**
 * `localBroadcast`'s seat: the actor's view while the game is on, the phone holder's once it is
 * over. Never a curtain: Hive hides nothing, so the view just changes hands on screen (as
 * backgammon's does with its curtain off) and `#curtainOverlay` stays as the shell composed it,
 * hidden.
 */
const viewer: ShellConfig<Hive>['local']['viewer'] = (app, game) => {
  const actor = turnSeat(game.game);
  const holder: Seat = app.shell.view?.seat ?? app.shell.revealed ?? 0;
  return { seat: actor ?? holder, curtain: null };
};

/** `curtain/reveal` never fires (no curtain comes up); the shell's `position/load` reads the seat to move off this. */
const revealer: ShellConfig<Hive>['local']['revealer'] = (game) => ({
  seat: turnSeat(game.game) ?? 0,
});

/**
 * Escape with no sheet open (the shell's `escape`): a peek shuts first; a shell sheet (the
 * history, the rules) is the shell's to close; then a proposal is cancelled, then the pick
 * dropped.
 */
const escape = (app: App, ctx: Ctx): Step | null => {
  if (app.table.peek !== null)
    return pure(withTable(app, { peek: null, peekShut: app.table.peek }));
  if (app.shell.historyOpen || app.shell.rulesOpen) return null;
  if (app.table.proposal !== null) return cancel(app, ctx);
  return pure(pick(app, null));
};

export const HIVE: ShellConfig<Hive> = {
  ...HIVE_SHELL,
  table: { initial: initialTable, reset, rendered, refuse, escape },
  local: { viewer, revealer },
  home: {
    ...HIVE_SHELL.home,
    apply: (app, home) => withTable(app, { motion: home.motion, hints: home.hints }),
  },
};

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
        ? step(pick(app, null), { type: 'send', frame: actionFrame(action) })
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

/** The intent a pick played to `hex` is: a hand bug's placement, a board tile's move. */
export const intentOf = (picked: Picked, hex: Hex): Place | Move =>
  picked.kind === 'hand'
    ? { type: 'place', bug: picked.bug, to: hex }
    : { type: 'move', from: picked.hex, to: hex };

/** The pick played to `hex` (a tap on a lit hex, a drop on one, a proposal confirmed): the tap cue, then the action through `act`. */
const play = (app: App, picked: Picked, hex: Hex, ctx: Ctx): Step =>
  then(step(app, fx('tap')), (a) =>
    act(
      withTable(a, {
        picked: null,
        drag: null,
        aim: null,
        proposal: null,
        peek: null,
        peekShut: null,
      }),
      intentOf(picked, hex),
      ctx,
    ),
  );

/** Whether the hints are hidden: a pick proposes anywhere instead of playing on a lit hex. */
const hidden = (app: App): boolean => app.table.hints === 'hide';

/** With the hints hidden: the pick proposed on `hex`, shown there until Confirm or Cancel; a drag ends. */
const propose = (app: App, hex: Hex): Step =>
  pure(withTable(app, { proposal: hex, drag: null, aim: null }));

/**
 * The proposed tile back where it was: the proposal dropped, and for a board tile a `hop` from
 * the proposed hex to its own (the paint glides it back; a hand tile's tray is drawn back at once).
 */
const putBack = (app: App, view: View, ctx: Ctx): Table => {
  const picked = app.table.picked;
  const to = app.table.proposal;
  const tile = picked?.kind === 'hex' ? topAt(view.game.board, picked.hex) : undefined;
  if (picked?.kind !== 'hex' || to === null || tile === undefined)
    return { ...app.table, proposal: null };
  const snap = (ctx.reducedMotion ?? false) || app.table.motion === 'snap';
  return {
    ...app.table,
    proposal: null,
    hop: {
      key: `${cueKey(view)}:back:${keyOf(to)}`,
      bug: tile.bug,
      side: tile.side,
      from: to,
      path: [picked.hex],
      reduced: snap,
    },
  };
};

/**
 * `proposal/confirm`: the proposed move plays when the engine allows it (engine.ts `explainMove`
 * null; a seat out of turn is told so first), else the red toast names the rule it breaks, the tile
 * goes back and the pick stays for another try. Nothing proposed is nothing.
 */
const confirm = (app: App, ctx: Ctx): Step => {
  const view = app.shell.view;
  const picked = app.table.picked;
  const to = app.table.proposal;
  if (view === null || picked === null || to === null) return pure(app);
  const reason =
    turnSeat(view.game) !== view.seat
      ? NOT_YOUR_TURN_MSG
      : explainMove(view.game, intentOf(picked, to));
  if (reason === null) return play(app, picked, to, ctx);
  return step({ ...app, table: putBack(app, view, ctx) }, errorToast(reason));
};

/** `proposal/cancel`: the tile back where it was and the pick dropped. */
const cancel = (app: App, ctx: Ctx): Step => {
  const view = app.shell.view;
  const table = view === null ? app.table : putBack(app, view, ctx);
  return pure({ ...app, table: { ...table, picked: null, drag: null, aim: null, proposal: null } });
};

/** Whether the pick may go to `hex` now. */
const canReach = (view: View, picked: Picked | null, hex: Hex): boolean =>
  picked !== null && reachable(view, picked).some((h) => sameHex(h, hex));

/**
 * A tap on a hex: a lit hex plays the pick; one of my movable tiles becomes the pick; anything else
 * clears it. With the hints hidden a pick is proposed on any hex but its own (which clears it).
 * The click a drag's release fires reaches the board too: while the drag stands it is nothing.
 */
const tapHex = (app: App, hex: Hex, ctx: Ctx): Step => {
  const view = app.shell.view;
  if (view === null || app.table.drag !== null) return pure(app);
  const picked = app.table.picked;
  if (picked !== null && hidden(app)) {
    const own = picked.kind === 'hex' && sameHex(picked.hex, hex);
    return own ? pure(pick(app, null)) : propose(app, hex);
  }
  if (picked !== null && canReach(view, picked, hex)) return play(app, picked, hex, ctx);
  const movable = view.movable.some((m) => sameHex(m.from, hex));
  const same = picked?.kind === 'hex' && sameHex(picked.hex, hex);
  return pure(pick(app, movable && !same ? { kind: 'hex', hex } : null));
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
  return pure(withTable(app, { picked, drag: { over: null }, peek: null }));
};

/** `drag/over`: the lit hex the ghost is over, or none; a hex the pick cannot reach counts as none (any hex counts with the hints hidden). */
const dragOver = (app: App, hex: Hex | null): Step => {
  const view = app.shell.view;
  const d = app.table.drag;
  if (view === null || d === null) return pure(app);
  const over = hex !== null && (hidden(app) || canReach(view, app.table.picked, hex)) ? hex : null;
  const same = over === d.over || (over !== null && d.over !== null && sameHex(over, d.over));
  return same ? pure(app) : pure(withTable(app, { drag: { over } }));
};

/** `drag/end`: over a lit hex the pick is played there (proposed there with the hints hidden); anywhere else the pick is dropped. */
const dragEnd = (app: App, ctx: Ctx): Step => {
  const view = app.shell.view;
  const d = app.table.drag;
  const picked = app.table.picked;
  if (view === null || d === null) return pure(withTable(app, { drag: null }));
  if (picked !== null && d.over !== null && hidden(app)) return propose(app, d.over);
  if (picked !== null && d.over !== null && canReach(view, picked, d.over))
    return play(app, picked, d.over, ctx);
  return pure(withTable(app, { picked: null, drag: null, aim: null, proposal: null }));
};

/** The peek at `hex` open: a stacked hex only; the same hex again is no change, so no repaint. */
const openPeek = (app: App, hex: Hex): Step => {
  const view = app.shell.view;
  if (view === null || heightAt(view.game.board, hex) < 2) return pure(app);
  const same = app.table.peek !== null && sameHex(app.table.peek, hex);
  return same ? pure(app) : pure(withTable(app, { peek: hex, peekShut: null }));
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
      return pure(pick(app, can && !same ? { kind: 'hand', bug: intent.bug } : null));
    }
    case 'tap/hex':
      return tapHex(app, intent.hex, ctx);
    case 'pick/clear':
      return app.table.drag !== null ? pure(app) : pure(pick(app, null));
    case 'drag/start':
      return dragStart(app, intent.picked);
    case 'drag/over':
      return dragOver(app, intent.hex);
    case 'drag/end':
      return dragEnd(app, ctx);
    case 'aim/hex': {
      // The same aim again (the pointer crossing a cell's own parts) is no change, so no repaint.
      const same =
        intent.hex === null
          ? app.table.aim === null
          : app.table.aim !== null && sameHex(app.table.aim, intent.hex);
      return same ? pure(app) : pure(withTable(app, { aim: intent.hex }));
    }
    case 'peek/hover': {
      // A hover on the badge just dismissed is nothing (the pointer never left it); another badge's is a fresh peek.
      const shut = app.table.peekShut !== null && sameHex(app.table.peekShut, intent.hex);
      return shut ? pure(app) : openPeek(app, intent.hex);
    }
    case 'peek/open':
      return openPeek(app, intent.hex);
    case 'peek/close':
      // The pointer left the badge (or the board): the peek goes, and a dismissal is spent.
      return app.table.peek === null && app.table.peekShut === null
        ? pure(app)
        : pure(withTable(app, { peek: null, peekShut: null }));
    case 'motion/toggle': {
      const motion = nextMotion(app.table.motion);
      return step(withTable(app, { motion }), { type: 'motion/write', motion });
    }
    case 'hints/toggle': {
      // The other way of playing: whatever was picked or proposed under the old one is dropped.
      const hints = nextHints(app.table.hints);
      return step(withTable(pick(app, null), { hints, drag: null }), {
        type: 'hints/write',
        hints,
      });
    }
    case 'proposal/confirm':
      return confirm(app, ctx);
    case 'proposal/cancel':
      return cancel(app, ctx);
  }
};

/** The table's two writes (the tiles' motion, the hints); the shell's effects are its runner's. */
const tableEffect: TableEffectRunner<Hive> = (_app, effect, deps) => {
  if (effect.type === 'motion/write') writeMotion(deps.store, effect.motion);
  else writeHints(deps.store, effect.hints);
};

/** The boot's reducer block (web/shared/ui/shellReducer.ts): the shell's flows over `HIVE`, the table's intents and its two writes. */
export const reducer = shellReducer(HIVE, { intent: tableIntent, effect: tableEffect });
export const { initialApp, reduce, runEffect, readHome, resumeFor, hostContextOf, guestContextOf } =
  reducer;

export type EffectDeps = ShellEffectDeps<Hive>;

/** The view the table paints: my seat's, or null at home. */
export const viewOf = (app: App): View | null => app.shell.view;
export { keyOf, viewFor };

/** The seats' names in order: the shell's labels read them (web/shared/lib/name.ts `handoffLabel`, `resumeLabel`). */
export const namesOf = (game: State): ReadonlyArray<string> => [
  game.game.names.white,
  game.game.names.black,
];
