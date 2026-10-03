import { describe, expect, test } from 'vitest';

import { integer, literal, object } from '../lib/json.ts';
import {
  NAME_MAX,
  PLAY_MODES,
  SOUND_STATES,
  cardPackPref,
  decodeCardPackFor,
  decodeDigitsOf,
  decodeLanguagePack,
  decodeName,
  decodePlayMode,
  decodeSoundFont,
  decodeSoundState,
  digitsPref,
  extraNamePref,
  extraNamePrefs,
  namePref,
  langPref,
  readTextWith,
  recentGamesPref,
  seatCountPref,
  shellKeys,
  shellSave,
  shellStore,
  soundPref,
  textPref,
} from './prefs.ts';
import { RECENT_GAMES_CAP, type RecentGame } from '../lib/recentGames.ts';
import { createStore, unavailableStore, type StorageLike } from './storage.ts';

const fakeStorage = (): StorageLike & Readonly<{ map: Map<string, string> }> => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
};

describe('the shared literals', () => {
  test("play modes, sound states and the name cap are gin's", () => {
    expect(PLAY_MODES).toEqual(['online', 'local']);
    expect(SOUND_STATES).toEqual(['on', 'off']);
    expect(NAME_MAX).toBe(20);
  });

  test("the decoders accept their literals and name the rejected value's expectation", () => {
    expect(decodeName('Ann')).toEqual({ ok: true, value: 'Ann' });
    expect(decodeName('')).toEqual({
      ok: false,
      error: { path: [], expected: 'a non-empty name' },
    });
    expect(decodePlayMode('local')).toEqual({ ok: true, value: 'local' });
    expect(decodePlayMode('bots').ok).toBe(false);
    expect(decodeSoundState('off')).toEqual({ ok: true, value: 'off' });
    expect(decodeSoundState('OFF').ok).toBe(false);
    expect(decodeSoundFont('felt')).toEqual({ ok: true, value: 'felt' });
    expect(decodeSoundFont('plaid')).toEqual({
      ok: false,
      error: { path: [], expected: 'one of "default" | "felt" | "arcade"' },
    });
  });

  test("the card-pack decoder is per deck kind: gin's four under french52, linea only for an Italian deck", () => {
    expect(decodeCardPackFor('french52')('yu-gi-oh')).toEqual({ ok: true, value: 'yu-gi-oh' });
    expect(decodeCardPackFor('french52')('linea')).toEqual({
      ok: false,
      error: { path: [], expected: 'one of "default" | "blue-stripe" | "yu-gi-oh" | "empty"' },
    });
    expect(decodeCardPackFor('italian40')('linea')).toEqual({ ok: true, value: 'linea' });
    expect(decodeCardPackFor('italian40')('plaid').ok).toBe(false);
  });
});

describe('cardPackPref', () => {
  test('round-trips a pack name as a bare string under the key and refuses a stranger to the deck kind', () => {
    const s = fakeStorage();
    const store = createStore(s);
    const pref = cardPackPref('briscola_cardPack', 'italian40');
    expect(pref.read(store)).toEqual({
      ok: false,
      error: { kind: 'missing', key: 'briscola_cardPack' },
    });
    expect(pref.write(store, 'linea')).toEqual({ ok: true, value: null });
    expect(s.map.get('briscola_cardPack')).toBe('linea');
    expect(pref.read(store)).toEqual({ ok: true, value: 'linea' });
    s.setItem('briscola_cardPack', 'tartan');
    expect(pref.read(store)).toEqual({
      ok: false,
      error: {
        kind: 'invalid',
        key: 'briscola_cardPack',
        reason:
          '$: expected one of "default" | "blue-stripe" | "yu-gi-oh" | "empty" | "linea" | "napoletane" | "american"',
      },
    });
  });
});

