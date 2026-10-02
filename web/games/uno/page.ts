// UNO's shell page (docs/design/uno.md §9; docs/design/dry-round-2.md §3 row G2): what
// tools/shell-markup.ts fills web/shared/markup/shell/*.html with to compose ./index.html, which
// test/dist/shell-markup.test.ts pins byte for byte. The home is the shell's (the host card, the
// join card, Online or Pass the phone, the Rules tab), the player count in each panel the shared
// stepper (web/shared/markup/stepper.ts; the owner, 2026-10-02), the looks the shell's classes with
// UNO's accent alone (theme.css). The residue here (`blocks`) is the head, the table (the seats with
// their card counts, the names strip, the pile, the colour in play, the hand, the controls) and the
// result sheet (the winner, Play again); the Open Graph card is assets/splash.svg rendered to web/public/games/uno/splash.png.
import type {
  ShellBlocks,
  ShellCopy,
  ShellLook,
  ShellNotes,
  ShellPage,
} from '../../shared/markup/shell.ts';
import { stepperHtml } from '../../shared/markup/stepper.ts';

const copy: ShellCopy = {
  modeOnline: 'Online',
  modeLocal: 'Pass the phone',
  hostLabel: 'Open a table',
  joinLabel: 'Sit down at a table',
  joinBtnLabel: 'Sit down',
  localBtnLabel: 'Start',
  localNote:
    'One phone, no internet needed. A curtain names whose turn it is; everyone else looks away.',
  hostWaitTitle: 'Your table',
  hostWaitSubtitle: 'Have the others open this same page and enter the code',
  openingMsg: 'Opening the table…',
  keepOpenNote:
    'Keep this screen open while the others sit down. If you switch apps, come straight back and the table reconnects on its own.',
  startLabel: 'Deal',
  curtainSub: '',
  revealLabel: 'Show my hand',
  rulesTitle: 'Rules',
  historyTitle: 'History',
};

