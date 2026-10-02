import { describe, expect, test } from 'vitest';

import { BUG, BUGS, FULL_HAND, SIDES, TILES_PER_SIDE, codeOf, handSize, other } from './pieces.ts';

describe('the base set', () => {
  test('eleven tiles a side: a Queen Bee, two Beetles, three Grasshoppers, two Spiders, three Ants', () => {
    expect(BUGS.map((bug) => [BUG[bug].name, BUG[bug].count])).toEqual([
      ['Queen Bee', 1],
      ['Beetle', 2],
      ['Grasshopper', 3],
      ['Spider', 2],
      ['Soldier Ant', 3],
    ]);
    expect(TILES_PER_SIDE).toBe(11);
    expect(handSize(FULL_HAND)).toBe(11);
    expect(handSize({ ...FULL_HAND, ant: 0 })).toBe(8);
  });

  test('each bug has its own letter and glyph; a tile reads in the usual notation', () => {
    expect(new Set(BUGS.map((bug) => BUG[bug].letter)).size).toBe(BUGS.length);
    expect(new Set(BUGS.map((bug) => BUG[bug].glyph)).size).toBe(BUGS.length);
    expect(codeOf({ side: 'white', bug: 'queen' })).toBe('wQ');
    expect(codeOf({ side: 'black', bug: 'ant' })).toBe('bA');
  });

  test('white first, and each side the other of the other', () => {
    expect(SIDES).toEqual(['white', 'black']);
    expect(other('white')).toBe('black');
    expect(other('black')).toBe('white');
  });
});