describe('langPref', () => {
  test('round-trips a pack name as a bare string under the key, refuses a stranger, and orDefault gives the game its default', () => {
    const s = fakeStorage();
    const store = createStore(s);
    const pref = langPref('briscola_lang', 'it');
    expect(pref.read(store)).toEqual({
      ok: false,
      error: { kind: 'missing', key: 'briscola_lang' },
    });
    expect(pref.orDefault(store)).toBe('it');
    expect(pref.write(store, 'en')).toEqual({ ok: true, value: null });
    expect(s.map.get('briscola_lang')).toBe('en');
    expect(pref.read(store)).toEqual({ ok: true, value: 'en' });
    expect(pref.orDefault(store)).toBe('en');
    s.setItem('briscola_lang', 'fr');
    expect(pref.read(store)).toEqual({
      ok: false,
      error: {
        kind: 'invalid',
        key: 'briscola_lang',
        reason: '$: expected one of "it" | "en" | "en-plates"',
      },
    });
    expect(pref.orDefault(store)).toBe('it');
    expect(decodeLanguagePack('en-plates')).toEqual({ ok: true, value: 'en-plates' });
  });
});

describe('readTextWith', () => {
  test('passes a missing or unavailable key through and reports a refused value as invalid', () => {
    const s = fakeStorage();
    const store = createStore(s);
    expect(readTextWith(store, 'k', decodePlayMode)).toEqual({
      ok: false,
      error: { kind: 'missing', key: 'k' },
    });
    s.setItem('k', 'bots');
    expect(readTextWith(store, 'k', decodePlayMode)).toEqual({
      ok: false,
      error: { kind: 'invalid', key: 'k', reason: '$: expected one of "online" | "local"' },
    });
    s.setItem('k', 'online');
    expect(readTextWith(store, 'k', decodePlayMode)).toEqual({ ok: true, value: 'online' });
    expect(readTextWith(unavailableStore('private window'), 'k', decodePlayMode)).toEqual({
      ok: false,
      error: { kind: 'unavailable', key: 'k', reason: 'private window' },
    });
  });
});

describe('textPref', () => {
  test('writes the literal under its key and reads it back through its decoder', () => {
    const s = fakeStorage();
    const store = createStore(s);
    const mode = textPref('g_playMode', decodePlayMode);
    expect(mode.read(store)).toEqual({ ok: false, error: { kind: 'missing', key: 'g_playMode' } });
    PLAY_MODES.forEach((m) => {
      expect(mode.write(store, m)).toEqual({ ok: true, value: null });
      expect(s.map.get('g_playMode')).toBe(m);
      expect(mode.read(store)).toEqual({ ok: true, value: m });
    });
    expect([...s.map.keys()]).toEqual(['g_playMode']);
  });
});

describe('namePref', () => {
  test('stores a name cut to NAME_MAX, removes the key for an empty one, refuses an empty stored name', () => {
    const s = fakeStorage();
    const store = createStore(s);
    const name = namePref('g_name');
    expect(name.write(store, 'Ann')).toEqual({ ok: true, value: null });
    expect(s.map.get('g_name')).toBe('Ann');
    expect(name.read(store)).toEqual({ ok: true, value: 'Ann' });
    expect(name.write(store, 'abcdefghijklmnopqrstuvwxyz').ok).toBe(true);
    expect(s.map.get('g_name')).toBe('abcdefghijklmnopqrst');
    expect(name.write(store, '')).toEqual({ ok: true, value: null });
    expect(s.map.has('g_name')).toBe(false);
    s.setItem('g_name', '');
    expect(name.read(store)).toEqual({
      ok: false,
      error: { kind: 'invalid', key: 'g_name', reason: '$: expected a non-empty name' },
    });
  });
});

describe('soundPref', () => {
  test('is on unless the key says off: missing, garbage and "on" all count as on', () => {
    const s = fakeStorage();
    const store = createStore(s);
    const sound = soundPref('g_sound');
    expect(sound.enabled(store)).toBe(true);
    expect(sound.write(store, 'off')).toEqual({ ok: true, value: null });
    expect(s.map.get('g_sound')).toBe('off');
    expect(sound.read(store)).toEqual({ ok: true, value: 'off' });
    expect(sound.enabled(store)).toBe(false);
    expect(sound.write(store, 'on').ok).toBe(true);
    expect(sound.enabled(store)).toBe(true);
    s.setItem('g_sound', 'OFF');
    expect(sound.read(store).ok).toBe(false);
    expect(sound.enabled(store)).toBe(true);
  });

  test('a fallback of false (a phone, sound-fonts.md §12): missing and garbage count as off; a remembered on or off still wins', () => {
    const s = fakeStorage();
    const store = createStore(s);
    const sound = soundPref('g_sound');
    expect(sound.enabled(store, false)).toBe(false);
    expect(sound.enabled(store, true)).toBe(true);
    s.setItem('g_sound', 'OFF');
    expect(sound.enabled(store, false)).toBe(false);
    expect(sound.write(store, 'on').ok).toBe(true);
    expect(sound.enabled(store, false)).toBe(true);
    expect(sound.write(store, 'off').ok).toBe(true);
    expect(sound.enabled(store, true)).toBe(false);
  });
});

