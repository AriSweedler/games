// A fake two-seat game on the shared shell, for the tests of what composes a game over a
// `ShellConfig` (shellReducer.test.ts): the smallest config the type admits, its store a Map, its
// engine a move counter with one bad action. Test scaffolding by name (eslint.config.js
// `TESTS_AND_TOOLS`, vitest.config.ts: out of the coverage), like backgammon's engine helpers;
// shell.test.ts keeps its own, richer fake, whose every member its flows exercise.
import { boolean, literal, number, object, pair, string } from '../lib/json.ts';
import { err, ok, type Result } from '../lib/result.ts';
import { SHELL_CUES } from '../lib/sound/cues.ts';
import type { SOUND_FONTS } from '../lib/sound/fonts.ts';
import {
  INITIAL_CUE_MEMORY,
  cueStep,
  type CueMemory,
  type Player,
  type Save,
  type Seat,
  type ShellConfig,
} from './shell.ts';

export type FakeState = Readonly<{
  players: Readonly<[Player, Player]>;
  level: number;
  turn: Seat;
  moves: number;
  over: boolean;
}>;
export type FakeView = Readonly<{
  seat: Seat;
  turn: Seat;
  moves: number;
  over: boolean;
  names: Readonly<[string, string]>;
}>;
export type FakeAction = Readonly<{ type: 'move' | 'end' | 'bad' }>;
export type FakeStore = Map<string, string>;

/** The fake's type bag: one own intent (`own`) and one own effect (`ownFx`), a `colour` of its own at home. */
export type Fake = Readonly<{
  Opts: Readonly<{ level: number }>;
  Raw: Readonly<{ level: string }>;
  State: FakeState;
  View: FakeView;
  Action: FakeAction;
  Table: Readonly<{ curtain: Seat | null; marks: ReadonlyArray<string> }>;
  Tab: 'play' | 'rules' | 'about';
  Mode: 'online' | 'local';
  Screen: never;
  Timer: never;
  Cue: 'ding';
  Cues: CueMemory;
  Resume: never;
  Home: Readonly<{ colour: string }>;
  Intent: Readonly<{ type: 'own'; mark: string }>;
  Effect: Readonly<{ type: 'ownFx'; mark: string }>;
  Store: FakeStore;
}>;

export const FAKE_KEYS = {
  save: 'fake_save',
  name: 'fake_name',
  p2Name: 'fake_p2Name',
  homeTab: 'fake_homeTab',
  playMode: 'fake_playMode',
  soundFont: 'fake_soundFont',
  flipTable: 'fake_flipTable',
  sound: 'fake_sound',
  recentGames: 'fake_recentGames',
  colour: 'fake_colour',
} as const;

const TABS = ['play', 'rules', 'about'] as const;
const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

/** A bare-string preference over the Map; an empty write removes the key (the name rule). */
const pref = <T extends string>(key: string) => ({
  read: (store: FakeStore): Result<T, string> => {
    const v = store.get(key);
    return v === undefined ? err('missing') : ok(v as T);
  },
  write: (store: FakeStore, value: T): void => {
    if (value === '') store.delete(key);
    else store.set(key, value);
  },
});

export const fakeViewFor = (game: FakeState, seat: Seat): FakeView => ({
  seat,
  turn: game.turn,
  moves: game.moves,
  over: game.over,
  names: [game.players[0].name, game.players[1].name],
});

