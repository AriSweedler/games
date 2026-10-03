// The shell's markup, spelled once (docs/design/dry-round-2.md §3 row G2, §5 Wave F row F2). A
// shell page (docs/design/shared-shell.md §3.1: the home screen, the waiting rooms, the curtain,
// the rules and history sheets, the toast) is the six partials under shell/ filled with the game's
// ShellPage (web/games/<g>/page.ts: its copy, its comment notes, how it spells each shell look, and
// its own markup) and composed by tools/shell-markup.ts into the committed web/games/<g>/index.html,
// which test/dist/shell-markup.test.ts pins to the render. Pure: strings in, a Result out, no file
// and no DOM, so the pure tsconfig compiles it and a game's page.ts imports only its types.
//
// A partial's `{{name}}` inline is a slot (a copy string, a comment note or a look). A line that is
// `{{name}}` alone, at column 0, is a block: the game's own markup replaces the line, carrying its
// own indentation and, where the page has one, the blank line above it; an empty block drops the
// line. A block is inserted verbatim (no placeholder inside it is filled), so a game's residue is
// the committed bytes cut out of its page. Every slot and block a page declares must be read by some
// partial and every placeholder filled: a hole no page fills or a value no partial reads is an error
// here, never a silent page.
import { err, ok, type Result } from '../lib/result.ts';
import { GUEST_SEAT_NAME, seatListHtml } from './page.ts';

/** The partials, web/shared/markup/shell/<name>.html: the page's skeleton, the five it lays out, and the pause sheet a page opts into (`ShellPage.pause`; sheets.html places it after the result). */
export const PARTIALS = ['page', 'home', 'waiting', 'curtain', 'sheets', 'toast', 'pause'] as const;
export type PartialName = (typeof PARTIALS)[number];
/** The five partials page.html places as blocks, by their names. */
const INNER = ['home', 'waiting', 'curtain', 'sheets', 'toast'] as const;
/** The partial a page places only when its game pauses (shell-hoist.md row H): its ids are not SHELL_IDS, as the result sheet's are not. */
export const OPT_IN_PARTIAL = 'pause' as const;
export type ShellTemplates = Readonly<Record<PartialName, string>>;

/**
 * The words the partials read inline (`{{modeOnline}}` …). A page spells the four only its game
 * knows and whatever it says differently from SHELL_COPY (`ShellCopy`): gin's room is
 * backgammon's table.
 */
type Copy = Readonly<{
  /** The online mode's label in `#playSubmenu` and `#playModeSwitch` ('🌐 Online', 'Online'). */
  modeOnline: string;
  /** The pass-and-play mode's label ('📱 Pass &amp; Play', 'Pass the phone'). */
  modeLocal: string;
  /** The host card's label ('Host a game', 'Open a table'); its fields and `#hostBtn` are the `hostFields` block. */
  hostLabel: string;
  /** The join card's label ('Join a game', 'Sit down at a table'). */
  joinLabel: string;
  /** `#joinBtn` ('Join', 'Sit down'). */
  joinBtnLabel: string;
  /** `#localBtn` ('Start pass &amp; play', 'Start'). */
  localBtnLabel: string;
  /** The note under `#localBtn`. */
  localNote: string;
  /** `#hostWaitScreen h1` ('Your room', 'Your table'). */
  hostWaitTitle: string;
  /** The line under it: who is to open the page ('Have your opponent open…', briscola's 'Have the others open…'). */
  hostWaitSubtitle: string;
  /** `#hostWaitStatus` as shipped, before the host's session writes it. */
  openingMsg: string;
  /** The waiting room's keep-this-screen-open note. */
  keepOpenNote: string;
  /** `#startGameBtn` ('Deal the first hand', 'Start the match'). */
  startLabel: string;
  /** `#curtainSub` as shipped ('' for gin, 'Your turn.' for backgammon). */
  curtainSub: string;
  /** `#curtainBtn` ('Show my cards', 'Roll'). */
  revealLabel: string;
  /** The rules sheet's title. */
  rulesTitle: string;
  /** The history sheet's title ('Hand history', 'This game'). */
  historyTitle: string;
}>;