describe('shellSave', () => {
  // A toy engine: the state is `{ n }`, the host save's own field a `target` between `myName`
  // and `game`, as gin's is.
  type Toy = Readonly<{ n: number }>;
  type Extra = Readonly<{ target: number }>;
  const toy = object({ n: integer(0) });
  const { decodeSave, readSave, writeSave, clearSave } = shellSave<Toy, Extra>({
    key: 'toyMP_v1',
    game: 'gin-rummy',
    decodeGame: toy,
    hostExtra: {
      decode: object({ target: integer(1) }),
      literal: (save) => ({ target: save.target }),
    },
  });

  test('each role writes its literal in the legacy order, whatever order the caller had, and reads back', () => {
    const s = fakeStorage();
    const store = createStore(s);
    expect(writeSave(store, { game: { n: 3 }, role: 'local' })).toEqual({ ok: true, value: null });
    expect(s.map.get('toyMP_v1')).toBe('{"role":"local","game":{"n":3}}');
    expect(readSave(store)).toEqual({ ok: true, value: { role: 'local', game: { n: 3 } } });

    const host = {
      oppName: null,
      game: null,
      target: 75,
      myName: 'Ann',
      code: 'LRZL',
      role: 'host',
    } as const;
    expect(writeSave(store, host).ok).toBe(true);
    expect(s.map.get('toyMP_v1')).toBe(
      '{"role":"host","code":"LRZL","myName":"Ann","target":75,"game":null,"oppName":null}',
    );
    expect(readSave(store)).toEqual({ ok: true, value: host });

    expect(writeSave(store, { myName: 'Jeff', code: 'KQZM', role: 'guest' }).ok).toBe(true);
    expect(s.map.get('toyMP_v1')).toBe('{"role":"guest","code":"KQZM","myName":"Jeff"}');
    expect(readSave(store)).toEqual({
      ok: true,
      value: { role: 'guest', code: 'KQZM', myName: 'Jeff' },
    });

    expect(clearSave(store)).toEqual({ ok: true, value: null });
    expect(readSave(store)).toEqual({ ok: false, error: { kind: 'missing', key: 'toyMP_v1' } });
    expect([...s.map.keys()]).toEqual([]);
  });

  test('the handoff mark is written only when true, last, and anything else under it is refused', () => {
    const s = fakeStorage();
    const store = createStore(s);
    const handed = {
      role: 'host',
      code: 'ABCD',
      myName: 'Ann',
      target: 100,
      game: { n: 1 },
      oppName: 'Bob',
      handoff: true,
    } as const;
    expect(writeSave(store, handed).ok).toBe(true);
    expect(s.map.get('toyMP_v1')).toBe(
      '{"role":"host","code":"ABCD","myName":"Ann","target":100,"game":{"n":1},"oppName":"Bob","handoff":true}',
    );
    expect(readSave(store)).toEqual({ ok: true, value: handed });
    s.setItem(
      'toyMP_v1',
      '{"role":"host","code":"ABCD","myName":"Ann","target":100,"game":null,"oppName":null,"handoff":false}',
    );
    expect(readSave(store)).toEqual({
      ok: false,
      error: { kind: 'invalid', key: 'toyMP_v1', reason: '$.handoff: expected one of true' },
    });
  });

  test('the seat names of a room past two seats are written after oppName and only when the caller has them, and read back; a row that is not a name or null is refused', () => {
    const s = fakeStorage();
    const store = createStore(s);
    const table = {
      role: 'host',
      code: 'ABCD',
      myName: 'Ann',
      target: 100,
      game: { n: 1 },
      oppName: 'Bob',
      seatNames: ['Bob', null, 'Di'],
      handoff: true,
    } as const;
    expect(writeSave(store, table).ok).toBe(true);
    expect(s.map.get('toyMP_v1')).toBe(
      '{"role":"host","code":"ABCD","myName":"Ann","target":100,"game":{"n":1},"oppName":"Bob","seatNames":["Bob",null,"Di"],"handoff":true}',
    );
    expect(readSave(store)).toEqual({ ok: true, value: table });
    s.setItem(
      'toyMP_v1',
      '{"role":"host","code":"ABCD","myName":"Ann","target":100,"game":null,"oppName":null,"seatNames":["Bob",2]}',
    );
    expect(readSave(store)).toEqual({
      ok: false,
      error: { kind: 'invalid', key: 'toyMP_v1', reason: '$.seatNames[1]: expected string' },
    });
  });

  test('the waiting room`s stamp is written last and only when the caller has one, and read back; a save from before it decodes without one; a stamp that is not a number is refused', () => {
    const s = fakeStorage();
    const store = createStore(s);
    const waiting = {
      role: 'host',
      code: 'ABCD',
      myName: 'Ann',
      target: 100,
      game: null,
      oppName: null,
      at: 1_700_000_000_000,
    } as const;
    expect(writeSave(store, waiting).ok).toBe(true);
    expect(s.map.get('toyMP_v1')).toBe(
      '{"role":"host","code":"ABCD","myName":"Ann","target":100,"game":null,"oppName":null,"at":1700000000000}',
    );
    expect(readSave(store)).toEqual({ ok: true, value: waiting });
    // The literal every page wrote before the stamp: read as before, no stamp.
    s.setItem(
      'toyMP_v1',
      '{"role":"host","code":"ABCD","myName":"Ann","target":100,"game":null,"oppName":null}',
    );
    expect(readSave(store)).toEqual({
      ok: true,
      value: { role: 'host', code: 'ABCD', myName: 'Ann', target: 100, game: null, oppName: null },
    });
    s.setItem(
      'toyMP_v1',
      '{"role":"host","code":"ABCD","myName":"Ann","target":100,"game":null,"oppName":null,"at":"now"}',
    );
    expect(readSave(store)).toEqual({
      ok: false,
      error: { kind: 'invalid', key: 'toyMP_v1', reason: '$.at: expected finite number' },
    });
  });

  test.each<[string, string, string]>([
    [
      'an unknown role',
      '{"role":"spectator"}',
      '$.role: expected one of "local" | "host" | "guest"',
    ],
    ['a local save without a game', '{"role":"local"}', '$.game: expected object'],
    [
      'a local save with a broken game',
      '{"role":"local","game":{"n":-1}}',
      '$.game.n: expected integer in [0,',
    ],
    [
      "a host save whose code is not the game's",
      '{"role":"host","code":"AB1D","myName":"Ann","target":5,"game":null,"oppName":null}',
      '$.code: expected a 4-letter room code',
    ],
    [
      'a host save missing its own field, reported before the game',
      '{"role":"host","code":"ABCD","myName":"Ann","game":"junk","oppName":null}',
      '$.target: expected integer in [1,',
    ],
    [
      'a host save with a broken game, reported after its own field',
      '{"role":"host","code":"ABCD","myName":"Ann","target":5,"game":"junk","oppName":null}',
      '$.game: expected object',
    ],
    ['a guest save without a name', '{"role":"guest","code":"ABCD"}', '$.myName: expected string'],
  ])('refuses %s', (_label, text, reason) => {
    const s = fakeStorage();
    s.setItem('toyMP_v1', text);
    const read = readSave(createStore(s));
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.error).toMatchObject({ kind: 'invalid', key: 'toyMP_v1' });
    expect((read.error as { reason: string }).reason).toContain(reason);
  });

  test("decodeSave is the reader's decoder, over a parsed value", () => {
    expect(decodeSave({ role: 'guest', code: 'ABCD', myName: 'Ann', extra: 1 })).toEqual({
      ok: true,
      value: { role: 'guest', code: 'ABCD', myName: 'Ann' },
    });
    expect(decodeSave('not an object')).toEqual({
      ok: false,
      error: { path: [], expected: 'object' },
    });
  });

  test("the code's length in the message follows the game's room-code spec", () => {
    const fidice = shellSave<Toy, Extra>({
      key: 'k',
      game: 'fidice',
      decodeGame: toy,
      hostExtra: {
        decode: object({ target: integer(1) }),
        literal: (save) => ({ target: save.target }),
      },
    });
    expect(fidice.decodeSave({ role: 'guest', code: 'ABCD', myName: 'Ann' })).toEqual({
      ok: false,
      error: { path: ['code'], expected: 'a 5-letter room code' },
    });
  });
});

