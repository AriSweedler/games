// The blocks every shell page.ts shares (docs/design/shell-hoist.md row J): the theme look, the
// head block, the guest's name card and the waiting rooms' seat list, each spelled once here and
// composed into the committed web/games/<g>/index.html by tools/shell-markup.ts (shell.ts
// `renderShell` places the last two itself for a page that says `seated: true`). A game's page.ts
// spells only its own values (its titles, its description, its extra head tags); gin's legacy page
// keeps its own look and head. These strings are the page's markup, not TypeScript that toggles a
// class, so test/dist/classes.ts reads them as markup through the composed page, as it reads every
// page.ts (the file is named page.ts for that filter). Pure: no file, no DOM; the one import is a
// type, so shell.ts reading this file is no cycle.
import type { ShellLook } from './shell.ts';

/**
 * The theme look (docs/design/shell-hoist.md row J): the one every page but gin spells, shell.css
 * carrying each look as a class (` resume`, `centered`, `muted`, ` curtain`, `history`) where gin's
 * legacy page carries inline styles. Uno, Flip 7, Hive, Briscola, Sheshbesh and Fidice share this
 * object; a page with its own look spreads it and names the fields that differ.
 */
export const THEME_LOOK: ShellLook = {
  resumeClass: ' resume',
  resumeStyle: '',
  resumeBtnKind: 'btn-primary',
  onlineActive: ' active',
  mt8: '',
  mt10: '',
  mt14: '',
  mb8: '',
  pt10: '',
  m0: '',
  noteLeft: 'class="empty-note left"',
  centeredBox: 'class="card-box centered"',
  pulseMuted: 'class="pulse muted"',
  joinBtnWidth: '',
  curtainClass: ' curtain',
  curtainStyle: '',
  curtainSheet: 'class="sheet centered"',
  betweenRow: 'class="row between"',
  historyClass: ' class="history"',
  toastAttrs: ' role="status"',
};

/**
 * What a shell page's `head` block spells for itself (docs/design/shell-hoist.md row J; the rest is
 * the same in every page). `slug` is the game's folder under web/games and its path on the live
 * origin; `name` the Open Graph and Twitter title; `tabTitle` the browser tab (`name` when absent);
 * `share` the text under the link preview (docs/design/link-previews.md §2); `imageAlt` the splash's
 * alt; `description` the search snippet, when the page has one; `extraTags` the page's own tags
 * after the icons and before the stylesheets (a manifest, a theme colour, a webfont), one per line.
 */
export type ShellHead = Readonly<{
  slug: string;
  name: string;
  tabTitle?: string;
  share: string;
  imageAlt: string;
  description?: string;
  extraTags?: ReadonlyArray<string>;
}>;

/**
 * The head block every shell page composes (`<!doctype html>` through `</head>`): the Open Graph
 * card the proxy and the chat apps read first (the 1200x630 splash tools/splash.ts renders, which
 * test/dist/link-previews.test.ts pins), then the charset, the viewport, the title, the icons and
 * the three shell sheets before the game's theme.css. One tag per line: tools/shell-markup.ts runs
 * Prettier over the composed page, so the wrapping is the formatter's, not this string's.
 */
export const headHtml = (head: ShellHead): string => {
  const live = `https://games.sweedler.com/${head.slug}/`;
  const tags: ReadonlyArray<string> = [
    `<meta property="og:title" content="${head.name}" />`,
    `<meta property="og:description" content="${head.share}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${live}" />`,
    `<meta property="og:image" content="${live}splash.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${head.imageAlt}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${head.name}" />`,
    `<meta name="twitter:description" content="${head.share}" />`,
    `<meta name="twitter:image" content="${live}splash.png" />`,
    `<meta charset="UTF-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`,
    `<title>${head.tabTitle ?? head.name}</title>`,
    ...(head.description === undefined
      ? []
      : [`<meta name="description" content="${head.description}" />`]),
    `<link rel="icon" href="../../shared/favicon.svg" type="image/svg+xml" />`,
    `<link rel="alternate icon" href="../../shared/favicon.ico" />`,
    ...(head.extraTags ?? []),
    `<link rel="stylesheet" href="../../shared/styles/tokens.css" />`,
    `<link rel="stylesheet" href="../../shared/styles/base.css" />`,
    `<link rel="stylesheet" href="../../shared/styles/shell.css" />`,
    `<link rel="stylesheet" href="./theme.css" />`,
  ];
  return [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    ...tags.map((tag) => `    ${tag}`),
    '  </head>',
  ].join('\n');
};

/**
 * The guest's name card under the wait screen's status (docs/design/shell-hoist.md row J;
 * web/shared/ui/shellPaint.ts `paintGuestName`; the owner, 2026-09-28: the client defines its own
 * name): "Playing as", the box prefilled with the seat's name as the host named it, Change (or
 * Enter) re-sending the join under what the box says (web/shared/ui/home.ts `bindHomeShell`,
 * shell.ts `name/rename`), and a note naming who sees it. Styled by id in each theme.css
 * (`#guestSeatName`, `#guestNameNote`; no new class); hidden until the host's welcome names the
 * seat. The four ids are each page's (tools/games.ts `pageShape.ids`), not SHELL_IDS: gin's page
 * leaves the block out for its DOM parity oracle, and fidice's has no guest name yet. A seated
 * page's `guestSeatName` block; hive's and backgammon's pages place it themselves.
 */
export const GUEST_SEAT_NAME = `      <div id="guestSeatName" class="hidden">
        <label for="guestNameInput">Playing as</label>
        <div class="row">
          <input type="text" id="guestNameInput" class="grow" maxlength="20" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" />
          <button class="btn btn-secondary btn-sm" id="guestRenameBtn">Change</button>
        </div>
        <div class="muted" id="guestNameNote"></div>
      </div>`;

/**
 * A waiting room's seat list (web/shared/ui/shellPaint.ts `paintWaiting`, SEAT_LIST_IDS;
 * docs/design/n-seat-sessions.md §7): one row per seat as the table fills, the host first, each
 * carrying data-seat, data-connected and, on this device's own, data-you (shell.css `.seat-list`).
 * Indented as waiting.html places the block.
 */
export const seatListHtml = (id: string): string =>
  `      <ul class="seat-list" id="${id}" aria-label="Seats"></ul>`;
