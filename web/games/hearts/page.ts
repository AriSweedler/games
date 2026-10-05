// Hearts's shell page (docs/design/hearts.md §3; docs/design/dry-round-2.md §3 row G2): what
// tools/shell-markup.ts fills web/shared/markup/shell/*.html with to compose ./index.html, which
// test/dist/shell-markup.test.ts pins byte for byte. The home is the shell's (the host card, the
// join card, Online or Pass the phone, the Rules tab), with no field of its own: two seats. The
// residue here (`blocks`) is the head, the table (the names strip, the board slot, the controls,
// the status line) and the result sheet; the Open Graph card is assets/splash.svg rendered to
// web/public/games/hearts/splash.png.
import { GUEST_SEAT_NAME, THEME_LOOK, headHtml } from '../../shared/markup/page.ts';
import {
  type ShellBlocks,
  type ShellCopy,
  type ShellNotes,
  resultMarkup,
  type ShellPage,
} from '../../shared/markup/shell.ts';
import { topbarHtml } from '../../shared/markup/topbar.ts';

// The shell's words (web/shared/markup/shell.ts SHELL_COPY) but for a table of two, and the four
// only this game knows.
const copy: ShellCopy = {
  localNote: 'One phone, no internet needed. A curtain hides the table as the phone changes hands.',
  hostWaitSubtitle: 'Have your opponent open this same page and enter the code',
  keepOpenNote:
    'Keep this screen open while your opponent sits down. If you switch apps, come straight back and the table reconnects on its own.',
  startLabel: 'Start',
  revealLabel: 'Show the table',
  historyTitle: 'History',
};

const notes: ShellNotes = {
  homeNote: ` (docs/design/hearts.md §3): Online (the default) or Pass the phone, two players.`,
  rulesTabNote: ': ui/rules.ts fills both slots at boot (shellPaint.ts renderCopy).',
  glossaryDoc: 'glossary-links.md',
  aboutClose: '',
  curtainNote:
    ': raised on every change of turn (ui/state.ts `viewer`): a seat holds something the other must not see.',
};

const blocks: ShellBlocks = {
  head: headHtml({
    slug: 'hearts',
    name: 'Hearts',
    share: 'Hearts for two. Pass one phone, or open a table online.',
    imageAlt: 'Hearts',
    description: 'Hearts for two: pass one phone, or open a table online.',
  }),
  masthead: `        <div class="masthead">
          <h1>Hearts</h1>
          <div class="subtitle">TODO: one line on what the game is</div>
        </div>`,
  hostFields: `              <button class="btn btn-go btn-block" id="hostBtn">Open a table</button>`,
  localFields: `            <div class="card-box">
              <div class="row">
                <input type="text" id="p1NameInput" class="grow" placeholder="Player 1" maxlength="20" autocomplete="off" />
                <input type="text" id="p2NameInput" class="grow" placeholder="Player 2" maxlength="20" autocomplete="off" />
              </div>
            </div>`,
  guestSeatName: GUEST_SEAT_NAME,
  table: `      <!-- TABLE (docs/design/hearts.md §3): the names strip (me, the other seat and its connection),
           the board slot (TODO: the game's own markup, painted by render.ts), the status line and
           the controls. -->
      <div id="tableScreen" class="hidden">
${topbarHtml({ dot: 'last', between: '<span class="vs">vs</span>', indent: '        ' })}
        <div class="board" id="board" aria-label="The table"></div>
        <p class="status-line" id="statusText" aria-live="polite"></p>
        <div class="controls">
          <button class="btn btn-secondary grow hidden" id="passBtn">Pass</button>
          <button class="btn btn-ghost grow hidden" id="resignBtn">Resign</button>
          <button class="btn btn-go grow hidden" id="againBtn">Play again</button>
        </div>
      </div>`,
  // No endgame block: the shell's placeholder says the game ends on the result sheet over the table.
  result: resultMarkup({
    note: 'the end over the final table, after its pause (the owner: "understand what happened before proceeding"); Play again starts anew.',
    score: 'note',
    primary: { id: 'rsAgainBtn', label: 'Play again' },
    secondary: { id: 'rsLeaveBtn', label: 'Leave the table' },
  }),
};

/** The pause (`pause: true`, the shell's partial): the end held until Continue (ui/state.ts `pauseFor`). */
export const HEARTS_PAGE: ShellPage = { copy, notes, look: THEME_LOOK, blocks, pause: true };
// The title the shell heading, the share sheet and the registry spell: 'Hearts'.