/** The four words only the game knows: how its pass-and-play goes, what starting and revealing are called, what its history lists. */
type OwnWords = 'localNote' | 'startLabel' | 'revealLabel' | 'historyTitle';

/**
 * The copy every table page spells alike, read where the page says nothing (uno, flip7 and
 * briscola say every line of it; fidice names its host and join cards its own way; hive and
 * backgammon say "your opponent" where a table of many says "the others"; gin's room spells each
 * line as the legacy page did). The curtain's line under its title is empty but for backgammon's.
 */
export const SHELL_COPY: Readonly<Omit<Copy, OwnWords>> = {
  modeOnline: 'Online',
  modeLocal: 'Pass the phone',
  hostLabel: 'Open a table',
  joinLabel: 'Sit down at a table',
  joinBtnLabel: 'Sit down',
  localBtnLabel: 'Start',
  hostWaitTitle: 'Your table',
  hostWaitSubtitle: 'Have the others open this same page and enter the code',
  openingMsg: 'Opening the table…',
  keepOpenNote:
    'Keep this screen open while the others sit down. If you switch apps, come straight back and the table reconnects on its own.',
  curtainSub: '',
  rulesTitle: 'Rules',
};

/** What a page spells of its copy: the four words only it knows, and any line of SHELL_COPY it says differently. */
export type ShellCopy = Readonly<Pick<Copy, OwnWords> & Partial<Omit<Copy, OwnWords>>>;

/** What a page's HTML comments say beyond the shared section names: each '' or the page's own words. */
export type ShellNotes = Readonly<{
  /** After `HOME / LOBBY` (backgammon names its design doc there, over two lines). */
  homeNote: string;
  /** After `RULES TAB`. */
  rulesTabNote: string;
  /** The glossary doc the ABOUT TAB comment names: gin spells the path, backgammon the file. */
  glossaryDoc: string;
  /** After `#aboutPanel`'s closing tag: gin's `<!-- /about -->` marker. */
  aboutClose: string;
  /** After `PASS-AND-PLAY CURTAIN`. */
  curtainNote: string;
}>;

/**
 * How the page spells each shell look at the spots the partials share. Gin's page is the legacy
 * page's markup and carries its looks as inline styles (the 36 the design row counts, emitted
 * verbatim); backgammon's carries its theme's classes. Each value is the attribute text at the
 * spot, '' where the page has none; the ones that stand for a whole attribute list say so.
 */
export type ShellLook = Readonly<{
  /** `#resumeBox`: a class after `card-box` (` resume`) and a style after `hidden` (gin's amber border). */
  resumeClass: string;
  resumeStyle: string;
  /** `#resumeBtn`'s kind between `btn` and `btn-block` (`btn-gold`, `btn-primary`). */
  resumeBtnKind: string;
  /** `#playModeSwitch`'s online button: backgammon ships it ` active`; gin paints that at boot. */
  onlineActive: string;
  /** Gin's ` style="margin-top:8px;"` under a card's label, where backgammon's theme spaces it. */
  mt8: string;
  /** Gin's ` style="margin-top:10px;"` on the waiting room's buttons and `#historyList`. */
  mt10: string;
  /** Gin's ` style="margin-top:14px;"` on `#closeRulesBtn`. */
  mt14: string;
  /** Gin's ` style="margin-bottom:8px;"` on `#curtainLast`. */
  mb8: string;
  /** Gin's ` style="padding-top:10px;"` on the waiting room's keep-open note. */
  pt10: string;
  /** Gin's ` style="margin:0;"` on the history sheet's title beside its close button. */
  m0: string;
  /** Attribute list: an `empty-note` aligned left (backgammon's `left`; gin pads it inline too). */
  noteLeft: string;
  /** Attribute list: a centred `card-box` (backgammon's `centered`). */
  centeredBox: string;
  /** Attribute list: the waiting rooms' muted `pulse` status (backgammon's `muted`). */
  pulseMuted: string;
  /** `#joinBtn`: gin's ` style="min-width:96px;"`. */
  joinBtnWidth: string;
  /** `#curtainOverlay`: a class after `overlay` (` curtain`: the shell's scrim, `--curtain-scrim`; every page since gin's inline felt became the token's default) and a style after `hidden` (none today). */
  curtainClass: string;
  curtainStyle: string;
  /** Attribute list: the curtain's `sheet` (backgammon's `centered`; gin centres it inline and colours its border). */
  curtainSheet: string;
  /** Attribute list: the history sheet's title `row` (backgammon's `between`). */
  betweenRow: string;
  /** `#historyList`'s class attribute (backgammon's `history`), before its id. */
  historyClass: string;
  /** `#toast`'s attributes after its id (backgammon's ` role="status"`). */
  toastAttrs: string;
}>;

