// Boot of the landing page (docs/ARCHITECTURE.md "Module boundaries": main.ts constructs the
// adapters and injects them; no logic of its own). The page is static tiles; this module adds the
// search bar above them. The tiles are read once from the grid as `Tile`s: what the search sees
// (web/shared/lib/fuzzy.ts `Searchable`: the name, the folder the link names and any
// `data-aliases`) beside the tile's own markup, to paint again. On every input event `rank`
// splits them and `#results` is rebuilt through the keyed slot (the key is the normalised query,
// so a keystroke that changes nothing leaves the tiles alone): the exact and prefix matches, a
// labelled `<hr>`, the lesser matches, or one line when nothing matches. The grid is hidden while
// the query is non-empty and returns when it is, so nothing moves while the bar is empty. The soft
// keyboard is the constraint: on focus the bar is scrolled to the top of the page and, on every
// visualViewport resize and scroll (the keyboard opening and closing, the page panning under it),
// the results list is sized to what the keyboard leaves visible under the bar, so the first row
// is never under it and the list scrolls within what remains. Enter (the keyboard's Go:
// the form's submit) opens the top match; Escape and the clear button empty the search, the input
// keeping focus. No hook: the harness reads the document.
import {
  dataOf,
  focusElement,
  keyOf,
  listen,
  preventDefault,
  queryAllIn,
  queryIn,
  readValue,
  rectOf,
  requireId,
  setHidden,
  setStyle,
  setValue,
  type Element,
} from './shared/edge/dom.ts';
import { normalise, rank, type Searchable } from './shared/lib/fuzzy.ts';
import { ensureKeyed } from './shared/ui/keyed.ts';

/** A landing tile: what the search sees, where it goes, and its markup to paint again. */
type Tile = Searchable & Readonly<{ href: string; markup: string }>;

/** The least the results list is ever given: one row. */
const MIN_ROOM = 60;

const NOTHING = '<p class="none">Nothing matches</p>';
const DIVIDER = '<hr class="divider" aria-label="more like this">';

// The three reads dom.ts has no helper for: a tile's name as text, its link, and its markup.
const textOf = (el: Element | null): string => el?.textContent.trim() ?? '';
const hrefOf = (el: Element): string => el.getAttribute('href') ?? '';
const markupOf = (el: Element): string => el.outerHTML;

/** `games/backgammon/`, or `/backgammon/` as the Worker serves it: the folder the link names. */
const folderOf = (href: string): string =>
  href
    .split('/')
    .filter((part) => part !== '' && part !== 'games')
    .at(-1) ?? '';

const tileOf = (card: Element): Tile => {
  const href = hrefOf(card);
  const aliases = (dataOf(card, 'aliases') ?? '').split(' ').filter((alias) => alias !== '');
  return {
    title: textOf(queryIn(card, '.name')),
    aliases: [folderOf(href), ...aliases],
    href,
    markup: markupOf(card),
  };
};

const tilesMarkup = (tiles: ReadonlyArray<Tile>): string =>
  tiles.map(({ markup }) => markup).join('');

const resultsMarkup = (top: ReadonlyArray<Tile>, more: ReadonlyArray<Tile>): string => {
  if (top.length === 0 && more.length === 0) return NOTHING;
  return `${tilesMarkup(top)}${more.length === 0 ? '' : `${DIVIDER}${tilesMarkup(more)}`}`;
};

const form = requireId(document, 'searchForm');
const input = requireId(document, 'q');
const clearBtn = requireId(document, 'clearBtn');
const grid = requireId(document, 'grid');
const results = requireId(document, 'results');
const tiles: ReadonlyArray<Tile> = queryAllIn(grid, 'a.card').map(tileOf);

/** Whether what is typed names anything: a blank is nothing, and the grid shows. */
const searching = (): boolean => normalise(readValue(input)) !== '';

/** A height for the list: whole pixels, never less than one row. */
const px = (height: number): string => `${String(Math.max(MIN_ROOM, Math.floor(height)))}px`;

/** What is visible: the visual viewport (the keyboard's remainder), else the window. */
const visibleHeight = (): number => window.visualViewport?.height ?? window.innerHeight;

/** The bottom edge of what is visible, in the layout viewport's coordinates (what rectOf reports). */
const visibleBottom = (): number => {
  const vv = window.visualViewport;
  return vv === null ? window.innerHeight : vv.offsetTop + vv.height;
};

/** Scroll the page so the bar sits at the top of what is visible (a no-op once it is stuck there). */
const settle = (): void => {
  window.scrollTo({ top: window.scrollY + rectOf(form).top });
};

/** End the list at the visible edge, from wherever it starts. */
const trim = (): void => {
  if (!searching()) return;
  setStyle(results, 'height', px(visibleBottom() - rectOf(results).top));
};

/**
 * Size the results to what is visible. First as if the bar sat at the top: the visible height
 * less the bar-to-list offset (the bar and its margin), taken whole (not as a maximum), so the
 * page is always tall enough to scroll the bar there, which `settle` then does; then `trim` ends
 * the list at the visible edge from where it landed (a fractional offset, a page that could not
 * scroll the whole way). The tools line and the footer wait under the keyboard while searching.
 */
const fit = (): void => {
  if (!searching()) return;
  setStyle(results, 'height', px(visibleHeight() - (rectOf(results).top - rectOf(form).top)));
  settle();
  trim();
};

const paint = (): void => {
  const query = readValue(input);
  const key = normalise(query);
  const on = key !== '';
  setHidden(grid, on);
  setHidden(results, !on);
  setHidden(clearBtn, !on);
  // An empty query ranks everything on top (fuzzy.ts); the grid shows that, so the slot is emptied.
  ensureKeyed(results, key, () => {
    if (!on) return '';
    const { top, more } = rank(tiles, query);
    return resultsMarkup(top, more);
  });
  if (on) fit();
};

const clear = (): void => {
  setValue(input, '');
  paint();
  focusElement(input);
};

/** The first result as listed: the best of the top list, else the best of the lesser matches. */
const openTop = (): void => {
  const query = readValue(input);
  if (normalise(query) === '') return;
  const { top, more } = rank(tiles, query);
  const match = top[0] ?? more[0];
  if (match !== undefined) window.location.assign(match.href);
};

listen(input, 'input', paint);
listen(input, 'focus', settle);
listen(input, 'keydown', (e) => {
  if (keyOf(e) !== 'Escape') return;
  preventDefault(e);
  clear();
});
listen(form, 'submit', (e) => {
  preventDefault(e);
  openTop();
});
listen(clearBtn, 'click', clear);
// A resize (the keyboard opening or closing, a window resized) re-fits the list and settles the
// bar; a pan of the visual viewport under the keyboard only trims it: the finger owns the scroll.
listen(window, 'resize', fit);
const viewport = window.visualViewport;
if (viewport !== null) {
  listen(viewport, 'resize', fit);
  listen(viewport, 'scroll', trim);
}
paint();
