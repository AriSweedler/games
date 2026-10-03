// The keys as the page spelled them before prefs.ts `shellKeys` derived them: hive keeps the
// shell's nine alone, its own options are settings rows (web/shared/edge/settings.ts).
import { describe, expect, test } from 'vitest';

import { createStore, type StorageLike } from '../../../shared/edge/storage.ts';
import { SHELL_STORE, STORAGE_KEYS, writeSoundState } from './storage.ts';

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
  test('are the literals the page wrote before the shell derived them, the shell`s nine alone', () => {
    expect(STORAGE_KEYS).toEqual({
      save: 'hiveMP_v1',
      name: 'hive_name',
      p2Name: 'hive_p2Name',
      homeTab: 'hive_homeTab',
      playMode: 'hive_playMode',
      sound: 'hive_sound',
      soundFont: 'hive_soundFont',
      recentGames: 'hive_recentGames',
      flipTable: 'hive_flipTable',
    });
  });

  test('a store written under the old names reads back through the shell store', () => {
    const s = fakeStorage();
    const store = createStore(s);
    s.map.set('hive_name', 'Ann');
    s.map.set('hive_sound', 'off');
    expect(SHELL_STORE.name.read(store)).toEqual({ ok: true, value: 'Ann' });
    expect(SHELL_STORE.sound.enabled(store)).toBe(false);
    writeSoundState(store, 'on');
    expect(s.map.get('hive_sound')).toBe('on');
  });
});