/**
 * The game's own markup, verbatim from its page: the residue the design row lists per game (gin:
 * table, endgame, six sheets, the scorer's screens, the sandbox and score panels, head, its target
 * inputs; backgammon: table, endgame, its sheets, head, its selects). Each is lines carrying their
 * own indentation; a block that follows a blank line in the page begins with that blank line. The
 * five without a `?` every page spells. The rest are extension slots: absent, one is '' and ''
 * drops its line, so a page without it composes byte for byte as if it had spelled ''; `endgame`
 * absent is `endgamePlaceholder`'s screen, and a page that says `seated: true` (ShellPage) gets
 * the two seat lists and the guest's name card without spelling them.
 */
export type ShellBlocks = Readonly<{
  /** `<!DOCTYPE html>` through `</head>`: the metadata, the title and the stylesheet links. */
  head: string;
  /** The heading inside `#homeScreen`. */
  masthead: string;
  /** `#playSubmenu`'s buttons after Online and Pass & Play (gin's hidden Sandbox). */
  submenuExtra?: string;
  /** `#topTabbar`'s buttons between Rules and About (gin's Score). */
  extraTabs?: string;
  /** `#playModeSwitch`'s buttons after the two (gin's hidden Sandbox). */
  switchExtra?: string;
  /** The host card between its label and its note, `#hostBtn` included (BLOCK_IDS). */
  hostFields: string;
  /** `#localModeContent` before `#localBtn`, `#p1NameInput` and `#p2NameInput` included (BLOCK_IDS). */
  localFields: string;
  /** `#playPanel` after `#localModeContent` (gin's sandbox panel). */
  playExtra?: string;
  /**
   * `#playPanel`'s last child, after the mode panels: gin's fourth card `#homeRecent` (the recent
   * games, or "How it goes" for a fresh player), which fills the band a three-card form leaves under
   * itself on a tall phone (docs/design/space-audit.md §5 "Closed by gin-home-column-bottom").
   */
  homeExtra?: string;
  /**
   * The seat list under `#hostWaitStatus` (`#seatList`, shellPaint.ts SEAT_LIST_IDS: an N-seat
   * page's, docs/design/n-seat-sessions.md §7): a seated page's is the shell's (page.ts `seatListHtml`),
   * fidice's carries the host's lobby controls under it, backgammon's is its phone cue, and a
   * two-seat page's room has one seat to list.
   */
  hostWaitList?: string;
  /** The same under `#guestWaitStatus` (`#guestSeatList`). */
  guestWaitList?: string;
  /**
   * The guest's own seat as the host named it, under that list (page.ts GUEST_SEAT_NAME; shellPaint.ts
   * `paintGuestName`): a seated page's and the two-seat pages' (hive, backgammon); none for gin,
   * whose composed DOM the parity oracle (tools/parity/gin-dom-parity.ts) holds to the legacy page
   * checkpoint for checkpoint, and for fidice, whose seat list's ` · you` row already names my seat
   * (no "Playing as …" line until the restyle decides; web/games/fidice/page.ts).
   */
  guestSeatName?: string;
  /** `#homeScreen`'s panels between Rules and About (gin's score panel). */
  extraPanels?: string;
  /** `#app`'s screens between the home and the waiting rooms (gin's scorer). */
  extraScreens?: string;
  /** `#tableScreen`. */
  table: string;
  /** `#endgameScreen`: the game's, or `endgamePlaceholder`'s where the game ends over its table. */
  endgame?: string;
  /** The curtain sheet's first line (gin's phone emoji). */
  curtainIcon?: string;
  /**
   * The result sheet (docs/design/shell-hoist.md row G; `resultMarkup` below): where a game ends
   * over its table, placed by sheets.html before the rules sheet. A page whose game ends elsewhere
   * (gin's round sheet and endgame, fidice's ladder, Flip 7's panel in the table) leaves it out.
   */
  result?: string;
  /** The game's overlays between the curtain and the result sheet. */
  sheetsBefore?: string;
  /** The game's overlays between the history sheet and the toast. */
  sheetsAfter?: string;
  /** The rules sheet's first line (gin's book emoji). */
  rulesIcon?: string;
}>;

