// Hive's link-preview card, composed (docs/design/link-previews.md §2; the owner, 2026-10-02: "The
// richlink for hive still contains the old art", "fix the splash pipeline first"). The other games'
// cards are drawn by hand; Hive's is built from the art the page draws: the five bug files under
// web/games/hive/assets/bugs/ become the same `<symbol>`s the page's sprite holds and each tile draws
// its bug with the same four-layer engraving (web/games/hive/src/ui/engrave.ts `symbolOf`,
// `bugHtml`, `TILE_DEFS`), on the board's own hexagon (ui/board.ts `cornersOf`), coloured by the
// theme's tokens read off web/games/hive/theme.css. So a change to a bug, to the engraving or to
// the palette changes the card, and tools/splash.test.ts fails until `node
// --experimental-strip-types tools/splash.ts` recomposes web/games/hive/assets/splash.svg (the one
// source tools/splash.ts renders) and re-renders the PNG. Pure over the file texts: `composeHiveSplash`
// is deterministic (no time, no random), so the test compares it with the committed SVG byte for byte.
import { BUGS, type Bug, type Side } from '../web/games/hive/src/engine/pieces.ts';
import { centerOf, cornersOf, type Point } from '../web/games/hive/src/ui/board.ts';
import { TILE_DEFS, bugHtml, symbolOf } from '../web/games/hive/src/ui/engrave.ts';
import { readRepoFile } from './legacy/extract.ts';

/** The card's size, tools/splash.ts's SPLASH_WIDTH by SPLASH_HEIGHT (passed in: splash.ts imports this module). */
export type Card = Readonly<{ width: number; height: number }>;

/** The art the card is built from, repo-relative. */
export const BUG_FILE = (bug: Bug): string => `web/games/hive/assets/bugs/${bug}.svg`;
export const THEME_FILE = 'web/games/hive/theme.css';

/** One tile of the card's hive: its axial hex (ui/board.ts `centerOf`), its side and its bug. */
export type SplashTile = Readonly<{ q: number; r: number; side: Side; bug: Bug }>;

/**
 * A flower of seven: White's Queen at the centre and a ring that alternates sides, so every bug
 * shows at least once and each side has a Queen, as a game a few moves in looks.
 */
export const SPLASH_TILES: ReadonlyArray<SplashTile> = [
  { q: 0, r: 0, side: 'white', bug: 'queen' },
  { q: 1, r: 0, side: 'black', bug: 'ant' },
  { q: 0, r: 1, side: 'white', bug: 'spider' },
  { q: -1, r: 1, side: 'black', bug: 'queen' },
  { q: -1, r: 0, side: 'white', bug: 'grasshopper' },
  { q: 0, r: -1, side: 'black', bug: 'beetle' },
  { q: 1, r: -1, side: 'white', bug: 'ant' },
];

/** The hive's place on the card: its centre in card pixels and the tile unit's size (board.ts SIZE = 10 is a hex's circumradius). */
export const HIVE_AT: Point = { x: 335, y: 315 };
export const HIVE_SCALE = 7.5;

/** The side's class on the page (theme.css `.hex.w`, `.hex.b`). */
const sideClass = (side: Side): 'w' | 'b' => (side === 'white' ? 'w' : 'b');

const TOKEN = /--([\w-]+):\s*([^;]+);/g;
/** The tokens the card reads: the accent, the two sides' tiles and the bugs' colours. */
const TOKEN_PREFIXES = ['accent', 'hive-', 'bug-'];

/**
 * The theme's custom properties, as declared in its first `:root` block, kept to the ones the
 * card's style reads, in the theme's order: `--name: value;` lines for the card's own `<style>`.
 */
export const themeTokens = (css: string): ReadonlyArray<string> => {
  const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  return [...root.matchAll(TOKEN)]
    .map((m) => ({ name: m[1] ?? '', value: (m[2] ?? '').trim() }))
    .filter(({ name }) => TOKEN_PREFIXES.some((p) => name.startsWith(p)))
    .map(({ name, value }) => `--${name}: ${value};`);
};

/**
 * The card's style: the theme's rules for a tile's face, its sheen and bevel and the engraving's
 * four layers (theme.css "A cell's face", "The depth", "The bug, engraved"), over the tokens; the
 * face's edge colours are the theme's literals. The type is the card's own.
 */
