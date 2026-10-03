// Flip 7's shell page (docs/design/flip7.md §8): what tools/shell-markup.ts fills
// web/shared/markup/shell/*.html with to compose ./index.html, which test/dist/shell-markup.test.ts
// pins byte for byte. The residue here is the head, the two Players steppers (two to twelve) over
// the shared name grid (web/shared/markup/seatNames.ts, one input per seat), the table (the topbar,
// the names strip, the round, every seat's line, Hit and Stay, the taker picker, the round's
// scores) and the endgame screen the shell requires.
import { THEME_LOOK, headHtml } from '../../shared/markup/page.ts';
import {
  type ShellBlocks,
  type ShellCopy,
  type ShellNotes,
  type ShellPage,
  endgamePlaceholder,
} from '../../shared/markup/shell.ts';
import { seatNamesHtml } from '../../shared/markup/seatNames.ts';
import { seatedHostFields, stepperHtml } from '../../shared/markup/stepper.ts';
import { topbarHtml } from '../../shared/markup/topbar.ts';

/** Both steppers' bounds and first value: two to twelve players (the owner, 2026-10-02). */
const PLAYERS = { label: 'Players', min: 2, max: 12, value: 2, noun: 'players' } as const;

const copy: ShellCopy = {
  localNote: 'One phone, no internet needed. Every card is face up: pass it round the table.',
  startLabel: 'Deal',
  revealLabel: 'Start',
  historyTitle: 'Recent games',
};

const notes: ShellNotes = {
  homeNote:
    ' (docs/design/flip7.md §8): Online (the default) or Pass the phone, two to twelve players.',
  rulesTabNote: ': ui/rules.ts fills both slots at boot (render.ts renderRules).',
  glossaryDoc: 'glossary-links.md',
  aboutClose: '',
  curtainNote: ': the first player takes the phone; every card is face up after it.',
};

const blocks: ShellBlocks = {
  head: headHtml({
    slug: 'flip7',
    name: 'Flip 7',
    share:
      'Flip 7, the press-your-luck card game for two to twelve: pass one phone, or open a table online and send the link.',
    imageAlt: 'Flip 7: a line of number tiles, one of them a seven',
  }),
  masthead: `        <div class="masthead">
          <h1>Flip 7</h1>
          <div class="subtitle">Press your luck, two to twelve players</div>
        </div>`,
  // The seat count is the shared stepper (web/shared/markup/stepper.ts; the owner, 2026-10-02: "not
  // a dropdown but a number with - and + buttons on the side"), two to twelve, on both cards.
  hostFields: seatedHostFields(PLAYERS),
  localFields: `            <div class="card-box">
${stepperHtml({ id: 'localPlayersCount', ...PLAYERS }, '              ')}
${seatNamesHtml({ max: PLAYERS.max, indent: '              ' })}
            </div>`,
  table: `      <!-- TABLE (docs/design/flip7.md §8): every seat's line, face up, in seat order; mine is
           marked data-you. Hit and Stay show for the seat whose turn it is, the taker picker for the
           seat that flipped an action card, the scores when a round ends. -->
      <div id="tableScreen" class="hidden">
${topbarHtml({ dot: 'between', titles: { leave: 'Leave', history: 'Recent games' }, indent: '        ' })}

        <div class="round-row">
          <span id="roundLabel">Round 1</span>
          <span id="drawCount">Deck · 94</span>
        </div>
        <!-- The seats: every other seat a small row in the background (a grid of up to four across,
             its cards shrinking with the count: data-count), this phone's own in the foreground below,
             its cards large. Each card carries data-card, its id, so a flip can find it. -->
        <div class="seats" id="seats">
          <ul class="others" id="others" data-count="1"></ul>
          <div class="status-line" id="statusLine" aria-live="polite"><span id="statusText">—</span></div>
          <div class="seat me" id="mySeat"></div>
        </div>

        <div class="target hidden" id="target">
          <h2 id="targetTitle">Give it to…</h2>
          <div class="choices" id="targetSeats"></div>
        </div>
        <div class="controls">
          <button class="btn btn-primary hidden" id="hitBtn">Hit</button>
          <button class="btn btn-secondary hidden" id="stayBtn">Stay</button>
        </div>
        <div class="result hidden" id="result">
          <h2 id="resultTitle">Round over</h2>
          <ul class="scores" id="scores"></ul>
          <button class="btn btn-go btn-block hidden" id="nextRoundBtn">Next round</button>
          <button class="btn btn-go btn-block hidden" id="replayBtn">Play again</button>
        </div>
      </div>`,
  endgame: endgamePlaceholder('the game ends on the result panel over the table, with Play again.'),
  sheetsBefore: `
    <!-- PAUSE (the owner, 2026-10-02: "When you the player bust, you need to confirm before
         proceeding"): what just happened to a seat (a bust with the card and the points lost, a
         freeze, a Flip 7), held until Continue; nothing moves on this phone while it is up. -->
    <div id="pauseOverlay" class="overlay hidden">
      <div class="sheet centered pause-sheet">
        <div class="sheet-title" id="pauseTitle">Bust</div>
        <div class="sheet-sub" id="pauseDetail"></div>
        <button class="btn btn-go btn-block" id="continueBtn">Continue</button>
      </div>
    </div>`,
};

export const FLIP7_PAGE: ShellPage = { copy, notes, look: THEME_LOOK, blocks, seated: true };