/** One shell page: what web/games/<g>/page.ts declares and tools/shell-markup.ts composes. */
export type ShellPage = Readonly<{
  copy: ShellCopy;
  notes: ShellNotes;
  look: ShellLook;
  blocks: ShellBlocks;
  /**
   * The page seats a table of many (docs/design/n-seat-sessions.md §7; uno, flip7, briscola): the
   * shell spells its two seat lists and the guest's name card (`SEATED_BLOCKS`), so the page
   * declares none of the three, and declaring one is an error here.
   */
  seated?: true;
  /**
   * The game holds a consequential event until Continue (shell-hoist.md row H; flip7's bust, freeze
   * and Flip 7): sheets.html places the pause partial (`pause.html`: `#pauseOverlay`, `#pauseTitle`,
   * `#pauseDetail`, `#continueBtn`) after the result sheet, indented as the page's blocks are; the
   * shell paints and binds it (shellPaint.ts `paintShellSheets`, `bindShellSheets`).
   */
  pause?: true;
  /**
   * The game plays with the phone sideways (its `ShellConfig.orientation`,
   * docs/design/shared-shell.md "Playing sideways"): the composed page's `<body>` carries
   * `data-plays="landscape"`, which scopes shell.css's two-column landscape home and waiting rooms
   * to it, so a page that stays upright (gin's, briscola's) is untouched byte for byte. Its
   * `sheetsBefore` also carries `gateMarkup(...)`. The body's other attribute, `data-flip`, is the
   * boot's paint, never the markup's (web/shared/ui/shellPaint.ts `paintFlip`: the far seat's flip).
   */
  plays?: 'landscape';
  /**
   * The game wants the shell's screen frame (docs/design/screen-frame.md; web/shared/styles/shell.css
   * "the screen frame"): the composed `<body>` carries `data-frame`, which scopes the band, its
   * corners and #app's clearance to it; the theme dresses it with `--frame-band`, `--frame-color`
   * and `--frame-hairline` on `:root`. Backgammon's trim; gin, briscola and fidice go without.
   */
  frame?: true;
}>;

/** The body attribute list a page's `plays` and `frame` spell (page.html `<body{{bodyAttrs}}>`): '' for an upright, frameless page. */
export const bodyAttrsOf = (page: Pick<ShellPage, 'plays' | 'frame'>): string =>
  `${page.plays === 'landscape' ? ' data-plays="landscape"' : ''}${page.frame === true ? ' data-frame' : ''}`;

/** The turn gate's words: the title, the line under it, and its two buttons (the second ships hidden). */
export type GateCopy = Readonly<{
  title: string;
  sub: string;
  goLabel: string;
  keepLabel: string;
}>;

/** The gate's ids, in the markup's order: the sheet, its two texts, its two buttons. The game's `pageShape.ids` (tools/games.ts) carries them; SHELL_IDS never does. */
export const GATE_IDS: ReadonlyArray<string> = [
  'turnGate',
  'turnGateTitle',
  'turnGateSub',
  'turnGateGoBtn',
  'turnGateKeepBtn',
];

