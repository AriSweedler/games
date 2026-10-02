import { describe, expect, test } from 'vitest';

import { normalise, rank, tierFor, type Searchable } from './fuzzy.ts';

/** The landing's tiles as web/main.ts reads them: the name, then the folder the link names. */
const tile = (title: string, folder: string, ...aliases: ReadonlyArray<string>): Searchable => ({
  title,
  aliases: [folder, ...aliases],
});
const GIN = tile('Gin Rummy', 'gin-rummy');
const FIDICE = tile('Fidice', 'fidice');
const SHESHBESH = tile('Sheshbesh', 'backgammon');
const BRISCOLA = tile('Briscola', 'briscola');
const RPS = tile('Rock Paper Scissors', 'rps');
const UNO = tile('UNO', 'uno');
const FLIP7 = tile('Flip 7', 'flip7');
const TILES: ReadonlyArray<Searchable> = [GIN, FIDICE, SHESHBESH, BRISCOLA, RPS, UNO, FLIP7];

const titles = (items: ReadonlyArray<Searchable>): ReadonlyArray<string> =>
  items.map(({ title }) => title);

describe('normalise', () => {
  test.each([
    ['lower-cases', 'UNO', 'uno'],
    ['folds accents', 'Brìscóla', 'briscola'],
    ['drops the emoji before a title, and the space it leaves', '🃏 Gin Rummy', 'gin rummy'],
    ['drops a keycap emoji whole', '7️⃣ Flip 7', '7 flip 7'],
    ['one space for any run of punctuation', 'rock-paper--scissors', 'rock paper scissors'],
    ['keeps digits', 'Flip 7', 'flip 7'],
    ['trims', '  gin  ', 'gin'],
    ['a blank is empty', ' \t ', ''],
  ])('%s', (_, raw, expected) => {
    expect(normalise(raw)).toBe(expected);
  });
});

describe('tierFor', () => {
  test.each([
    ['the whole title is exact', GIN, 'gin rummy', 'exact'],
    ['case and accents do not count', BRISCOLA, 'BRÌSCOLA', 'exact'],
    ['the start of the title is a prefix', GIN, 'gin', 'prefix'],
    ['a prefix across a word break', RPS, 'rock pa', 'prefix'],
    ['the start of a later word is a word match', GIN, 'rum', 'word'],
    ['a phrase starting at a later word is a word match', RPS, 'paper sci', 'word'],
    ['the typed characters in order, not adjacent, is a subsequence', RPS, 'rkpr', 'subsequence'],
    ['the folder a link names is an alias, so its initials are exact', RPS, 'rps', 'exact'],
    ['a subsequence reads across the spaces', RPS, 'r k p', 'subsequence'],
    ['out of order is none', GIN, 'nig', 'none'],
    ['a character the title lacks is none', UNO, 'unox', 'none'],
    ['a missing character then a present one is still none', GIN, 'xg', 'none'],
    ['an alias is exact too: the folder the link names', SHESHBESH, 'backgammon', 'exact'],
    ['an alias prefix', SHESHBESH, 'back', 'prefix'],
    ['the best tier over title and aliases wins', SHESHBESH, 'shesh', 'prefix'],
    ['an empty query is none', GIN, '', 'none'],
    ['a blank query is none', GIN, '   ', 'none'],
  ])('%s', (_, item, query, expected) => {
    expect(tierFor(item, query)).toBe(expected);
  });

  test('a data-alias counts like the folder', () => {
    expect(tierFor(tile('Sheshbesh', 'backgammon', 'tavli'), 'tav')).toBe('prefix');
  });
});

describe('rank', () => {
  test('an empty or blank query is every tile on top, in the order given, nothing below', () => {
    expect(rank(TILES, '')).toEqual({ top: TILES, more: [] });
    expect(rank(TILES, '  ')).toEqual({ top: TILES, more: [] });
  });

  test('exact and prefix matches are the top list, word and subsequence matches the list below', () => {
    // 's': Sheshbesh (prefix); Rock Paper Scissors (word), Briscola (subsequence).
    const { top, more } = rank(TILES, 's');
    expect(titles(top)).toEqual(['Sheshbesh']);
    expect(titles(more)).toEqual(['Rock Paper Scissors', 'Briscola']);
  });

  test('exact comes before prefix on top; ties within a tier go by title', () => {
    const items = [tile('Gin Rummy', 'gin-rummy'), tile('Gin', 'gin'), tile('Ginger', 'ginger')];
    expect(titles(rank(items, 'gin').top)).toEqual(['Gin', 'Gin Rummy', 'Ginger']);
  });

  test('ties by title ignore case and accents', () => {
    const items = [tile('ébony', 'e1'), tile('Dusk', 'd1'), tile('dawn', 'd2')];
    expect(titles(rank(items, 'd').top)).toEqual(['dawn', 'Dusk']);
    expect(titles(rank(items, 'n').more)).toEqual(['dawn', 'ébony']);
  });

  test('a tile that matches nowhere is left out; no match at all is two empty lists', () => {
    expect(titles(rank(TILES, 'gin').top)).toEqual(['Gin Rummy']);
    expect(rank(TILES, 'gin').more).toEqual([]);
    expect(rank(TILES, 'zzzz')).toEqual({ top: [], more: [] });
  });

  test('an alias puts its tile on top', () => {
    expect(titles(rank(TILES, 'backg').top)).toEqual(['Sheshbesh']);
  });

  test('keeps the items themselves, so a page may carry its markup beside the names', () => {
    const items = [{ ...FLIP7, href: 'games/flip7/' }];
    expect(rank(items, 'flip').top).toEqual(items);
  });
});
