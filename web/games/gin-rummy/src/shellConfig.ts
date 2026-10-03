// The half of gin's shell config the game spells from its engine, protocol and storage alone
// (docs/design/shared-shell.md §4.3; C2): the id the room codes are made for, the tabs (the
// Score Counter's beside the shell's three), the modes (the sandbox shown while the first player
// is named `sandbox`, never stored), the copy the shared flows paint (the two leave confirms,
// with gin's own nouns, and the room named with its target; the host name, the status strings
// and the stored mode's default are the shell's, dry-review-2026-10.md §7 row 2), the
// option codec (`{ target }`: the host save's own field, the welcome frame's, the resume offer's),
// the engine adapters, the frame builders, the cue memory's start and the shell's store. The
// table hooks (`rendered`, `refuse`, the per-site `reset`, pass-and-play's `viewer`/`revealer`)
// and the rest of `home` are the reducer's (ui/state.ts `GIN`), which completes this record: they
// use its own helpers, and a value import both ways would be a cycle. Every literal here was
// ui/state.ts's before the move; the constants and helpers the tests import are re-exported there.
import { leaveCopy } from '../../../shared/ui/seatCopy.ts';
import type { ShellGameData } from '../../../shared/ui/shell.ts';
import { applyAction, createGame, decodeState, viewFor } from './engine/index.ts';
import { PROTOCOL } from './protocol.ts';
import { unlocksSandbox } from './sandbox.ts';
import {
  DEFAULT_CARD_BACK,
  DEFAULT_HOME_TAB,
  DEFAULT_SORT,
  HOME_TABS,
  SHELL_STORE,
  readCardBack,
  readScorerState,
  readSort,
  type PlayMode as StoredPlayMode,
} from './storage.ts';
import { INITIAL_CUES } from './ui/cues.ts';
import { CUES } from './ui/sound.ts';
import type { Gin } from './ui/state.ts';

export const DEFAULT_TARGET = 100;
export const hostRoomMsg = (hostName: string, target: number): string =>
  `Connected to ${hostName}'s room (playing to ${String(target)}). Waiting for the host to start…`;

/** `parseInt(v, 10)`, falling back to 100 unless a positive integer. */
export const parseTarget = (raw: string): number => {
  const t = parseInt(raw, 10);
  return !Number.isNaN(t) && t > 0 ? t : DEFAULT_TARGET;
};

export const GIN_SHELL: ShellGameData<Gin> = {
  id: 'gin-rummy',
  tabs: { list: HOME_TABS, default: DEFAULT_HOME_TAB },
  modes: {
    parse: (raw, shell) => {
      // The sandbox is shown, never stored: a reload lands on the stored mode.
      if (raw === 'sandbox')
        return unlocksSandbox(shell.p1Name) ? { shown: 'sandbox', stored: null } : null;
      const mode: StoredPlayMode = raw === 'local' ? 'local' : 'online';
      return { shown: mode, stored: mode };
    },
  },
  copy: {
    ...leaveCopy({ cleared: 'Scores', closes: 'room' }),
    hostRoom: (hostName, opts) => hostRoomMsg(hostName, opts.target),
  },
  opts: {
    initial: { target: DEFAULT_TARGET },
    // A bad target is 100, never the shell's (the legacy `parseTarget`).
    parse: (raw) => ({ target: parseTarget(raw.target) }),
    ofGame: (game) => ({ target: game.target }),
    pick: (from) => ({ target: from.target }),
  },
  engine: {
    create: (players, { target }, rng, now) => createGame({ players, target }, rng, now),
    apply: applyAction,
    viewFor,
    over: (view) => view.phase === 'gameOver',
    finished: (game) => game.phase === 'gameOver',
    names: (game) => [game.players[0].name, game.players[1].name],
    /** `app.game.players[1].name = name` on a rejoin. */
    renameGuest: (game, name) => ({
      ...game,
      players: [game.players[0], { ...game.players[1], name }],
    }),
    // The shell's `position/load` decodes with the save's decoder; gin's sandbox deals a map instead (`sandbox/start`), so no hook sends it.
    decodeState,
  },
  // The finished game's record (the owner, 2026-09-25): a game is its deal's clock (a rematch
  // deals under a new one), its score the two totals, its victor the seat `readyAfterRound` named.
  result: {
    playersOf: (view) => view.players.map((p) => p.name),
    scoreOf: (view) => `${String(view.players[0].total)}–${String(view.players[1].total)}`,
    winnerOf: (view) => view.winner,
  },
  frames: PROTOCOL,
  cues: { initial: INITIAL_CUES, table: CUES },
  home: {
    // This page's own keys (defaults when unreadable; main.ts logs a bad card back), and the Score Counter's session.
    read: (store) => {
      const sort = readSort(store);
      const back = readCardBack(store);
      const scorer = readScorerState(store);
      return {
        sort: sort.ok ? sort.value : DEFAULT_SORT,
        cardBack: back.ok ? back.value : DEFAULT_CARD_BACK,
        scorer: scorer.ok ? scorer.value : null,
      };
    },
  },
  prefs: SHELL_STORE,
};