/** One finished game as the shell records it (web/shared/lib/recentGames.ts). */
const RECORD: RecentGame = {
  at: 1_700_000_000_000,
  mode: 'local',
  players: ['Ann', 'Bob'],
  score: '104–87',
  winner: 0,
  outcome: 'win',
};

describe('recentGamesPref', () => {
  test('reads [] for a missing, unreadable or foreign value; writes a list as JSON; append puts the newest first and keeps the cap', () => {
    const storage = fakeStorage();
    const store = createStore(storage);
    const pref = recentGamesPref('g_recentGames');
    expect(pref.read(store)).toEqual([]);
    storage.map.set('g_recentGames', 'not json');
    expect(pref.read(store)).toEqual([]);
    storage.map.set('g_recentGames', '{"at":1}');
    expect(pref.read(store)).toEqual([]);
    expect(pref.write(store, [RECORD])).toEqual({ ok: true, value: null });
    expect(storage.map.get('g_recentGames')).toBe(JSON.stringify([RECORD]));
    expect(pref.read(store)).toEqual([RECORD]);
    const second: RecentGame = { ...RECORD, at: RECORD.at + 1, outcome: 'loss', winner: 1 };
    expect(pref.append(store, second)).toEqual({ ok: true, value: null });
    expect(pref.read(store)).toEqual([second, RECORD]);
    // A bad entry beside good ones is dropped on the read, and the next append writes the clean list.
    storage.map.set('g_recentGames', JSON.stringify([second, { junk: 1 }, RECORD]));
    expect(pref.read(store)).toEqual([second, RECORD]);
    // The cap: twenty-one appends keep the newest twenty.
    const many = Array.from({ length: RECENT_GAMES_CAP + 1 }, (_, i) => ({
      ...RECORD,
      at: RECORD.at + 100 + i,
    }));
    many.forEach((g) => pref.append(store, g));
    const kept = pref.read(store);
    expect(kept).toHaveLength(RECENT_GAMES_CAP);
    expect(kept[0]).toEqual(many.at(-1));
    expect(kept.at(-1)).toEqual(many[1]);
    // An unavailable store: the read is [] and the writes report it, nothing throws.
    const gone = unavailableStore('private window');
    expect(pref.read(gone)).toEqual([]);
    expect(pref.append(gone, RECORD)).toEqual({
      ok: false,
      error: { kind: 'unavailable', key: 'g_recentGames', reason: 'private window' },
    });
  });
});