/**
 * The turn gate (docs/design/backgammon-landscape.md §5D; web/shared/ui/shell.ts `gateOpen`,
 * shellPaint.ts `paintGate`): the block a game that plays sideways puts in its `sheetsBefore`, a
 * body sibling after the curtain and painted over it (shell.css: z-index 90; the theme paints its
 * scrim). `#turnGateGoBtn` ships hidden: the Android lock PR shows and binds it. The glyph is a
 * phone outline and a quarter turn's arc with its arrowhead, 36px (shell.css .turn-glyph), one
 * stroke in the accent. Indented as page.html's blocks are (four spaces), the comment first.
 */
export const gateMarkup = (copy: GateCopy): string => `
    <!-- TURN GATE (docs/design/backgammon-landscape.md §5D; web/shared/markup/shell.ts gateMarkup): a
         phone held upright at the table. A body sibling after the curtain, painted over it
         (shell.css: z-index 90); the boot paints it from the App (web/shared/ui/shell.ts gateOpen,
         shellPaint.ts paintGate) and sets inert on #app and every other overlay while it is up. -->
    <div
      id="turnGate"
      class="overlay hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="turnGateTitle"
    >
      <div class="sheet centered">
        <div class="turn-glyph" aria-hidden="true">
          <svg viewBox="0 0 64 64" focusable="false">
            <rect x="18" y="8" width="20" height="48" rx="4" />
            <path d="M46 14a26 26 0 0 1 0 36" />
            <path d="M39 43l7 7 7-7" />
          </svg>
        </div>
        <div class="sheet-title" id="turnGateTitle">${copy.title}</div>
        <div class="sheet-sub" id="turnGateSub">${copy.sub}</div>
        <button class="btn btn-go btn-block hidden" id="turnGateGoBtn">${copy.goLabel}</button>
        <button class="btn btn-ghost btn-block btn-sm" id="turnGateKeepBtn">${copy.keepLabel}</button>
      </div>
    </div>`;

/** One of the result sheet's two buttons: the id the game's render.ts binds and its label. */
export type ResultButton = Readonly<{ id: string; label: string }>;

/**
 * What a game's result sheet says of itself (docs/design/shell-hoist.md row G): the one sheet
 * every game ends on, in the four spellings the games had, now data. `note` is the HTML comment
 * above it (the design row or the owner's words); `sub` places `#rsSub` under the title (briscola's
 * score line, backgammon's how-it-ended); `score` is the one element under those, `#rsScore`:
 * `list`, a `score-list` of `.score-row`s (uno's cards left, briscola's points per side; shell.css),
 * `line`, backgammon's one `score-line` of text (its theme's), or `note`, hive's muted paragraph
 * (`result-note`, its theme's); `continueBtn` puts a Continue before the primary (hive: the shell's
 * `result/dismiss`, the board left on show); `primary` is the green call to action (Play again,
 * Next game; none on a sheet whose Continue is the one call, the scaffold's) and `secondary` the
 * ghost under it (Leave the table, Look at the table), each by the id the game binds. The painter
 * is web/shared/ui/shellPaint.ts `paintResult`.
 */
export type ResultSheet = Readonly<{
  note: string;
  sub?: true;
  score: 'list' | 'line' | 'note';
  continueBtn?: true;
  primary?: ResultButton;
  secondary: ResultButton;
}>;

/** The sheet's fixed ids, in the markup's order (the buttons' are the game's, `ResultSheet`): the overlay, the title, the line under it, the score. Not SHELL_IDS: a page without the sheet carries none. */
export const RESULT_IDS: ReadonlyArray<string> = ['resultOverlay', 'rsTitle', 'rsSub', 'rsScore'];

/** The pause partial's ids in its order (pause.html; shell-hoist.md row H): the overlay, the title, the line under it, Continue (web/shared/ui/shellPaint.ts paints and binds them). Not SHELL_IDS: a page carries them only with `ShellPage.pause`. */
export const PAUSE_IDS: ReadonlyArray<string> = [
  'pauseOverlay',
  'pauseTitle',
  'pauseDetail',
  'continueBtn',
];

