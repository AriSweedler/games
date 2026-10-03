// Hive's shell page (docs/design/hive.md §7; docs/design/dry-round-2.md §3 row G2): what
// tools/shell-markup.ts fills web/shared/markup/shell/*.html with to compose ./index.html, which
// test/dist/shell-markup.test.ts pins byte for byte. The home is the shell's (the host card, the
// join card, Online or Pass the phone, the Rules tab), with no field of its own: Hive seats two.
// The residue here (`blocks`) is the head, the table (the names strip, the SVG board, the two
// hands, Pass and Resign, the status line) and the result sheet (the end, Continue, Play again);
// the Open Graph card is assets/splash.svg rendered to web/public/games/hive/splash.png.
import type {
  ShellBlocks,
  ShellCopy,
  ShellLook,
  ShellNotes,
  ShellPage,
} from '../../shared/markup/shell.ts';

const copy: ShellCopy = {
  modeOnline: 'Online',
  modeLocal: 'Pass the phone',
  hostLabel: 'Open a table',
  joinLabel: 'Sit down at a table',
  joinBtnLabel: 'Sit down',
  localBtnLabel: 'Start',
  localNote:
    'One phone, no internet needed. Nothing is hidden: a short pause names whose turn it is as the phone changes hands.',
  hostWaitTitle: 'Your table',
  hostWaitSubtitle: 'Have your opponent open this same page and enter the code',
  openingMsg: 'Opening the table…',
  keepOpenNote:
    'Keep this screen open while your opponent sits down. If you switch apps, come straight back and the table reconnects on its own.',
  startLabel: 'Start',
  curtainSub: '',
  revealLabel: 'Show the board',
  rulesTitle: 'Rules',
  historyTitle: 'History',
};

const notes: ShellNotes = {
  homeNote: ` (docs/design/hive.md §7): Online (the default) or Pass the phone, two players.`,
  rulesTabNote: ': ui/rules.ts fills both slots at boot (render.ts renderRules).',
  glossaryDoc: 'glossary-links.md',
  aboutClose: '',
  curtainNote:
    ': composed by the shell, never raised: Hive hides nothing, so both players share the one screen (ui/state.ts `viewer`; the owner, 2026-10-02: "you don\'t need to pass the phone for turns").',
};