const styleOf = (tokens: ReadonlyArray<string>): string => {
  const inks = BUGS.flatMap((bug) => [
    `.w .bug[data-bug='${bug}'] .ink { color: var(--bug-${bug}-cream); }`,
    `.b .bug[data-bug='${bug}'] .ink { color: var(--bug-${bug}-dark); }`,
  ]);
  return [
    `svg { ${tokens.join(' ')} }`,
    '.hex .face { stroke-width: 0.5; filter: url(#hive-shadow); }',
    '.hex.w .face { fill: var(--hive-white); stroke: #cbbf9f; }',
    '.hex.b .face { fill: var(--hive-black); stroke: #57555c; }',
    '.hex .sheen { fill: url(#hive-sheen); stroke: url(#hive-edge); stroke-width: 0.7; }',
    '.bug .rim { color: var(--bug-rim); }',
    '.w .bug .shade { color: var(--bug-shade-cream); }',
    '.w .bug .gleam { color: var(--bug-gleam-cream); }',
    '.b .bug .shade { color: var(--bug-shade-dark); }',
    '.b .bug .gleam { color: var(--bug-gleam-dark); }',
    ...inks,
    ".title { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 148px; fill: var(--accent); }",
    ".copy { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 32px; fill: var(--hive-white); fill-opacity: 0.8; }",
    ".domain { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 26px; fill: var(--hive-white); fill-opacity: 0.5; letter-spacing: 1px; }",
  ].join('\n    ');
};

/** One tile as the page draws it (ui/render.ts `faceHtml`): the face, the sheen over it, the bug engraved. */
const tileHtml = (tile: SplashTile): string => {
  const c = centerOf(tile);
  return `<g class="hex ${sideClass(tile.side)}"><polygon class="face" points="${cornersOf(c)}" /><polygon class="sheen" points="${cornersOf(c, 1.1)}" />${bugHtml(tile.bug, c)}</g>`;
};

/**
 * The card from its sources: the bug files' texts by bug and the theme's css. The felt is the
 * shared one (web/shared/styles/tokens.css `--felt`, as gin's card paints it); the hive sits left
 * and the name right, one accent (the amber title), one line of copy, the domain small.
 */
export const composeHiveSplashFrom = (
  card: Card,
  files: Readonly<Record<Bug, string>>,
  themeCss: string,
): string => {
  const symbols = BUGS.map((bug) => symbolOf(bug, files[bug])).join('\n    ');
  const tiles = SPLASH_TILES.map(tileHtml).join('\n      ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(card.width)}" height="${String(card.height)}" viewBox="0 0 ${String(card.width)} ${String(card.height)}" role="img" aria-label="Hive">
  <!-- GENERATED by tools/splash-hive.ts (docs/design/link-previews.md §2) from web/games/hive/assets/bugs/*.svg,
       web/games/hive/theme.css and src/ui/engrave.ts: the page's own tiles and engraved bugs on the shared
       felt. Do not edit: run tools/splash.ts (its header has the command), which rewrites this file and
       renders web/public/games/hive/splash.png from it. (An XML comment cannot hold a double hyphen.) -->
  <style>
    ${styleOf(themeTokens(themeCss))}
  </style>
  <defs>
    <radialGradient id="felt" cx="50%" cy="30%" r="80%">
      <stop offset="0" stop-color="#1f5a3a"/>
      <stop offset="0.55" stop-color="#123a26"/>
      <stop offset="1" stop-color="#0b2418"/>
    </radialGradient>
    ${TILE_DEFS}
    ${symbols}
  </defs>
  <rect width="${String(card.width)}" height="${String(card.height)}" fill="url(#felt)"/>
  <g transform="translate(${String(HIVE_AT.x)} ${String(HIVE_AT.y)}) scale(${String(HIVE_SCALE)})">
      ${tiles}
  </g>
  <text class="title" x="600" y="318">Hive</text>
  <text class="copy" x="606" y="392">Place the bugs. Surround the Queen.</text>
  <text class="domain" x="1104" y="580" text-anchor="end">games.sweedler.com</text>
</svg>
`;
};

/** The card from the repo's files as they are on disk. */
export const composeHiveSplash = (card: Card): string =>
  composeHiveSplashFrom(
    card,
    Object.fromEntries(BUGS.map((bug) => [bug, readRepoFile(BUG_FILE(bug))])) as Record<
      Bug,
      string
    >,
    readRepoFile(THEME_FILE),
  );
