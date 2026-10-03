// UNO's shell page (docs/design/uno.md §9; docs/design/dry-round-2.md §3 row G2): what
// tools/shell-markup.ts fills web/shared/markup/shell/*.html with to compose ./index.html, which
// test/dist/shell-markup.test.ts pins byte for byte. The home is the shell's (the host card, the
// join card, Online or Pass the phone, the Rules tab), the player count in each panel the shared
// stepper (web/shared/markup/stepper.ts; the owner, 2026-10-02) over one name input per seat
// (web/shared/markup/seatNames.ts), the looks the shell's classes with
// UNO's accent alone (theme.css). The residue here (`blocks`) is the head, the table (the seats with
// their card counts, the names strip, the pile, the colour in play, the hand, the controls) and the
// result sheet (the winner, Play again); the Open Graph card is assets/splash.svg rendered to web/public/games/uno/splash.png.
import { THEME_LOOK, headHtml } from '../../shared/markup/page.ts';
import {
  type ShellBlocks,
  type ShellCopy,
  type ShellNotes,
  type ShellPage,
  endgamePlaceholder,
  resultMarkup,
} from '../../shared/markup/shell.ts';
import { seatNamesHtml } from '../../shared/markup/seatNames.ts';
import { seatedHostFields, stepperHtml } from '../../shared/markup/stepper.ts';
import { topbarHtml } from '../../shared/markup/topbar.ts';

const copy: ShellCopy = {
  localNote:
    'One phone, no internet needed. A curtain names whose turn it is; everyone else looks away.',
  startLabel: 'Deal',
  revealLabel: 'Show my hand',
  historyTitle: 'History',
};

const notes: ShellNotes = {
  homeNote: ` (docs/design/uno.md §9): Online (the default) or Pass the phone for 2 to 12 players.`,
  rulesTabNote: ': ui/rules.ts fills both slots at boot (render.ts renderRules).',
  glossaryDoc: 'glossary-links.md',
  aboutClose: '',
  curtainNote: ': the table hidden while the phone changes hands.',
};

const PLAYERS = { label: 'Players', min: 2, max: 12, value: 2, noun: 'players' } as const;

const blocks: ShellBlocks = {
  head: headHtml({
    slug: 'uno',
    name: 'UNO',
    share: 'UNO for two to twelve: pass one phone, or open a table online and send the link.',
    imageAlt: 'UNO: four coloured cards fanned on a dark table',
    description:
      'UNO for two to twelve: match the colour or the number; the first to empty a hand wins.',
  }),
  masthead: `        <div class="masthead">
          <h1>UNO</h1>
          <div class="subtitle">Match the colour or the number, for two to twelve</div>
        </div>`,
  hostFields: seatedHostFields(PLAYERS),
  localFields: `            <div class="card-box">
${stepperHtml({ id: 'localPlayersCount', ...PLAYERS }, '              ')}
${seatNamesHtml({ max: PLAYERS.max, indent: '              ' })}
            </div>`,
  table: `      <!-- TABLE (docs/design/uno.md §9): every seat with its card count (the turn lit), the names
           strip (me, the seat after me and its connection), the pile with the colour in play, my
           hand, Draw and Pass, UNO and Call out UNO (§7, shown to the seats they apply to), the
           colour picker for my wild, the status line. -->
      <div id="tableScreen" class="hidden">
${topbarHtml({
  dot: 'last',
  between: '<span class="direction" id="direction" aria-label="Direction of play">↻</span>',
  indent: '        ',
})}
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
  endgame: endgamePlaceholder('a round and the game end on the result sheet over the table.'),
  result: resultMarkup({
    note: 'one round is the game (the owner, 2026-10-02): the winner over the table, the cards every other seat still held; Play again deals the same seats anew.',
    score: 'list',
    primary: { id: 'rsAgainBtn', label: 'Play again' },
    secondary: { id: 'rsLeaveBtn', label: 'Leave the table' },
  }),
};

export const UNO_PAGE: ShellPage = { copy, notes, look: THEME_LOOK, blocks, seated: true };