/** The fake game's shell config: two seats, a level as the room's terms, every shared flow at its default. */
export const FAKE: ShellConfig<Fake> = {
  id: 'gin-rummy',
  names: { default: 'Ari' },
  tabs: { list: TABS, default: 'play' },
  modes: { default: 'online' },
  copy: {
    leaveLocal: 'Leave the local game?',
    leaveOnline: 'Leave the room?',
    opening: 'Opening…',
    connecting: (code) => `Connecting ${code}`,
    handoff: (code, oppName) => `Handoff ${code} to ${oppName ?? '-'}`,
    hostRoom: (hostName, opts) => `${hostName}'s room at level ${String(opts.level)}`,
  },
  opts: {
    initial: { level: 1 },
    parse: (raw, current) => ({ level: raw.level === '' ? current.level : Number(raw.level) }),
    ofGame: (game) => ({ level: game.level }),
    pick: (from) => ({ level: from.level }),
  },
  engine: {
    create: (players, { level }) => ({ players, level, turn: 0, moves: 0, over: false }),
    apply: (game, seat, action) =>
      action.type === 'bad' || seat !== game.turn
        ? err('Not your turn.')
        : ok(
            action.type === 'end'
              ? { ...game, over: true }
              : { ...game, moves: game.moves + 1, turn: other(game.turn) },
          ),
    viewFor: fakeViewFor,
    over: (view) => view.over,
    finished: (game) => game.over,
    names: (game) => [game.players[0].name, game.players[1].name],
    renameGuest: (game, name) => ({
      ...game,
      players: [game.players[0], { ...game.players[1], name }],
    }),
    decodeState: object({
      players: pair(object({ id: string, name: string })),
      level: number,
      turn: literal(0, 1),
      moves: number,
      over: boolean,
    }),
  },
  result: {
    keyOf: (view) => `${String(view.moves)}:${String(view.turn)}`,
    playersOf: (view) => view.names,
    scoreOf: (view) => `${String(view.moves)} moves`,
    winnerOf: (view) => (view.over && view.moves > 0 ? view.turn : null),
  },
  frames: {
    lobby: (hostName, opts) => ({ t: 'lobby', hostName, ...opts }),
    state: (view) => ({ t: 'state', view }),
    toast: (msg) => ({ t: 'toast', msg }),
    action: (action) => ({ t: 'action', action }),
    join: (name) => ({ t: 'join', name }),
  },
  cues: {
    initial: INITIAL_CUE_MEMORY,
    table: {
      tap: SHELL_CUES.tap,
      yourTurn: SHELL_CUES.yourTurn,
      ding: { cue: 'good.trick', buzz: 9 },
    },
  },
  table: {
    initial: { curtain: null, marks: [] },
    rendered: cueStep({
      key: (view) => `${String(view.moves)}:${String(view.turn)}`,
      between: () => ['ding'],
    }),
  },
  local: {
    viewer: (app, game) => ({
      seat: game.turn,
      curtain: !game.over && app.shell.revealed !== game.turn ? game.turn : null,
    }),
    revealer: (game) => ({ seat: game.turn }),
  },
  home: {
    read: (store) => ({ colour: store.get(FAKE_KEYS.colour) ?? 'green' }),
    apply: (app, home) => ({
      ...app,
      table: { ...app.table, marks: [...app.table.marks, `colour:${home.colour}`] },
    }),
  },
  prefs: {
    keys: { soundFont: FAKE_KEYS.soundFont },
    name: pref(FAKE_KEYS.name),
    p2Name: pref(FAKE_KEYS.p2Name),
    homeTab: pref<Fake['Tab']>(FAKE_KEYS.homeTab),
    playMode: pref<'online' | 'local'>(FAKE_KEYS.playMode),
    soundFont: pref<(typeof SOUND_FONTS)[number]>(FAKE_KEYS.soundFont),
    flipTable: pref<'on' | 'off'>(FAKE_KEYS.flipTable),
    sound: pref<'on' | 'off'>(FAKE_KEYS.sound),
    recentGames: {
      read: (store) => JSON.parse(store.get(FAKE_KEYS.recentGames) ?? '[]') as never,
      append: (store, game) =>
        store.set(
          FAKE_KEYS.recentGames,
          JSON.stringify([
            game,
            ...(JSON.parse(store.get(FAKE_KEYS.recentGames) ?? '[]') as unknown[]),
          ]),
        ),
    },
    save: {
      readSave: (store) => {
        const raw = store.get(FAKE_KEYS.save);
        return raw === undefined ? err('missing') : ok(JSON.parse(raw) as Save<Fake>);
      },
      writeSave: (store, save) => store.set(FAKE_KEYS.save, JSON.stringify(save)),
      clearSave: (store) => store.delete(FAKE_KEYS.save),
    },
  },
};
