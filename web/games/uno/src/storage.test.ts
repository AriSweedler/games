// The keys as the page spelled them before prefs.ts `shellKeys` derived them (a saved game and
// the remembered names survive the hoist), and the seat prefs over those old names.
import { describe, expect, test } from 'vitest';

import { createStore, type StorageLike } from '../../../shared/edge/storage.ts';
import {
  DEFAULT_OPTS,
  EXTRA_NAME_PREFS,
  EXTRA_SEATS,
  STORAGE_KEYS,
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
      save: 'unoMP_v1',
      name: 'uno_name',
      p2Name: 'uno_p2Name',
      homeTab: 'uno_homeTab',
      playMode: 'uno_playMode',
      sound: 'uno_sound',
      soundFont: 'uno_soundFont',
      recentGames: 'uno_recentGames',
      flipTable: 'uno_flipTable',
      players: 'uno_players',
      p3Name: 'uno_p3Name',
      p4Name: 'uno_p4Name',
      p5Name: 'uno_p5Name',
      p6Name: 'uno_p6Name',
      p7Name: 'uno_p7Name',
      p8Name: 'uno_p8Name',
      p9Name: 'uno_p9Name',
      p10Name: 'uno_p10Name',
      p11Name: 'uno_p11Name',
      p12Name: 'uno_p12Name',
    });
  });

  test('the extra names, index 0 the third seat, read and write the old keys under the name rule', () => {
    const s = fakeStorage();
    const store = createStore(s);
    expect(EXTRA_SEATS).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(EXTRA_NAME_PREFS).toHaveLength(10);
    s.map.set('uno_p3Name', 'Cara');
    s.map.set('uno_p12Name', 'Lior');
    expect(EXTRA_NAME_PREFS[0]?.read(store)).toEqual({ ok: true, value: 'Cara' });
    expect(EXTRA_NAME_PREFS[9]?.read(store)).toEqual({ ok: true, value: 'Lior' });
    EXTRA_NAME_PREFS[1]?.write(store, 'abcdefghijklmnopqrstuvwxyz');
    expect(s.map.get(STORAGE_KEYS.p4Name)).toBe('abcdefghijklmnopqrst');
    EXTRA_NAME_PREFS[0]?.write(store, '');
    expect(s.map.has(STORAGE_KEYS.p3Name)).toBe(false);
  });

  test('the seat count: the digit under uno_players read back as the count, the default for a missing or foreign one', () => {
    const s = fakeStorage();
    const store = createStore(s);
    expect(readOpts(store)).toEqual(DEFAULT_OPTS);
    s.map.set('uno_players', '12');
    expect(readOpts(store)).toEqual({ seatCount: 12 });
    s.map.set('uno_players', '13');
    expect(readOpts(store)).toEqual(DEFAULT_OPTS);
    writeOpts(store, { seatCount: 5 });
    expect([...s.map.entries()]).toEqual([['uno_players', '5']]);
  });
});