/** `#rsScore` per `ResultSheet.score`: the element and its class. */
const SCORE_MARKUP: Readonly<Record<ResultSheet['score'], string>> = {
  list: '<div class="score-list" id="rsScore"></div>',
  line: '<div class="score-line" id="rsScore"></div>',
  note: '<p class="result-note" id="rsScore"></p>',
};

/**
 * The result sheet's block (sheets.html `{{result}}`, before the rules sheet): the comment, then the
 * overlay with its centred sheet, the title, the optional line under it, the score, the optional
 * Continue, the green primary and the ghost secondary. Indented as the page's blocks are (four
 * spaces); a blank line follows it, as one did in every page.
 */
export const resultMarkup = (sheet: ResultSheet): string =>
  [
    `    <!-- RESULT: ${sheet.note} -->`,
    '    <div id="resultOverlay" class="overlay hidden">',
    '      <div class="sheet centered">',
    '        <div class="sheet-title" id="rsTitle">Game over</div>',
    ...(sheet.sub === true ? ['        <div class="sheet-sub" id="rsSub"></div>'] : []),
    `        ${SCORE_MARKUP[sheet.score]}`,
    ...(sheet.continueBtn === true
      ? ['        <button class="btn btn-secondary btn-block" id="rsContinueBtn">Continue</button>']
      : []),
    ...(sheet.primary === undefined
      ? []
      : [
          `        <button class="btn btn-go btn-block" id="${sheet.primary.id}">${sheet.primary.label}</button>`,
        ]),
    `        <button class="btn btn-ghost btn-block btn-sm" id="${sheet.secondary.id}">${sheet.secondary.label}</button>`,
    '      </div>',
    '    </div>',
    '',
  ].join('\n');

/** Every block as renderShell reads them: the page's over the defaults, and the pause partial's lines where the page opts in. */
type Blocks = Readonly<Required<ShellBlocks> & { pause: string }>;

/** A partial's text as a block placed at the sheets' depth (four spaces); blank lines stay bare, and its file's final newline leaves one after it, as the result block has. */
const indented = (partial: string): string =>
  partial
    .split('\n')
    .map((line) => (line === '' ? line : `    ${line}`))
    .join('\n');

/** The three blocks a page with `seated: true` gets from the shell: the host's and the guest's seat lists, the guest's name card. */
const SEATED_BLOCKS: Readonly<Pick<Blocks, 'hostWaitList' | 'guestWaitList' | 'guestSeatName'>> = {
  hostWaitList: seatListHtml('seatList'),
  guestWaitList: seatListHtml('guestSeatList'),
  guestSeatName: GUEST_SEAT_NAME,
};

/** `text` as the pages wrap a block's comment: greedy at `width` columns, the first line behind `first`, the rest behind `rest`. */
const wrapped = (text: string, first: string, rest: string, width = 100): string =>
  text
    .split(' ')
    .reduce<ReadonlyArray<string>>((lines, word) => {
      const last = lines.at(-1);
      return last !== undefined && `${last} ${word}`.length <= width
        ? [...lines.slice(0, -1), `${last} ${word}`]
        : [...lines, `${lines.length === 0 ? first : rest}${word}`];
    }, [])
    .join('\n');

/**
 * The endgame screen of a page whose game ends somewhere else (uno's and hive's result sheet,
 * Flip 7's panel over the table): the shell's fifth screen, which the page never shows, hidden
 * with its heading, the comment above it saying where the game ends instead (`ends`, a sentence).
 * Indented as page.html's blocks are (six spaces), the comment wrapped at 100 columns as the pages
 * wrote it. The default `endgame` block says the result sheet over the table.
 */
export const endgamePlaceholder = (ends: string): string =>
  [
    wrapped(
      `<!-- ENDGAME: the shell's fifth screen, which this page never shows: ${ends} -->`,
      '      ',
      '           ',
    ),
    '      <div id="endgameScreen" class="hidden">',
    '        <h1>Game over</h1>',
    '      </div>',
  ].join('\n');

