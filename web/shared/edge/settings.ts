// The per-device settings (the owner, 2026-10-02: "the config options are in browser local
// storage for now but they will maybe become a config tab in the menu later"): one typed table
// of every game's remembered options, each row the game, the option's name, its values, its
// default and the words a control shows for it, read and written through the game's store under
// its own key (`<game>_<name>`, beside the shell's keys in prefs.ts). A game reads its row at boot
// into its state and writes it when the player toggles the control; a later Config tab in the
// shell menu lists every game's options from `SETTINGS` rather than hunting each game's keys. A
// stored value the row does not list reads as the default, and nothing is logged: a stale value
// is not an error the player can act on. Hive's `motion` (every tile crawls hex by hex, or snaps
// to where it lands) is the first row.
import { literal } from '../lib/json.ts';
import { readTextWith } from './prefs.ts';
import type { Store } from './storage.ts';

export type Setting<V extends string = string> = Readonly<{
  game: string;
  name: string;
  /** The storage key: `<game>_<name>`. */
  key: string;
  values: ReadonlyArray<V>;
  initial: V;
  /** What the option is about, as a control titles it. */
  title: string;
  /** One label per value, as a control names the choice. */
  labels: Readonly<Record<V, string>>;
}>;

/** A row of the table: the key is spelled from the game and the name, so no two rows collide by accident. */
export const setting = <const V extends string>(row: Omit<Setting<V>, 'key'>): Setting<V> => ({
  ...row,
  key: `${row.game}_${row.name}`,
});

/** Hive's tiles: `crawl` (one short hop per hex of the way, the default) or `snap` to where they land. */
export const HIVE_MOTION = setting({
  game: 'hive',
  name: 'motion',
  values: ['crawl', 'snap'],
  initial: 'crawl',
  title: 'Tiles',
  labels: { crawl: 'Tiles crawl', snap: 'Tiles snap' },
});

/** Every game's options, for a Config tab to list: Hive's motion first. */
export const SETTINGS: ReadonlyArray<Setting> = [HIVE_MOTION];

/** The stored value, or the row's default when the key is missing, unreadable or not one of the values. */
export const readSetting = <V extends string>(store: Store, row: Setting<V>): V => {
  const stored = readTextWith(store, row.key, literal(...row.values));
  return stored.ok ? stored.value : row.initial;
};

/** `value` under the row's key; the store's own error when it cannot be written. */
export const writeSetting = <V extends string>(
  store: Store,
  row: Setting<V>,
  value: V,
): ReturnType<Store['writeText']> => store.writeText(row.key, value);

/** The other value of a two-way row (the first for any other value): what a toggle switches to. */
export const nextSetting = <V extends string>(row: Setting<V>, value: V): V => {
  const i = row.values.indexOf(value);
  return row.values[(i + 1) % row.values.length] ?? row.initial;
};