const look: ShellLook = {
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

const blocks: ShellBlocks = {
  head: `<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="Hive" />
    <meta
      property="og:description"
      content="Hive for two: place and move the eleven bugs, surround the Queen. Pass one phone, or open a table online."
    />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://games.sweedler.com/hive/" />
    <meta property="og:image" content="https://games.sweedler.com/hive/splash.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Hive: a cluster of black and white hexagonal tiles" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Hive" />
    <meta
      name="twitter:description"
      content="Hive for two: place and move the eleven bugs, surround the Queen. Pass one phone, or open a table online."
    />
    <meta name="twitter:image" content="https://games.sweedler.com/hive/splash.png" />
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Hive</title>
    <meta
      name="description"
      content="Hive for two: place and move the eleven bugs around one growing hive; surround the other Queen to win."
    />
    <link rel="icon" href="../../shared/favicon.svg" type="image/svg+xml" />
    <link rel="alternate icon" href="../../shared/favicon.ico" />
    <link rel="stylesheet" href="../../shared/styles/tokens.css" />
    <link rel="stylesheet" href="../../shared/styles/base.css" />
    <link rel="stylesheet" href="../../shared/styles/shell.css" />
    <link rel="stylesheet" href="./theme.css" />
  </head>`,
  masthead: `        <div class="masthead">
          <h1>Hive</h1>
          <div class="subtitle">Place and move the bugs; surround the Queen</div>
        </div>`,
  submenuExtra: '',
  extraTabs: '',
  switchExtra: '',
  hostFields: `              <button class="btn btn-go btn-block" id="hostBtn">Open a table</button>`,
  localFields: `            <div class="card-box">
              <div class="row">
                <input type="text" id="p1NameInput" class="grow" placeholder="White" maxlength="20" autocomplete="off" />
                <input type="text" id="p2NameInput" class="grow" placeholder="Black" maxlength="20" autocomplete="off" />
              </div>
            </div>`,
  playExtra: `          <!-- The tiles' motion (the owner: "have them move in little jumps (with an optional button to
               have them snap to the end result. Make this a config option)"): the device's remembered
               setting (web/shared/edge/settings.ts HIVE_MOTION), the same choice as the table's #motionBtn,
               here for the phone whose topbar has no room for it (theme.css hides the button under 430px). -->
          <label class="toggle-row" id="motionRow">
            <input type="checkbox" id="motionToggle" checked />
            <span>Tiles crawl along their path<br /><small class="muted">Off: they snap to where they land.</small></span>
          </label>`,
  extraPanels: '',
  extraScreens: '',
  hostWaitList: '',
  guestWaitList: '',
  guestSeatName: `      <div id="guestSeatName" class="hidden">
        <label for="guestNameInput">Playing as</label>
        <div class="row">
          <input type="text" id="guestNameInput" class="grow" maxlength="20" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" />
          <button class="btn btn-secondary btn-sm" id="guestRenameBtn">Change</button>
        </div>
        <div class="muted" id="guestNameNote"></div>
      </div>`,
  table: `      <!-- TABLE (docs/design/hive.md §7): the names strip (me and my side, the other seat and
           its connection), Black's hand above the board and White's below, the SVG hive between
           them (render.ts boardHtml: a g.hex per cell), Pass and Resign, the status line; in the
           topbar, the tiles' motion (🐌 crawl / ⚡ snap: render.ts paintMotion, the device's remembered
           setting) beside the sound. -->
      <div id="tableScreen" class="hidden">
        <div class="topbar">
          <div class="row tight">
            <button class="icon-btn" id="leaveBtn" title="Leave the table" aria-label="Leave the table">✕</button>
            <button class="icon-btn hidden" id="handoffBtn" title="Continue online" aria-label="Continue online">🌐</button>
          </div>
          <div class="names-strip">
            <span id="myName">You</span>
            <span class="vs">vs</span>
            <span id="oppName">Opponent</span>
            <span class="conn-dot" id="oppDot"></span>
          </div>
          <div class="row tight">
            <button class="icon-btn" id="rulesBtnGame" title="Rules" aria-label="Rules">📖</button>
            <button class="icon-btn" id="historyBtn" title="History" aria-label="History">📜</button>
            <button class="icon-btn" id="soundBtn" title="Sound &amp; vibration" aria-label="Sound" aria-pressed="true">🔊</button>
            <button class="icon-btn" id="motionBtn" title="Tiles crawl" aria-label="Tiles crawl" aria-pressed="true">🐌</button>
          </div>
        </div>
        <div class="hand" id="blackHand" aria-label="Black’s tiles in hand"></div>
        <div class="board" id="board" aria-label="The board"></div>
        <div class="hand" id="whiteHand" aria-label="White’s tiles in hand"></div>
        <p class="status-line" id="statusText" aria-live="polite"></p>
        <div class="controls">
          <button class="btn btn-secondary grow hidden" id="passBtn">Pass</button>
          <button class="btn btn-ghost grow hidden" id="resignBtn">Resign</button>
          <button class="btn btn-go grow hidden" id="againBtn">Play again</button>
        </div>
      </div>`,
  endgame: `      <!-- ENDGAME: the shell's fifth screen, which this page never shows: the game ends on the
           result sheet over the board. -->
      <div id="endgameScreen" class="hidden">
        <h1>Game over</h1>
      </div>`,
  curtainIcon: '',
  curtainExtra: '',
  sheetsBefore: `
    <!-- RESULT (the owner: "understand what happened before proceeding"): the end over the final
         board; Continue leaves the board on show, Play again starts anew. -->
    <div id="resultOverlay" class="overlay hidden">
      <div class="sheet centered">
        <div class="sheet-title" id="rsTitle">Game over</div>
        <p class="result-note" id="rsNote"></p>
        <button class="btn btn-secondary btn-block" id="rsContinueBtn">Continue</button>
        <button class="btn btn-go btn-block" id="rsAgainBtn">Play again</button>
        <button class="btn btn-ghost btn-block btn-sm" id="rsLeaveBtn">Leave the table</button>
      </div>
    </div>`,
  sheetsAfter: '',
  rulesIcon: '',
};

export const HIVE_PAGE: ShellPage = { copy, notes, look, blocks };
