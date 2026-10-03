// The boot's `reducer` block derived from a game's shell config (docs/design/shell-call-graph.md
// §4 (8), §5): what seven `ui/state.ts` spelled alike after their config, `initialApp`, `reduce`,
// `runEffect`, `readHome`, `resumeFor`, `hostContextOf` and `guestContextOf`, each a one-line
// delegation to shell.ts with the config in hand. A game passes its config and its `TableReducer`:
// the table intents' reducer, its own effects' runner, and the two seams where a game steps around
// or after the shell (`before`: backgammon's `guest/lost` at match over; `after`: gin's sandbox
// unlock, fidice's bot schedule), so each `state.ts` carries the divergence and nothing else. Pure:
// the runner it composes comes from shellEffects.ts (`shellEffectRunner`), which the pure profile
// carves out; everything here is a function of its arguments.
import {
  guestContextOf,
  hostContextOf,
  initialShell,
  isShellIntent,
  readHome,
  reduceShell,
  resumeFor,
  type Ctx,
  type Effect,
  type GuestContextOf,
  type HomeSnapshot,
  type HostContextOf,
  type Intent,
  type Resume,
  type Save,
  type ShellApp,
  type ShellConfig,
  type ShellTypes,
  type Step,
} from './shell.ts';
import { shellEffectRunner, type EffectRunner, type TableEffectRunner } from './shellEffects.ts';

/** The reducer over one App, a shell intent or the game's: the shape of `reduce` and of every seam below. */
export type Reducer<G extends ShellTypes, App> = (
  app: App,
  intent: Intent<G>,
  ctx: Ctx,
) => Readonly<{ app: App; effects: ReadonlyArray<Effect<G>> }>;

/** What a game adds to the shell's reducer: its table and the seams around the shell's step. */
export type TableReducer<G extends ShellTypes, Ex extends object = object> = Readonly<{
  /** The table's own intents (`G['Intent']`); every `isShellIntent` goes to `reduceShell` instead. */
  intent: (app: ShellApp<G>, intent: G['Intent'], ctx: Ctx) => Step<G>;
  /** The table's own effects (`G['Effect']`), after `isShellEffect` has taken the shell's; none for a game with no effects of its own. */
  effect?: TableEffectRunner<G, Ex>;
  /** Before the shell's step: a Step ends the intent here, null hands it on (backgammon's `guest/lost` at match over, its `local/click` with `manualTurnEnd`). */
  before?: (app: ShellApp<G>, intent: Intent<G>, ctx: Ctx) => Step<G> | null;
  /** After the step, whichever took it: `before` is the App the intent arrived at (gin's sandbox unlock, fidice's timers over the result). */
  after?: (before: ShellApp<G>, step: Step<G>, intent: Intent<G>, ctx: Ctx) => Step<G>;
}>;

/**
 * The boot's `reducer` block (web/shared/edge/boot.ts `BootConfig.reducer`), over whatever App the
 * boot drives: a game's is `ShellApp<G>` (`ShellReducer`), the boot test's fake its own.
 */
export type ReducerBlock<G extends ShellTypes, App, Ex extends object> = Readonly<{
  initialApp: App;
  reduce: Reducer<G, App>;
  runEffect: EffectRunner<G, App, Ex>;
  readHome: (store: G['Store']) => HomeSnapshot<G>;
  hostContextOf: (app: App) => HostContextOf<G>;
  guestContextOf: (app: App) => GuestContextOf;
}>;

/** A game's reducer block, with the resume offer its tests and `home.resume` read (`resumeFor`). */
export type ShellReducer<G extends ShellTypes, Ex extends object = object> = ReducerBlock<
  G,
  ShellApp<G>,
  Ex
> &
  Readonly<{ resumeFor: (save: Save<G> | null) => Resume<G> | null }>;

/** The shell's step or the table's, by the intent's half of the union. */
const shellOrTable =
  <G extends ShellTypes, Ex extends object>(
    cfg: ShellConfig<G>,
    table: TableReducer<G, Ex>,
  ): Reducer<G, ShellApp<G>> =>
  (app, intent, ctx) =>
    isShellIntent(intent) ? reduceShell(app, intent, ctx, cfg) : table.intent(app, intent, ctx);

/** `reduce`: the game's `before` first (its Step ends the intent), the shell's or the table's step, the game's `after` over the result. */
const reducerOf = <G extends ShellTypes, Ex extends object>(
  cfg: ShellConfig<G>,
  table: TableReducer<G, Ex>,
): Reducer<G, ShellApp<G>> => {
  const { before, after } = table;
  const inner = shellOrTable(cfg, table);
  const gated: Reducer<G, ShellApp<G>> = before === undefined
    ? inner
    : (app, intent, ctx) => before(app, intent, ctx) ?? inner(app, intent, ctx);
  return after === undefined
    ? gated
    : (app, intent, ctx) => after(app, gated(app, intent, ctx), intent, ctx);
};

/** The reducer block the boot takes and the game's tests import, off the config and the game's table reducer. */
export const shellReducer = <G extends ShellTypes, Ex extends object = object>(
  cfg: ShellConfig<G>,
  table: TableReducer<G, Ex>,
): ShellReducer<G, Ex> => ({
  initialApp: { shell: initialShell(cfg), table: cfg.table.initial },
  reduce: reducerOf(cfg, table),
  runEffect: shellEffectRunner(cfg, table.effect),
  readHome: (store) => readHome(store, cfg),
  resumeFor: (save) => resumeFor(save, cfg),
  hostContextOf: (app) => hostContextOf(app.shell),
  guestContextOf: (app) => guestContextOf(app.shell),
});
