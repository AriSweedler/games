import { describe, expect, test } from 'vitest';

import {
  HIVE_HINTS,
  HIVE_MOTION,
  SETTINGS,
  nextSetting,
  readSetting,
  setting,
  writeSetting,
} from './settings.ts';
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

describe('the settings table', () => {
  test("a row's key is spelled from its game and name; Hive's motion is the first row, its hints the second", () => {
    expect(HIVE_MOTION.key).toBe('hive_motion');
    expect(HIVE_MOTION.values).toEqual(['crawl', 'snap']);
    expect(HIVE_MOTION.initial).toBe('crawl');
    expect(SETTINGS[0]).toBe(HIVE_MOTION);
    expect(HIVE_HINTS.key).toBe('hive_hints');
    expect(HIVE_HINTS.values).toEqual(['show', 'hide']);
    expect(HIVE_HINTS.initial).toBe('show');
    expect(HIVE_HINTS.labels).toEqual({ show: 'Show moves', hide: 'Hide moves' });
    expect(SETTINGS[1]).toBe(HIVE_HINTS);
    expect(new Set(SETTINGS.map((row) => row.key)).size).toBe(SETTINGS.length);
    const row = setting({
      game: 'gin',
      name: 'sort',
      values: ['rank', 'suit'],
      initial: 'rank',
      title: 'Sort',
      labels: { rank: 'By rank', suit: 'By suit' },
    });
    expect(row.key).toBe('gin_sort');
    expect(row.labels.suit).toBe('By suit');
  });

  test('a read is the stored value, or the default when the key is missing, stale or unreadable', () => {
    const storage = fakeStorage();
    const store = createStore(storage);
    expect(readSetting(store, HIVE_MOTION)).toBe('crawl');
    expect(writeSetting(store, HIVE_MOTION, 'snap')).toEqual({ ok: true, value: null });
    expect(storage.map.get('hive_motion')).toBe('snap');
    expect(readSetting(store, HIVE_MOTION)).toBe('snap');
    storage.map.set('hive_motion', 'teleport');
    expect(readSetting(store, HIVE_MOTION)).toBe('crawl');
    expect(readSetting(unavailableStore('no storage'), HIVE_MOTION)).toBe('crawl');
    expect(writeSetting(unavailableStore('no storage'), HIVE_MOTION, 'snap').ok).toBe(false);
  });

  test('a toggle goes to the next value and round again; an unknown value goes to the first', () => {
    expect(nextSetting(HIVE_MOTION, 'crawl')).toBe('snap');
    expect(nextSetting(HIVE_MOTION, 'snap')).toBe('crawl');
    expect(nextSetting(HIVE_MOTION, 'teleport' as 'crawl')).toBe('crawl');
  });
});
