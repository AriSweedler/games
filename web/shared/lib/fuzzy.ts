// The landing page's search (web/main.ts): how what was typed ranks the game tiles. Pure, so the
// matcher is proved here without a document. A tile is searchable by its title and its aliases
// (the folder its link names, `data-aliases` on the tile: `backgammon` finds Sheshbesh), each
// compared with the query after `normalise` folds both (lower case, accents dropped, every run of
// characters that is neither a letter nor a digit one space), so case, accents and the emoji
// before a title never count. Four tiers, best over the texts: `exact` (the whole text), `prefix`
// (the text starts with the query), `word` (a word inside it does), `subsequence` (every typed
// character in order, spaces aside). The exact and prefix matches are the top list and the two
// lesser tiers the list under the divider; within each, by tier, then by title.

/** What the search sees of a tile: its title and the other names it answers to. */
export type Searchable = Readonly<{ title: string; aliases: ReadonlyArray<string> }>;

/** How well one query matches an item, best first; `none` is no match. */
export type Tier = 'exact' | 'prefix' | 'word' | 'subsequence' | 'none';

/** The split the page paints: the top list above the divider, the lesser matches below it. */
export type Ranked<T> = Readonly<{ top: ReadonlyArray<T>; more: ReadonlyArray<T> }>;

const TIER_RANK: Readonly<Record<Tier, number>> = {
  exact: 0,
  prefix: 1,
  word: 2,
  subsequence: 3,
  none: 4,
};

/** The tiers above the divider. */
const TOP: ReadonlyArray<Tier> = ['exact', 'prefix'];

/** An item with the tier its query earned. */
type Scored<T> = Readonly<{ item: T; tier: Tier }>;

/**
 * Lower case, accents folded (NFD, then every combining mark dropped), every run of characters
 * that is neither a letter nor a digit one space, trimmed: `'🃏 Gin Rummy'` is `'gin rummy'`,
 * `'Brìscola'` is `'briscola'`.
 */
export const normalise = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Every character of `query` appears in `text` in order (not necessarily adjacent). */
const isSubsequence = (text: string, query: string): boolean =>
  Array.from(query).reduce<number>((from, ch) => {
    if (from < 0) return from;
    const at = text.indexOf(ch, from);
    return at < 0 ? -1 : at + 1;
  }, 0) >= 0;

/** The tier of one normalised text against a normalised, non-empty query. */
const tierOf = (text: string, query: string): Tier => {
  if (text === query) return 'exact';
  if (text.startsWith(query)) return 'prefix';
  if (` ${text}`.includes(` ${query}`)) return 'word';
  return isSubsequence(text.replaceAll(' ', ''), query.replaceAll(' ', ''))
    ? 'subsequence'
    : 'none';
};

/** The best tier of `item` for `query`, over its title and every alias; `none` for an empty query. */
export const tierFor = (item: Searchable, query: string): Tier => {
  const q = normalise(query);
  if (q === '') return 'none';
  return [item.title, ...item.aliases]
    .map((text) => tierOf(normalise(text), q))
    .reduce<Tier>((best, tier) => (TIER_RANK[tier] < TIER_RANK[best] ? tier : best), 'none');
};

/**
 * The items that match `query`, split for the page: the exact and prefix matches in `top`, the
 * word-start and subsequence matches in `more`, each by tier then by title. An empty (or
 * blank) query matches everything: every item in `top`, in the order given, nothing in `more`.
 */
export const rank = <T extends Searchable>(items: ReadonlyArray<T>, query: string): Ranked<T> => {
  if (normalise(query) === '') return { top: items, more: [] };
  const scored: ReadonlyArray<Scored<T>> = items
    .map((item): Scored<T> => ({ item, tier: tierFor(item, query) }))
    .filter(({ tier }: Scored<T>) => tier !== 'none');
  const ordered = [...scored].sort((a: Scored<T>, b: Scored<T>) => {
    const byTier = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    return byTier !== 0 ? byTier : normalise(a.item.title).localeCompare(normalise(b.item.title));
  });
  const itemsIn = (above: boolean): ReadonlyArray<T> =>
    ordered
      .filter(({ tier }: Scored<T>) => TOP.includes(tier) === above)
      .map(({ item }: Scored<T>) => item);
  return { top: itemsIn(true), more: itemsIn(false) };
};
