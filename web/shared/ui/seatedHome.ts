// The seated games' home screen (docs/design/dry-review-2026-10.md §2.7, row 6; before it uno,
// flip7 and briscola each carried this file as `ui/home.ts`, the constants renamed): the shell's
// home (web/shared/ui/home.ts: the tabs, the mode switch and its submenu, the name and code
// inputs, the resume box, the start, join, share and cancel buttons) composed with the two
// seat-count steppers a page places in its Online card and its pass-and-play twin
// (web/shared/markup/stepper.ts, web/shared/ui/stepper.ts; the owner, 2026-10-02: "a number with
// - and + buttons on the side") and the pass-and-play names past the shell's two, one input per
// seat the stepper allows (web/shared/ui/seatNames.ts). Both start buttons carry the raw values
// along (`SeatedRaw`, the keys a seated game's `opts.parse` reads), each tap on − or + remembers
// the count at once (`opts/set`), so the hidden field and the room agree before Start, and each
// keystroke on a third seat on is the shell's `seatName/typed`, painted back from the shell's
// memory (`seatNames`) so the paint never overwrites what is being typed. A game with more on its
// home screen (briscola's speed selects) calls the four and paints and binds its own beside them.
import {
  readValue,
  requireId,
  toggleClass,
  type DocumentLike,
  type PageLike,
} from '../edge/dom.ts';
import { resumeLabel } from '../lib/name.ts';
import { bindHomeShell, homeView, paintHomeShell, shellIntents, type HomeSlice } from './home.ts';
import {
  bindSeatNames,
  paintSeatNames,
  readSeatNames,
  type ExtraNames,
  type SeatNamesSpec,
} from './seatNames.ts';
import type { Intent, ShellResume, ShellTypes, Tab } from './shell.ts';
import type { Dispatch } from './shellPaint.ts';
import { bindStepper, paintStepper, type StepperSpec } from './stepper.ts';

/** The raw values off a seated game's home screen: each panel's count under its own key, the third name on with `#localBtn`. */
export type SeatedRaw = Readonly<{
  players?: string;
  localPlayers?: string;
  names?: ReadonlyArray<string>;
}>;

/**
 * A seated game's type bag: its room terms hold the seat count the steppers paint, its raw values
 * are `SeatedRaw`, and it offers no resume of its own (the label is the shell's three offers).
 */
export type SeatedTypes = ShellTypes &
  Readonly<{ Opts: Readonly<{ seatCount: number }>; Raw: SeatedRaw; Resume: never }>;

/** The two steppers' hidden fields (`stepperHtml` in the page's host card and its pass-and-play panel). */
export const ONLINE_PLAYERS = 'playersCount';
export const LOCAL_PLAYERS = 'localPlayersCount';

/** The two mode panels every seated page carries (`${mode}ModeContent`): Online · Pass the phone. */
const PLAY_MODES: ReadonlyArray<string> = ['online', 'local'];

export type SeatedHomeSpec<G extends SeatedTypes> = Readonly<{
  /** The seat range of both steppers, the page's `stepperHtml` bounds (shellConfig.ts `seats`). */
  seats: Readonly<{ min: number; max: number }>;
  /** The pass-and-play defaults, first seat first (shellConfig.ts `LOCAL_NAMES`); the inputs past the shell's two show theirs. */
  localNames: ReadonlyArray<string>;
  /** Every player's name off a saved game, in seat order, for the resume offer's label. */
  allNames: (game: G['State']) => ReadonlyArray<string>;
  tabs: ReadonlyArray<Tab<G>>;
  /**
   * The element wrapping the third seat's input on, shown from three seats (`#moreNames`); a page
   * built with `seatNamesHtml` has none, each input hiding on its own (`paintSeatNames`).
   */
  group?: string;
}>;

/**
 * What the paint reads off a game's App: the home slice (home.ts `HomeSlice`), the room's seat
 * count and the names remembered past the shell's two. Structural, as `HomeSlice` is, so a test
 * passes the four fields; a game's `ShellApp<G>` is one.
 */
export type SeatedHomeApp<G extends SeatedTypes> = Readonly<{
  shell: HomeSlice<Tab<G>, ShellResume<G>> & Readonly<{ opts: G['Opts']; seatNames: ExtraNames }>;
}>;

export type SeatedHome<G extends SeatedTypes> = Readonly<{
  /** The Online panel's raw value, the key `host/click` carries. */
  readHostOptions: (doc: DocumentLike) => SeatedRaw;
  /** What `#localBtn` carries beside the first two names: the seat count and the third name on (the reducer seats the first `seatCount`). */
  readLocalOptions: (doc: DocumentLike) => SeatedRaw;
  /** The tabs and panels, the play mode, the submenu and the resume box; then both seat counts and one name input per seat. */
  paintHome: (doc: DocumentLike, app: SeatedHomeApp<G>) => void;
  /** Every control of the home screen and the two waiting screens; each count is remembered as it steps, each extra name as it is typed. */
  bindHome: (doc: PageLike, dispatch: Dispatch<Intent<G>>) => void;
}>;

/** One stepper: its field and bounds, and the raw value a count on it is carried under. */
type Counter = Readonly<{ spec: StepperSpec; raw: (count: string) => SeatedRaw }>;

export const seatedHome = <G extends SeatedTypes>(spec: SeatedHomeSpec<G>): SeatedHome<G> => {
  const counters: ReadonlyArray<Counter> = [
    { spec: { id: ONLINE_PLAYERS, ...spec.seats }, raw: (players) => ({ players }) },
    { spec: { id: LOCAL_PLAYERS, ...spec.seats }, raw: (localPlayers) => ({ localPlayers }) },
  ];
  const names: SeatNamesSpec = { max: spec.seats.max, names: spec.localNames };
  const readHostOptions = (doc: DocumentLike): SeatedRaw => ({
    players: readValue(requireId(doc, ONLINE_PLAYERS)),
  });
  const readLocalOptions = (doc: DocumentLike): SeatedRaw => ({
    localPlayers: readValue(requireId(doc, LOCAL_PLAYERS)),
    names: readSeatNames(doc, names),
  });
  return {
    readHostOptions,
    readLocalOptions,
    paintHome: (doc, app) => {
      paintHomeShell(
        doc,
        homeView(app.shell, (resume) => resumeLabel(resume, spec.allNames)),
        { tabs: spec.tabs, modes: PLAY_MODES },
      );
      // One count, the Online table's and pass-and-play's alike: both steppers show it, − disabled
      // at the floor and + at the cap; the third seat on shows with it.
      const n = app.shell.opts.seatCount;
      counters.forEach((c) => {
        paintStepper(doc, c.spec, n);
      });
      if (spec.group !== undefined) toggleClass(requireId(doc, spec.group), 'hidden', n < 3);
      paintSeatNames(doc, names, n, app.shell.seatNames);
    },
    bindHome: (doc, dispatch) => {
      bindHomeShell(doc, dispatch, {
        tabs: spec.tabs,
        startOptions: {
          host: readHostOptions,
          local: readLocalOptions,
        },
        intents: shellIntents<G>(),
      });
      counters.forEach((c) => {
        bindStepper(doc, c.spec, (n) => {
          dispatch({ type: 'opts/set', raw: c.raw(String(n)) });
        });
      });
      bindSeatNames(doc, names, dispatch);
    },
  };
};
