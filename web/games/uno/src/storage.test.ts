// The keys as the page spelled them before prefs.ts `seatedStore` derived them (a saved game and
// the remembered names survive the hoist), and the two seated preferences over those old names.
import { describe, expect, test } from 'vitest';

import { createStore, type StorageLike } from '../../../shared/edge/storage.ts';
import { SHELL_STORE, STORAGE_KEYS } from './storage.ts';

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
    });
  });

  test('the extra names, index 0 the third seat, read and write the old keys (`uno_p3Name` on) under the name rule', () => {
    const s = fakeStorage();
    const store = createStore(s);
    expect(SHELL_STORE.seatNames).toHaveLength(10);
    s.map.set('uno_p3Name', 'Cara');
    s.map.set('uno_p12Name', 'Lior');
    expect(SHELL_STORE.seatNames[0]?.read(store)).toEqual({ ok: true, value: 'Cara' });
    expect(SHELL_STORE.seatNames[9]?.read(store)).toEqual({ ok: true, value: 'Lior' });
    SHELL_STORE.seatNames[1]?.write(store, 'abcdefghijklmnopqrstuvwxyz');
    expect(s.map.get('uno_p4Name')).toBe('abcdefghijklmnopqrst');
    SHELL_STORE.seatNames[0]?.write(store, '');
    expect(s.map.has('uno_p3Name')).toBe(false);
  });

  test('the seat count: the digit under uno_players read back as the count, two for a missing or foreign one', () => {
    const s = fakeStorage();
    const store = createStore(s);
    expect(SHELL_STORE.opts.read(store)).toEqual({ seatCount: 2 });
    s.map.set('uno_players', '12');
    expect(SHELL_STORE.opts.read(store)).toEqual({ seatCount: 12 });
    s.map.set('uno_players', '13');
    expect(SHELL_STORE.opts.read(store)).toEqual({ seatCount: 2 });
    SHELL_STORE.opts.write(store, { seatCount: 5 });
    expect([...s.map.entries()]).toEqual([['uno_players', '5']]);
  });
});