/** What an extension slot is when the page leaves it out: nothing, but for the endgame screen (the pause partial is the page's opt-in, `renderShell`). */
const BLOCK_DEFAULTS: Readonly<
  Omit<Blocks, 'head' | 'masthead' | 'hostFields' | 'localFields' | 'table' | 'pause'>
> = {
  submenuExtra: '',
  extraTabs: '',
  switchExtra: '',
  playExtra: '',
  homeExtra: '',
  hostWaitList: '',
  guestWaitList: '',
  guestSeatName: '',
  extraPanels: '',
  extraScreens: '',
  endgame: endgamePlaceholder('the game ends on the result sheet over the table.'),
  curtainIcon: '',
  result: '',
  sheetsBefore: '',
  sheetsAfter: '',
  rulesIcon: '',
};

/**
 * The shell ids (web/shared/ui/ids.ts SHELL_IDS) the partials cannot spell, each in the block that
 * places it. The two pages lay the options out differently: `#hostBtn` sits inside gin's target row
 * and after backgammon's selects, and the two name inputs are two labelled boxes in gin and one row
 * in backgammon. The table and the endgame are each game's own screens (the design row's residue),
 * but the shell paints the table's sound and handoff buttons and binds its rules and history
 * buttons, so their ids are shell ids the table block carries. renderShell refuses a block that
 * lacks one of its ids or repeats it; the drift test pins the partials' ids plus these and
 * SCREEN_IDS to SHELL_IDS.
 */
export const BLOCK_IDS: Readonly<
  Record<'hostFields' | 'localFields' | 'table' | 'endgame', ReadonlyArray<string>>
> = {
  hostFields: ['hostBtn'],
  localFields: ['p1NameInput', 'p2NameInput'],
  table: ['tableScreen', 'soundBtn', 'handoffBtn', 'rulesBtnGame', 'historyBtn'],
  endgame: ['endgameScreen'],
};

/**
 * The shell ids either the table or the endgame block places, exactly once between them: gin's
 * `#leaveBtn` is in the table's topbar, backgammon's on the endgame screen (its table has the menu).
 */
export const SCREEN_IDS: ReadonlyArray<string> = ['leaveBtn'];

/** Every `id="..."` attribute in some markup, in order, repeats included (a `data-id` is not one; the one capture is the id). */
export const idsIn = (markup: string): ReadonlyArray<string> =>
  [...markup.matchAll(/(?:^|\s)id="([^"]+)"/g)].flatMap((m: ReadonlyArray<string>) => m.slice(1));

/** A line that is one placeholder at column 0: a block; its name is the line without the braces. */
const BLOCK_LINE = /^\{\{\w+\}\}$/;
/** A placeholder inline: a slot. Split on it, the odd parts are the names. */
const SLOT = /\{\{(\w+)\}\}/;

type Values = Readonly<Record<string, string>>;
type Filled = Readonly<{
  lines: ReadonlyArray<string>;
  used: ReadonlyArray<string>;
  errors: ReadonlyArray<string>;
}>;
/** An inner partial filled, by the name page.html places it under. */
type Inner = Readonly<{ name: PartialName; filled: Filled }>;

/** One line filled: a block line becomes its block's lines (none when empty), any other line has its slots substituted. */
const fillLine = (line: string, slots: Values, blocks: Values, where: string): Filled => {
  if (BLOCK_LINE.test(line)) {
    const name = line.slice(2, -2);
    const value = blocks[name];
    if (value === undefined) {
      return { lines: [line], used: [], errors: [`${where}: no block named "${name}"`] };
    }
    return { lines: value === '' ? [] : [value], used: [name], errors: [] };
  }
  const parts = line.split(SLOT);
  const names = parts.filter((_, i) => i % 2 === 1);
  return {
    lines: [parts.map((part, i) => (i % 2 === 1 ? (slots[part] ?? '') : part)).join('')],
    used: names,
    errors: names
      .filter((name) => slots[name] === undefined)
      .map((name) => `${where}: no slot named "${name}"`),
  };
};