const notes: ShellNotes = {
  homeNote: ` (docs/design/uno.md §9): Online (the default) or Pass the phone for 2 to 12 players.`,
  rulesTabNote: ': ui/rules.ts fills both slots at boot (render.ts renderRules).',
  glossaryDoc: 'glossary-links.md',
  aboutClose: '',
  curtainNote: ': the table hidden while the phone changes hands.',
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

const PLAYERS = { label: 'Players', min: 2, max: 12, value: 2, noun: 'players' } as const;

const blocks: ShellBlocks = {
  head: `<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="UNO" />
    <meta
      property="og:description"
      content="UNO for two to twelve: pass one phone, or open a table online and send the link."
    />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://games.sweedler.com/uno/" />
    <meta property="og:image" content="https://games.sweedler.com/uno/splash.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="UNO: four coloured cards fanned on a dark table" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="UNO" />
    <meta
      name="twitter:description"
      content="UNO for two to twelve: pass one phone, or open a table online and send the link."
    />
    <meta name="twitter:image" content="https://games.sweedler.com/uno/splash.png" />
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>UNO</title>
    <meta
      name="description"
      content="UNO for two to twelve: match the colour or the number; the first to empty a hand wins."
    />
    <link rel="icon" href="../../shared/favicon.svg" type="image/svg+xml" />
    <link rel="alternate icon" href="../../shared/favicon.ico" />
    <link rel="stylesheet" href="../../shared/styles/tokens.css" />
    <link rel="stylesheet" href="../../shared/styles/base.css" />
    <link rel="stylesheet" href="../../shared/styles/shell.css" />
    <link rel="stylesheet" href="./theme.css" />
  </head>`,
  masthead: `        <div class="masthead">
          <h1>UNO</h1>
          <div class="subtitle">Match the colour or the number, for two to twelve</div>
        </div>`,
  submenuExtra: '',
  extraTabs: '',
  switchExtra: '',
  hostFields: `${stepperHtml({ id: 'playersCount', ...PLAYERS }, '              ')}
              <button class="btn btn-go btn-block" id="hostBtn">Open a table</button>`,
  localFields: `            <div class="card-box">
${stepperHtml({ id: 'localPlayersCount', ...PLAYERS }, '              ')}
              <div class="row">
                <input type="text" id="p1NameInput" class="grow" placeholder="Player 1" maxlength="20" autocomplete="off" />
                <input type="text" id="p2NameInput" class="grow" placeholder="Player 2" maxlength="20" autocomplete="off" />
              </div>
              <div class="row hidden" id="moreNames">
                <input type="text" id="p3NameInput" class="grow" placeholder="Player 3" maxlength="20" autocomplete="off" />
                <input type="text" id="p4NameInput" class="grow" placeholder="Player 4" maxlength="20" autocomplete="off" />
              </div>
            </div>`,
  playExtra: '',
  extraPanels: '',
  extraScreens: '',
  hostWaitList: `      <ul class="seat-list" id="seatList" aria-label="Seats"></ul>`,
  guestWaitList: `      <ul class="seat-list" id="guestSeatList" aria-label="Seats"></ul>`,
  guestSeatName: `      <div id="guestSeatName" class="hidden">
        <label for="guestNameInput">Playing as</label>
        <div class="row">
          <input type="text" id="guestNameInput" class="grow" maxlength="20" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" />
          <button class="btn btn-secondary btn-sm" id="guestRenameBtn">Change</button>
        </div>
        <div class="muted" id="guestNameNote"></div>
      </div>`,
  table: `      <!-- TABLE (docs/design/uno.md §9): every seat with its card count (the turn lit), the names
           strip (me, the seat after me and its connection), the pile with the colour in play, my
           hand, Draw and Pass, UNO and Call out UNO (§7, shown to the seats they apply to), the
           colour picker for my wild, the status line. -->
      <div id="tableScreen" class="hidden">
        <div class="topbar">
          <div class="row tight">
            <button class="icon-btn" id="leaveBtn" title="Leave the table" aria-label="Leave the table">✕</button>
            <button class="icon-btn hidden" id="handoffBtn" title="Continue online" aria-label="Continue online">🌐</button>
          </div>
          <div class="names-strip">
            <span id="myName">You</span>
            <span class="direction" id="direction" aria-label="Direction of play">↻</span>
            <span id="oppName">Opponent</span>
            <span class="conn-dot" id="oppDot"></span>
          </div>
          <div class="row tight">
            <button class="icon-btn" id="rulesBtnGame" title="Rules" aria-label="Rules">📖</button>
            <button class="icon-btn" id="historyBtn" title="History" aria-label="History">📜</button>
            <button class="icon-btn" id="soundBtn" title="Sound &amp; vibration" aria-label="Sound" aria-pressed="true">🔊</button>
          </div>
        </div>
        <ul class="seats" id="seats" aria-label="Cards in each hand"></ul>
        <div class="pile">
          <div class="draw-pile" aria-label="Draw pile"><span id="drawCount">0</span></div>
          <div class="top-card" id="topCard" aria-label="Top of the pile"></div>
          <span class="color-dot" id="colorDot" data-color="red">Red</span>
        </div>
        <div class="color-picker hidden" id="colorPicker" aria-label="Name a colour">
          <button class="swatch" type="button" data-color="red" aria-label="Red"></button>
          <button class="swatch" type="button" data-color="yellow" aria-label="Yellow"></button>
          <button class="swatch" type="button" data-color="green" aria-label="Green"></button>
          <button class="swatch" type="button" data-color="blue" aria-label="Blue"></button>
        </div>
        <p class="status-line" id="statusText" aria-live="polite"></p>
        <div class="hand" id="hand" aria-label="Your hand"></div>
        <div class="controls">
          <button class="btn btn-secondary grow" id="drawBtn">Draw</button>
          <button class="btn btn-secondary grow hidden" id="passBtn">Keep it, pass</button>
          <button class="btn btn-primary grow hidden" id="unoBtn">UNO!</button>
          <button class="btn btn-secondary grow hidden" id="callOutBtn">Call out UNO</button>
        </div>
      </div>`,
  endgame: `      <!-- ENDGAME: the shell's fifth screen, which this page never shows: a round and the game end
           on the result sheet over the table. -->
      <div id="endgameScreen" class="hidden">
        <h1>Game over</h1>
      </div>`,
  curtainIcon: '',
  curtainExtra: '',
  sheetsBefore: `
    <!-- RESULT: one round is the game (the owner, 2026-10-02): the winner over the table, the cards
         every other seat still held; Play again deals the same seats anew. -->
    <div id="resultOverlay" class="overlay hidden">
      <div class="sheet centered">
        <div class="sheet-title" id="rsTitle">Game over</div>
        <ul class="score-list" id="rsScore"></ul>
        <button class="btn btn-go btn-block" id="rsAgainBtn">Play again</button>
        <button class="btn btn-ghost btn-block btn-sm" id="rsLeaveBtn">Leave the table</button>
      </div>
    </div>`,
  sheetsAfter: '',
  rulesIcon: '',
};

export const UNO_PAGE: ShellPage = { copy, notes, look, blocks };
