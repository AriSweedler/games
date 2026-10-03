// Hive's shell page (docs/design/hive.md §7; docs/design/dry-round-2.md §3 row G2): what
// tools/shell-markup.ts fills web/shared/markup/shell/*.html with to compose ./index.html, which
// test/dist/shell-markup.test.ts pins byte for byte. The home is the shell's (the host card, the
// join card, Online or Pass the phone, the Rules tab), with no field of its own: Hive seats two.
// The residue here (`blocks`) is the head, the table (the names strip, the SVG board, the two
// hands, Pass and Resign, the status line) and the result sheet (the end, Continue, Play again);
// the Open Graph card is assets/splash.svg rendered to web/public/games/hive/splash.png.
import { GUEST_SEAT_NAME, THEME_LOOK, headHtml } from '../../shared/markup/page.ts';
import {
  type ShellBlocks,
  type ShellCopy,
  type ShellNotes,
  type ShellPage,
  resultMarkup,
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

const blocks: ShellBlocks = {
  head: headHtml({
    slug: 'hive',
    name: 'Hive',
    share:
      'Hive for two: place and move the eleven bugs, surround the Queen. Pass one phone, or open a table online.',
    imageAlt: 'Hive: a cluster of black and white hexagonal tiles',
    description:
      'Hive for two: place and move the eleven bugs around one growing hive; surround the other Queen to win.',
  }),
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
          </label>
          <!-- The hints (the owner: "option to not show moves. That is, you get to click on the grid where
               you wanna put them and then confirm"): settings.ts HIVE_HINTS, the same choice as the table's
               #hintsBtn, here for the phone. -->
          <label class="toggle-row" id="hintsRow">
            <input type="checkbox" id="hintsToggle" checked />
            <span>Show where a picked tile may go<br /><small class="muted">Off: put it anywhere and Confirm; a move against the rules is refused and told why.</small></span>
          </label>`,
  extraPanels: '',
  extraScreens: '',
  hostWaitList: '',
  guestWaitList: '',
  guestSeatName: GUEST_SEAT_NAME,
  table: `      <!-- TABLE (docs/design/hive.md §7): the names strip (a hex swatch for each seat's side, its
           name, the other seat's connection; it fits 390px between six icon buttons), Black's hand above the board and White's below, the SVG hive between
           them (render.ts boardHtml: a g.hex per cell), Pass and Resign, the status line; in the
           topbar, the tiles' motion (🐌 crawl / ⚡ snap: render.ts paintMotion, the device's remembered
           setting) and the hints (💡: render.ts paintHints) beside the sound. -->
      <div id="tableScreen" class="hidden">
        <div class="topbar">
          <div class="row tight">
            <button class="icon-btn" id="leaveBtn" title="Leave the table" aria-label="Leave the table">✕</button>
            <button class="icon-btn hidden" id="handoffBtn" title="Continue online" aria-label="Continue online">🌐</button>
          </div>
          <div class="names-strip">
            <svg class="side-swatch" id="mySide" viewBox="0 0 20 22" role="img" aria-label="White" data-side="w"><polygon points="10,1 18.5,5.75 18.5,16.25 10,21 1.5,16.25 1.5,5.75" /></svg>
            <span id="myName">You</span>
            <span class="vs" aria-hidden="true"></span>
            <svg class="side-swatch" id="oppSide" viewBox="0 0 20 22" role="img" aria-label="Black" data-side="b"><polygon points="10,1 18.5,5.75 18.5,16.25 10,21 1.5,16.25 1.5,5.75" /></svg>
            <span id="oppName">Opponent</span>
            <span class="conn-dot" id="oppDot"></span>
          </div>
          <div class="row tight">
            <button class="icon-btn" id="rulesBtnGame" title="Rules" aria-label="Rules">📖</button>
            <button class="icon-btn" id="historyBtn" title="History" aria-label="History">📜</button>
            <button class="icon-btn" id="soundBtn" title="Sound &amp; vibration" aria-label="Sound" aria-pressed="true">🔊</button>
            <button class="icon-btn" id="motionBtn" title="Tiles crawl" aria-label="Tiles crawl" aria-pressed="true">🐌</button>
            <button class="icon-btn" id="hintsBtn" title="Show moves" aria-label="Show moves" aria-pressed="true">💡</button>
          </div>
        </div>
        <div class="hand" id="blackHand" aria-label="Black’s tiles in hand"></div>
        <div class="board" id="board" aria-label="The board"></div>
        <!-- The proposal (the hints hidden; the owner: "click on the grid where you wanna put them and then
             confirm"): Confirm plays the tile where it was put, or the red toast says why not; Cancel puts it back. -->
        <div class="proposal-bar hidden" id="proposalBar">
          <button class="btn btn-go grow" id="confirmBtn">Confirm</button>
          <button class="btn btn-ghost grow" id="cancelBtn">Cancel</button>
        </div>
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
  result: resultMarkup({
    note: 'the end over the final board (the owner: "understand what happened before proceeding"); Continue leaves the board on show, Play again starts anew.',
    score: 'note',
    continueBtn: true,
    primary: { id: 'rsAgainBtn', label: 'Play again' },
    secondary: { id: 'rsLeaveBtn', label: 'Leave the table' },
  }),
  sheetsBefore: '',
  sheetsAfter: '',
  rulesIcon: '',
};

export const HIVE_PAGE: ShellPage = { copy, notes, look: THEME_LOOK, blocks };