/** A whole partial filled, line by line; the errors name the partial and the line. */
const fillTemplate = (name: PartialName, template: string, slots: Values, blocks: Values): Filled =>
  template
    .split('\n')
    .map((line, i) => fillLine(line, slots, blocks, `${name}.html:${String(i + 1)}`))
    .reduce(
      (acc, one) => ({
        lines: [...acc.lines, ...one.lines],
        used: [...acc.used, ...one.used],
        errors: [...acc.errors, ...one.errors],
      }),
      { lines: [], used: [], errors: [] },
    );

/** The ids in `markup` that are not exactly once among `ids`. */
const notOnce = (ids: ReadonlyArray<string>, markup: string): ReadonlyArray<string> =>
  ids.filter((id) => idsIn(markup).filter((seen) => seen === id).length !== 1);

/** The ids a block must place (BLOCK_IDS, SCREEN_IDS) that it lacks or repeats. */
const blockIdErrors = (blocks: Blocks): ReadonlyArray<string> => [
  ...(Object.keys(BLOCK_IDS) as ReadonlyArray<keyof typeof BLOCK_IDS>).flatMap((block) =>
    notOnce(BLOCK_IDS[block], blocks[block]).map(
      (id) => `the ${block} block must carry id="${id}" exactly once`,
    ),
  ),
  ...notOnce(SCREEN_IDS, `${blocks.table}\n${blocks.endgame}`).map(
    (id) => `the table and endgame blocks must carry id="${id}" exactly once between them`,
  ),
];

/** The seated blocks a seated page spells itself: the shell spells them, so each is an error. */
const seatedErrors = (page: ShellPage): ReadonlyArray<string> =>
  page.seated === true
    ? Object.keys(SEATED_BLOCKS)
        .filter((name) => name in page.blocks)
        .map((name) => `the page is seated: the shell spells its "${name}" block`)
    : [];

/**
 * The page, byte for byte as the partials and the page's values spell it: the five inner partials
 * filled and placed into page.html (each without its file's final newline, page.html with it),
 * the page's copy over SHELL_COPY and its blocks over the slots' defaults (and, for a seated page,
 * SEATED_BLOCKS). An Err lists every unfilled placeholder, every unused value and every block id
 * missing or repeated.
 */
export const renderShell = (templates: ShellTemplates, page: ShellPage): Result<string, string> => {
  const declared: Values = { ...page.copy, ...page.notes, ...page.look };
  // The composer's own slot beside the page's: page.html's `<body{{bodyAttrs}}>`.
  const slots: Values = { ...SHELL_COPY, ...declared, bodyAttrs: bodyAttrsOf(page) };
  const own: Blocks = {
    ...BLOCK_DEFAULTS,
    ...(page.seated === true ? SEATED_BLOCKS : {}),
    ...page.blocks,
    pause: page.pause === true ? indented(templates[OPT_IN_PARTIAL]) : '',
  };
  const inner: ReadonlyArray<Inner> = INNER.map((name) => ({
    name,
    filled: fillTemplate(name, templates[name], slots, own),
  }));
  const placed: Values = Object.fromEntries(
    inner.map((one) => [one.name, one.filled.lines.join('\n').replace(/\n$/, '')]),
  );
  const whole = fillTemplate('page', templates.page, slots, { ...own, ...placed });
  const all = [...inner.map((one) => one.filled), whole];
  const used = new Set(all.flatMap((f) => f.used));
  // The defaults are the shell's, so only what the page itself declares is checked.
  const unused = [...Object.keys(declared), ...Object.keys(page.blocks)]
    .filter((name) => !used.has(name))
    .map((name) => `"${name}" is declared by the page but no partial reads it`);
  // A page that plays sideways needs the body slot placed, or its attribute would be lost in silence.
  const unplayed =
    page.plays !== undefined && !used.has('bodyAttrs')
      ? [`the page plays ${page.plays} but no partial places {{bodyAttrs}} on the body`]
      : [];
  const errors = [
    ...all.flatMap((f) => f.errors),
    ...unused,
    ...unplayed,
    ...seatedErrors(page),
    ...blockIdErrors(own),
  ];
  return errors.length === 0 ? ok(whole.lines.join('\n')) : err(errors.join('\n'));
};
