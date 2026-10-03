// The half of backgammon's shell config the game spells from its engine, protocol and storage
// alone (docs/design/shared-shell.md §4.3; C2): the id the room codes are made for, the
// pass-and-play pair, the copy the shared flows paint (the two leave confirms, over a match and a
// room, and the room named by its host: the shell's seatCopy.ts, started; the host name, the tabs,
// the modes and the status strings are the shell's defaults, dry-review-2026-10.md §7 row 2), the
// option codec (`{ matchLength, variant }`: the host save's own
// fields, the welcome frame's, the resume offer's, each select falling back to the shell's
// current value), the engine adapters, the frame builders, the cue memory's start and the
// shell's store. The table hooks (`rendered`, `refuse`, the per-site `reset`, pass-and-play's
// `viewer`/`revealer`) and the rest of `home` are the reducer's (ui/state.ts `BACKGAMMON`), which
// completes this record: they use its own helpers, and a value import both ways would be a cycle.
// Every literal here was ui/state.ts's before the move; the constants and helpers the tests
// import are re-exported there.
import { hostRoomMsg, leaveCopy } from '../../../shared/ui/seatCopy.ts';
import { DEFAULT_NAME, type ShellGameData } from '../../../shared/ui/shell.ts';
import {
  applyAction,
  createGame,
  DEFAULT_MATCH_LENGTH,
  DEFAULT_VARIANT,
  MATCH_LENGTHS,
  decodeState,
  isShippedVariant,
  matchOver,
  matchWinner,
  viewFor,
  type ShippedVariant,
} from './engine/index.ts';
import { PROTOCOL } from './protocol.ts';
import {
  DEFAULT_CURTAIN_MODE,
  SHELL_STORE,
  readCurtainMode,
  readMatchLength,
  readVariant,
  writeMatchLength,
  writeVariant,
} from './storage.ts';
import { CUES } from './ui/sound.ts';
import type { Backgammon } from './ui/state.ts';

/**
 * The pass-and-play seats when nothing is remembered or typed (the owner, 2026-09-25:
 * "backgammon is Ari and Ethan"): the one game whose pair is not the shell's `DEFAULT_LOCAL_NAMES`.
 * The first is `#nameInput`'s markup value (the shell's DEFAULT_NAME) too, since the shell's
 * `fillName` reaches that input. tools/games.ts SHELL pins the pair for the e2e.
 */
export const LOCAL_NAMES: readonly [string, string] = [DEFAULT_NAME, 'Ethan'];
/** A match length from a select's raw value (the shell's `opts/set` and the start buttons carry strings alone): one of MATCH_LENGTHS, else `fallback`. */
export const parseMatchLength = (raw: string | undefined, fallback: number): number => {
  const n = parseInt(raw ?? '', 10);
  return MATCH_LENGTHS.includes(n) ? n : fallback;
};

/** A variant from a select's raw value: a shipped one, else `fallback` (plakoto and fevga are typed, not playable). */
export const parseVariant = (raw: string | undefined, fallback: ShippedVariant): ShippedVariant =>
  raw !== undefined && isShippedVariant(raw) ? raw : fallback;

export const BACKGAMMON_SHELL: ShellGameData<Backgammon> = {
  id: 'backgammon',
  // The flat board is played with the phone sideways (docs/design/backgammon-landscape.md): the
  // shell watches the orientation and asks for a turn of the phone at the table (its turn gate).
  orientation: 'landscape',
  localNames: LOCAL_NAMES,
  copy: { ...leaveCopy({ ends: 'match', closes: 'room' }), hostRoom: hostRoomMsg('start') },
  opts: {
    initial: { matchLength: DEFAULT_MATCH_LENGTH, variant: DEFAULT_VARIANT },
    // The match length and variant are the shell's (set by the selects' `opts/set`), unless the binder passes the raw select values along.
    parse: (raw, current) => ({
      matchLength: parseMatchLength(raw.matchLength, current.matchLength),
      variant: parseVariant(raw.variant, current.variant),
    }),
    ofGame: (game) => ({ matchLength: game.options.matchLength, variant: game.variant }),
    pick: (from) => ({ matchLength: from.matchLength, variant: from.variant }),
  },
  engine: {
    create: (players, { matchLength, variant }, rng, now) =>
      createGame(players, { matchLength, rotation: [variant] }, rng, now),
    apply: applyAction,
    viewFor,
    over: (view) => view.matchOver,
    // The result sheet (design §4.11): one game over inside the match, read upright, not gated.
    gameOver: (view) => view.phase === 'over',
    finished: (game) => matchOver(game.match),
    names: (game) => [game.players[0].name, game.players[1].name],
    /** `game.players[1].name = name` on a rejoin. */
    renameGuest: (game, name) => ({
      ...game,
      players: [game.players[0], { ...game.players[1], name }],
    }),
    // `position/load` (`__backgammon.setup(state)`): the save's decoder checks the hand-made state.
    decodeState,
  },
  // The finished match's record (the owner, 2026-09-25): a match is its opening's clock (a
  // rematch opens under a new one), its score the match score, its victor `matchWinner`.
  result: {
    playersOf: (view) => view.players.map((p) => p.name),
    scoreOf: (view) => `${String(view.match.score[0])}–${String(view.match.score[1])}`,
    winnerOf: (view) => matchWinner(view.match),
  },
  frames: PROTOCOL,
  cues: { table: CUES },
  home: {
    // This page's own key: the curtain mode (the default when unreadable).
    read: (store) => {
      const curtain = readCurtainMode(store);
      return { curtainMode: curtain.ok ? curtain.value : DEFAULT_CURTAIN_MODE };
    },
  },
  prefs: {
    ...SHELL_STORE,
    // The options the shell remembers (`opts/set`, `writeOpts`): the two selects under their own keys, each read to its default.
    opts: {
      read: (store) => {
        const variant = readVariant(store);
        const length = readMatchLength(store);
        return {
          matchLength: length.ok ? length.value : DEFAULT_MATCH_LENGTH,
          variant: variant.ok ? variant.value : DEFAULT_VARIANT,
        };
      },
      write: (store, opts) => {
        writeVariant(store, opts.variant);
        writeMatchLength(store, opts.matchLength);
      },
    },
  },
};
