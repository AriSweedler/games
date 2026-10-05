// Hearts's shell page (docs/design/hearts.md §3; docs/design/dry-round-2.md §3 row G2): what
// tools/shell-markup.ts fills web/shared/markup/shell/*.html with to compose ./index.html, which
// test/dist/shell-markup.test.ts pins byte for byte. The home is the shell's (the host card, the
// join card, Online or Pass the phone, the Rules tab) with the two Players steppers (three or four,
// Flip 7's shape) over the shared name grid. The residue here (`blocks`) is the head, the table
// (the names strip, the hand row, the other seats' chips, the trick, my seat and hand, Pass, the
// status line) and the result sheet; the Open Graph card is assets/splash.svg rendered to
// web/public/games/hearts/splash.png.
import { THEME_LOOK, headHtml } from '../../shared/markup/page.ts';
import {
  type ShellBlocks,
  type ShellCopy,
  type ShellNotes,
  resultMarkup,
  type ShellPage,
} from '../../shared/markup/shell.ts';
import { seatNamesHtml } from '../../shared/markup/seatNames.ts';
import { seatedHostFields, stepperHtml } from '../../shared/markup/stepper.ts';
import { topbarHtml } from '../../shared/markup/topbar.ts';

/** Both steppers' bounds and first value: three or four players (docs/design/hearts.md §1). */
const PLAYERS = { label: 'Players', min: 3, max: 4, value: 3, noun: 'players' } as const;

// The shell's words (web/shared/markup/shell.ts SHELL_COPY), and the ones only this game knows.
const copy: ShellCopy = {
  localNote: 'One phone, no internet needed. A curtain hides each hand as the phone changes hands.',
  startLabel: 'Deal',
  revealLabel: 'Show my cards',
  historyTitle: 'History',
};

const notes: ShellNotes = {
  homeNote: ` (docs/design/hearts.md §3): Online (the default) or Pass the phone, three or four players.`,
  rulesTabNote: ': ui/rules.ts fills both slots at boot (shellPaint.ts renderCopy).',
  glossaryDoc: 'glossary-links.md',
  aboutClose: '',
  curtainNote:
    ': raised on every change of actor, in the pass too (ui/state.ts `viewer`): a seat holds a hand the others must not see.',
};

const blocks: ShellBlocks = {
  head: headHtml({
    slug: 'hearts',
    name: 'Hearts',
    share: 'Hearts for three or four. Pass one phone, or open a table online and send the link.',
    imageAlt: 'Hearts',
    description: 'Hearts for three or four: pass one phone, or open a table online.',
  }),
  masthead: `        <div class="masthead">
          <h1>Hearts</h1>
          <div class="subtitle">Avoid the hearts and the queen, three or four players</div>
        </div>`,
  // The seat count is the shared stepper (web/shared/markup/stepper.ts), three or four, on both cards; the names past the shell's two are the shared grid.
  hostFields: seatedHostFields(PLAYERS),
  localFields: `            <div class="card-box">
${stepperHtml({ id: 'localPlayersCount', ...PLAYERS }, '              ')}
${seatNamesHtml({ max: PLAYERS.max, indent: '              ' })}
            </div>`,
  table: `      <!-- TABLE (docs/design/hearts.md §3, §8): the names strip, the hand row (the hand's number and
           its pass, hearts broken), the other seats' chips in the background (name, cards left, score,
           the seat to play lit), the trick in the middle (the leader marked), this phone's seat and
           hand in the foreground, Pass while the three are chosen, the status line. render.ts paints it. -->
      <div id="tableScreen" class="hidden">
${topbarHtml({ dot: 'last', between: '<span class="vs">·</span>', indent: '        ' })}
        <div class="hand-row">
          <span id="roundLabel">Hand 1</span>
          <span class="flag hidden" id="heartsFlag">♥ broken</span>
        </div>
        <div class="board" id="board" aria-label="The table">
          <ul class="others" id="others" data-count="2"></ul>
          <div class="trick" id="trick" data-count="0" aria-live="off"></div>
          <p class="status-line" id="statusText" aria-live="polite"></p>
          <div class="seat me" id="mySeat">
            <div class="seat-head">
              <span class="seat-name" id="mySeatName">You</span>
              <span class="seat-score" id="myScore" title="Score">0</span>
            </div>
            <div class="hand" id="hand" data-tap=""></div>
          </div>
        </div>
        <div class="controls">
          <button class="btn btn-primary grow hidden" id="passBtn" disabled>Pass 3 cards</button>
        </div>
      </div>`,
  // No endgame block: the shell's placeholder says the game ends on the result sheet over the table.
  result: resultMarkup({
    note: "a hand ends on the scores after its pause (the owner: understand what happened before proceeding); Next hand is the host's deal, Play again the game's once a seat has reached 100.",
    score: 'list',
    primary: { id: 'rsNextBtn', label: 'Next hand' },
    secondary: { id: 'rsLeaveBtn', label: 'Leave the table' },
  }),
};

/** The pause (`pause: true`, the shell's partial): a pointed trick, a hand's end and the game's end held until Continue (ui/state.ts `pauseFor`); `seated`: the steppers and the name grid. */
export const HEARTS_PAGE: ShellPage = {
  copy,
  notes,
  look: THEME_LOOK,
  blocks,
  seated: true,
  pause: true,
};
// The title the shell heading, the share sheet and the registry spell: 'Hearts'.