describe('shellStore', () => {
  test('groups the seven preferences, the finished games and the save over one game`s keys, each under its own key, for the shell config to carry', () => {
    const storage = fakeStorage();
    const store = createStore(storage);
    const keys = {
      save: 'g_save',
      name: 'g_name',
      p2Name: 'g_p2Name',
      homeTab: 'g_homeTab',
      playMode: 'g_playMode',
      sound: 'g_sound',
      soundFont: 'g_soundFont',
      recentGames: 'g_recentGames',
      flipTable: 'g_flipTable',
      extra: 'g_extra',
    } as const;
    const shell = shellStore<
      Readonly<{ n: number }>,
      Readonly<{ level: number }>,
      'play' | 'rules'
    >(keys, {
      game: 'gin-rummy',
      decodeGame: object({ n: integer() }),
      hostExtra: {
        decode: object({ level: integer(1) }),
        literal: (save) => ({ level: save.level }),
      },
      decodeHomeTab: literal('play', 'rules'),
    });
    shell.name.write(store, 'Ann');
    shell.p2Name.write(store, 'Bob');
    shell.homeTab.write(store, 'rules');
    shell.playMode.write(store, 'local');
    shell.sound.write(store, 'off');
    shell.soundFont.write(store, 'felt');
    shell.flipTable.write(store, 'on');
    shell.recentGames.append(store, RECORD);
    shell.save.writeSave(store, {
      role: 'host',
      code: 'ABCD',
      myName: 'Ann',
      level: 3,
      game: { n: 1 },
      oppName: null,
    });
    expect([...storage.map.entries()]).toEqual([
      ['g_name', 'Ann'],
      ['g_p2Name', 'Bob'],
      ['g_homeTab', 'rules'],
      ['g_playMode', 'local'],
      ['g_sound', 'off'],
      ['g_soundFont', 'felt'],
      ['g_flipTable', 'on'],
      ['g_recentGames', JSON.stringify([RECORD])],
      [
        'g_save',
        '{"role":"host","code":"ABCD","myName":"Ann","level":3,"game":{"n":1},"oppName":null}',
      ],
    ]);
    expect(shell.name.read(store)).toEqual({ ok: true, value: 'Ann' });
    expect(shell.homeTab.read(store)).toEqual({ ok: true, value: 'rules' });
    expect(shell.sound.enabled(store)).toBe(false);
    expect(shell.recentGames.read(store)).toEqual([RECORD]);
    expect(shell.save.readSave(store)).toMatchObject({
      ok: true,
      value: { role: 'host', level: 3 },
    });
    shell.save.clearSave(store);
    expect(storage.map.has('g_save')).toBe(false);
  });
});

