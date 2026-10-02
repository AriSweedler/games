// The base game's tiles (docs/design/hive.md §2): two sides of eleven bugs each, one Queen Bee,
// two Beetles, three Grasshoppers, two Spiders and three Soldier Ants. A hand is how many of each
// bug a side has still to place. The glyphs are the plain base pack: a letter (the bug's letter in
// the usual Hive notation, wQ for the white Queen) and an emoji, nothing drawn.

export type Side = 'white' | 'black';

/** White places first. */
export const SIDES: ReadonlyArray<Side> = ['white', 'black'];

export const other = (side: Side): Side => (side === 'white' ? 'black' : 'white');

export type Bug = 'queen' | 'beetle' | 'grasshopper' | 'spider' | 'ant';

export const BUGS: ReadonlyArray<Bug> = ['queen', 'beetle', 'grasshopper', 'spider', 'ant'];

export type BugSpec = Readonly<{
  name: string;
  /** How many a side has. */
  count: number;
  letter: string;
  glyph: string;
}>;

export const BUG: Readonly<Record<Bug, BugSpec>> = {
  queen: { name: 'Queen Bee', count: 1, letter: 'Q', glyph: '🐝' },
  beetle: { name: 'Beetle', count: 2, letter: 'B', glyph: '🪲' },
  grasshopper: { name: 'Grasshopper', count: 3, letter: 'G', glyph: '🦗' },
  spider: { name: 'Spider', count: 2, letter: 'S', glyph: '🕷️' },
  ant: { name: 'Soldier Ant', count: 3, letter: 'A', glyph: '🐜' },
};

export type Tile = Readonly<{ side: Side; bug: Bug }>;

/** How many of each bug a side has still to place. */
export type Hand = Readonly<Record<Bug, number>>;

export const FULL_HAND: Hand = {
  queen: BUG.queen.count,
  beetle: BUG.beetle.count,
  grasshopper: BUG.grasshopper.count,
  spider: BUG.spider.count,
  ant: BUG.ant.count,
};

export const handSize = (hand: Hand): number => BUGS.reduce((n, bug) => n + hand[bug], 0);

/** Eleven. */
export const TILES_PER_SIDE = handSize(FULL_HAND);

/** A tile in the usual notation: `wQ`, `bA`. */
export const codeOf = (tile: Tile): string =>
  `${tile.side === 'white' ? 'w' : 'b'}${BUG[tile.bug].letter}`;
