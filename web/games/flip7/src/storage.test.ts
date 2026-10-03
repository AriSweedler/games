// The keys as the page spelled them before prefs.ts `shellKeys` derived them (a saved game and
// the remembered names survive the hoist), and the seat prefs over those old names.
import { describe, expect, test } from 'vitest';

import { createStore, type StorageLike } from '../../../shared/edge/storage.ts';
import {
  DEFAULT_OPTS,
  EXTRA_NAME_PREFS,
  EXTRA_SEATS,
  STORAGE_KEYS,
  decodeSeatCount,
  readOpts,
  writeOpts,
} from './storage.ts';

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

describe('the keys', () => {
  test('are the literals the page wrote before the shell derived them', () => {
    expect(STORAGE_KEYS).toEqual({
      save: 'flip7MP_v1',
      name: 'flip7_name',
      p2Name: 'flip7_p2Name',
      homeTab: 'flip7_homeTab',
      playMode: 'flip7_playMode',
      sound: 'flip7_sound',
      soundFont: 'flip7_soundFont',
      recentGames: 'flip7_recentGames',
      flipTable: 'flip7_flipTable',
      p3Name: 'flip7_p3Name',
      p4Name: 'flip7_p4Name',
      p5Name: 'flip7_p5Name',
      p6Name: 'flip7_p6Name',
      p7Name: 'flip7_p7Name',
      p8Name: 'flip7_p8Name',
      p9Name: 'flip7_p9Name',
      p10Name: 'flip7_p10Name',
      p11Name: 'flip7_p11Name',
      p12Name: 'flip7_p12Name',
      players: 'flip7_players',
    });
  });

  test('the extra names, by seat (2 the third), read and write the old keys under the name rule', () => {
    const s = fakeStorage();
    const store = createStore(s);
    expect(EXTRA_SEATS).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(Object.keys(EXTRA_NAME_PREFS).map(Number)).toEqual(EXTRA_SEATS);
    s.map.set('flip7_p3Name', 'Sandro');
    s.map.set('flip7_p12Name', 'Noa');
    expect(EXTRA_NAME_PREFS[2].read(store)).toEqual({ ok: true, value: 'Sandro' });
    expect(EXTRA_NAME_PREFS[11].read(store)).toEqual({ ok: true, value: 'Noa' });
    EXTRA_NAME_PREFS[3].write(store, 'abcdefghijklmnopqrstuvwxyz');
    expect(s.map.get(STORAGE_KEYS.p4Name)).toBe('abcdefghijklmnopqrst');
    EXTRA_NAME_PREFS[2].write(store, '');
    expect(s.map.has(STORAGE_KEYS.p3Name)).toBe(false);
  });

  test('the seat count: the digit under flip7_players read back as the count, the default for a missing or foreign one', () => {
    const s = fakeStorage();
    const store = createStore(s);
    expect(decodeSeatCount('7')).toEqual({ ok: true, value: 7 });
    expect(decodeSeatCount('1')).toMatchObject({ ok: false });
    expect(readOpts(store)).toEqual(DEFAULT_OPTS);
    s.map.set('flip7_players', '12');
    expect(readOpts(store)).toEqual({ seatCount: 12 });
    s.map.set('flip7_players', 'many');
    expect(readOpts(store)).toEqual(DEFAULT_OPTS);
    writeOpts(store, { seatCount: 4 });
    expect([...s.map.entries()]).toEqual([['flip7_players', '4']]);
  });
});