describe('shellKeys', () => {
  // The seven games' tables as each storage.ts spelled them before the helper existed (and
  // tools/games.ts REGISTRY.storage pins): a saved game or a remembered name survives the hoist.
  const LEGACY = {
    backgammon: ['backgammon_', 'backgammonMP_v1'],
    briscola: ['briscola_', 'briscolaMP_v1'],
    fidice: ['fidice_', 'fidiceMP_v1'],
    flip7: ['flip7_', 'flip7MP_v1'],
    'gin-rummy': ['ginRummy_', 'ginRummyMP_v1'],
    hive: ['hive_', 'hiveMP_v1'],
    uno: ['uno_', 'unoMP_v1'],
  } as const;

  test("derives the nine keys every shell keeps from a game's prefix and save key, byte for byte the old tables", () => {
    expect(shellKeys('ginRummy_', 'ginRummyMP_v1')).toEqual({
      save: 'ginRummyMP_v1',
      name: 'ginRummy_name',
      p2Name: 'ginRummy_p2Name',
      homeTab: 'ginRummy_homeTab',
      playMode: 'ginRummy_playMode',
      sound: 'ginRummy_sound',
      soundFont: 'ginRummy_soundFont',
      recentGames: 'ginRummy_recentGames',
      flipTable: 'ginRummy_flipTable',
    });
    Object.values(LEGACY).forEach(([prefix, saveKey]) => {
      const keys = shellKeys(prefix, saveKey);
      expect(keys.save).toBe(saveKey);
      expect(Object.keys(keys)).toEqual([
        'save',
        'name',
        'p2Name',
        'homeTab',
        'playMode',
        'sound',
        'soundFont',
        'recentGames',
        'flipTable',
      ]);
      Object.entries(keys)
        .filter(([field]) => field !== 'save')
        .forEach(([field, key]) => {
          expect(key).toBe(`${prefix}${field}`);
        });
    });
  });

  test('a store written under the old key names reads back through shellStore over the derived keys', () => {
    const storage = fakeStorage();
    const store = createStore(storage);
    // What a backgammon page wrote before this helper: the literals from its old STORAGE_KEYS.
    storage.map.set('backgammon_name', 'Ann');
    storage.map.set('backgammon_p2Name', 'Bob');
    storage.map.set('backgammon_homeTab', 'rules');
    storage.map.set('backgammon_playMode', 'local');
    storage.map.set('backgammon_sound', 'off');
    storage.map.set('backgammon_flipTable', 'on');
    storage.map.set('backgammonMP_v1', '{"role":"local","game":{"n":7}}');
    const shell = shellStore<
      Readonly<{ n: number }>,
      Readonly<{ matchLength: number }>,
      'play' | 'rules'
    >(shellKeys(...LEGACY.backgammon), {
      game: 'backgammon',
      decodeGame: object({ n: integer() }),
      hostExtra: {
        decode: object({ matchLength: integer(1) }),
        literal: (save) => ({ matchLength: save.matchLength }),
      },
      decodeHomeTab: literal('play', 'rules'),
    });
    expect(shell.name.read(store)).toEqual({ ok: true, value: 'Ann' });
    expect(shell.p2Name.read(store)).toEqual({ ok: true, value: 'Bob' });
    expect(shell.homeTab.read(store)).toEqual({ ok: true, value: 'rules' });
    expect(shell.playMode.read(store)).toEqual({ ok: true, value: 'local' });
    expect(shell.sound.enabled(store)).toBe(false);
    expect(shell.flipTable.read(store)).toEqual({ ok: true, value: 'on' });
    expect(shell.save.readSave(store)).toEqual({
      ok: true,
      value: { role: 'local', game: { n: 7 } },
    });
  });
});

