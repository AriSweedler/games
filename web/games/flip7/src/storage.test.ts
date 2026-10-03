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
      save: 'flip7MP_v1',
      name: 'flip7_name',
      p2Name: 'flip7_p2Name',
      homeTab: 'flip7_homeTab',
      playMode: 'flip7_playMode',
      sound: 'flip7_sound',
      soundFont: 'flip7_soundFont',
      recentGames: 'flip7_recentGames',
      flipTable: 'flip7_flipTable',
      players: 'flip7_players',
    });
  });

  test('the extra names, index 0 the third seat, read and write the old keys (`flip7_p3Name` on) under the name rule', () => {
    const s = fakeStorage();
    const store = createStore(s);
    expect(SHELL_STORE.seatNames).toHaveLength(10);
    s.map.set('flip7_p3Name', 'Sandro');
    s.map.set('flip7_p12Name', 'Noa');
    expect(SHELL_STORE.seatNames[0]?.read(store)).toEqual({ ok: true, value: 'Sandro' });
    expect(SHELL_STORE.seatNames[9]?.read(store)).toEqual({ ok: true, value: 'Noa' });
    SHELL_STORE.seatNames[1]?.write(store, 'abcdefghijklmnopqrstuvwxyz');
    expect(s.map.get('flip7_p4Name')).toBe('abcdefghijklmnopqrst');
    SHELL_STORE.seatNames[0]?.write(store, '');
    expect(s.map.has('flip7_p3Name')).toBe(false);
  });

  test('the seat count: the digit under flip7_players read back as the count, two for a missing or foreign one', () => {
    const s = fakeStorage();
    const store = createStore(s);
    expect(SHELL_STORE.opts.read(store)).toEqual({ seatCount: 2 });
    s.map.set('flip7_players', '12');
    expect(SHELL_STORE.opts.read(store)).toEqual({ seatCount: 12 });
    s.map.set('flip7_players', 'many');
    expect(SHELL_STORE.opts.read(store)).toEqual({ seatCount: 2 });
    SHELL_STORE.opts.write(store, { seatCount: 4 });
    expect([...s.map.entries()]).toEqual([['flip7_players', '4']]);
  });
});