describe('extraNamePref and extraNamePrefs', () => {
  test('seat n (0-based) is `<prefix>p<n + 1>Name`: the old keys of the four N-seat games, read and written under the name rule', () => {
    const storage = fakeStorage();
    const store = createStore(storage);
    // Names a device remembered under the keys the pages spelled by hand.
    storage.map.set('uno_p3Name', 'Cara');
    storage.map.set('flip7_p12Name', 'Lior');
    storage.map.set('fidice_p6Name', 'Fay');
    storage.map.set('briscola_p4Name', 'Dan');
    expect(extraNamePref('uno_', 2).read(store)).toEqual({ ok: true, value: 'Cara' });
    expect(extraNamePref('flip7_', 11).read(store)).toEqual({ ok: true, value: 'Lior' });
    expect(extraNamePref('fidice_', 5).read(store)).toEqual({ ok: true, value: 'Fay' });
    expect(extraNamePref('briscola_', 3).read(store)).toEqual({ ok: true, value: 'Dan' });

    const prefs = extraNamePrefs('briscola_', [2, 3]);
    expect(Object.keys(prefs)).toEqual(['2', '3']);
    prefs[2].write(store, 'abcdefghijklmnopqrstuvwxyz');
    expect(storage.map.get('briscola_p3Name')).toBe('abcdefghijklmnopqrst');
    prefs[3].write(store, '');
    expect(storage.map.has('briscola_p4Name')).toBe(false);
    expect(prefs[3].read(store)).toMatchObject({ ok: false, error: { kind: 'missing' } });
  });
});

describe('decodeDigitsOf, digitsPref and seatCountPref', () => {
  test('a number is its digits in the store and one of the values in the app; a stranger names the values', () => {
    expect(decodeDigitsOf([2, 3, 4])('3')).toEqual({ ok: true, value: 3 });
    expect(decodeDigitsOf([2, 3, 4])('5')).toMatchObject({ ok: false });
    expect(decodeDigitsOf([2, 3, 4])(3)).toMatchObject({ ok: false });
    const storage = fakeStorage();
    const store = createStore(storage);
    const pref = digitsPref('g_level', decodeDigitsOf([1, 5, 10]));
    pref.write(store, 10);
    expect(storage.map.get('g_level')).toBe('10');
    expect(pref.read(store)).toEqual({ ok: true, value: 10 });
    storage.map.set('g_level', '7');
    expect(pref.read(store)).toEqual({
      ok: false,
      error: { kind: 'invalid', key: 'g_level', reason: '$: expected one of 1 | 5 | 10' },
    });
  });

  test('seatCountPref: the `<prefix>players` digit the three N-seat pages wrote, read back as the count; a count the game lacks is refused', () => {
    const storage = fakeStorage();
    const store = createStore(storage);
    storage.map.set('uno_players', '12');
    storage.map.set('briscola_players', '5');
    expect(seatCountPref('uno_players', [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).read(store)).toEqual({
      ok: true,
      value: 12,
    });
    expect(seatCountPref('briscola_players', [2, 3, 4]).read(store)).toMatchObject({ ok: false });
    seatCountPref('flip7_players', [2, 3, 4]).write(store, 4);
    expect(storage.map.get('flip7_players')).toBe('4');
  });
});
