// The Rules tab and the in-game rules sheet (docs/design/hive.md §5; the owner, 2026-10-02: "the
// ruleset to teach players should be as short as possible, ideally fitting on 1 screen"), in two
// groups (the owner, the same day: the bugs "should have the SVG and a nice panel. Instead of them
// all blending in together", and the bugs' moves and the other rules "in separate columns"): the
// five bugs, each a panel with its engraved tile at the left and its move in one line, then the
// goal, placing and the two rules of the hive, one line each; the long form is docs/design/hive.md
// §4. The shell lays the groups out (shell.css: stacked on a phone, side by side where wide). The
// About copy names the page, its first "hive" the lower-case word (the shell's glossary spec taps
// the game's own name in lower case, as briscola's About does: `linkJargon` links a term's first
// occurrence in any case, so a leading "Hive" would take the link and leave the word plain). Both
// are static, filled once at boot (render.ts `renderRules`).
import {
  linkJargon,
  rulesListHtml,
  type Glossary,
  type RuleGroup,
  type RuleItem,
} from '../../../../shared/ui/glossary.ts';
import type { Bug } from '../engine/pieces.ts';
import { HEX_H, HEX_W, cornersOf, type Point } from './board.ts';
import { bugHtml } from './bugs.ts';

/**
 * The words linked to their rule (docs/design/glossary-links.md): "Queen" in the goal and the
 * placing rule opens the Queen rule, "hive" in the About copy and the bugs' rules the One Hive rule,
 * "slide" the sliding rule.
 */
export const GLOSSARY: Glossary = [
  { rule: 'queen', terms: ['Queen'] },
  { rule: 'hive', terms: ['hive'] },
  { rule: 'slide', terms: ['slide', 'slides'] },
];

const ORIGIN: Point = { x: 0, y: 0 };
/** One hex about the origin, the tray tile's own (render.ts `TILE_VIEWBOX`; not imported: render.ts imports this module). */
const ART_VIEWBOX = [-HEX_W / 2, -HEX_H / 2, HEX_W, HEX_H].map((n) => n.toFixed(2)).join(' ');

/**
 * A bug's rule art: the tray tile in White's colour (the side that opens), the board's hexagon with
 * the bug engraved at its centre (ui/bugs.ts `bugHtml`; theme.css `.rule-art`), no sheen: a small
 * tile beside one line of text wants the shape and the ink, nothing louder.
 */
export const bugArt = (bug: Bug): string =>
  `<svg class="tile w" viewBox="${ART_VIEWBOX}" aria-hidden="true"><polygon class="face" points="${cornersOf(ORIGIN)}" />${bugHtml(bug, ORIGIN)}</svg>`;

/** A bug's rule: the owner's short name (not the engine's "Queen Bee"), its tile as the art, its move as the body. */
const bugRule = (bug: Bug, heading: string, body: string): RuleItem => ({
  id: bug,
  heading,
  body,
  art: bugArt(bug),
});

export const RULE_GROUPS: ReadonlyArray<RuleGroup> = [
  {
    id: 'bugs',
    heading: 'The bugs',
    rules: [
      bugRule(
        'queen',
        'Queen',
        'Down by your fourth tile; no moves before her. She slides 1 step.',
      ),
      bugRule(
        'beetle',
        'Beetle',
        '1 step, may climb onto the hive; a covered tile is stuck and takes the Beetle’s colour.',
      ),
      bugRule(
        'grasshopper',
        'Grasshopper',
        'Jumps a straight line of tiles to the first empty hex.',
      ),
      bugRule('spider', 'Spider', 'Slides exactly 3 steps around the hive.'),
      bugRule('ant', 'Ant', 'Slides any distance around the hive.'),
    ],
  },
  {
    id: 'game',
    heading: 'The game',
    rules: [
      {
        id: 'goal',
        heading: 'Goal',
        body: 'Surround the other Queen on all six sides. Both at once: a draw.',
      },
      {
        id: 'place',
        heading: 'Place',
        body: 'A tile from your hand on an empty hex touching only your colour (the first two just touch). Or move a tile already down.',
      },
      {
        id: 'hive',
        heading: 'One hive',
        body: 'The tiles never split into two groups, not even mid-move.',
      },
      {
        id: 'slide',
        heading: 'Sliding',
        body: 'A tile slides along the hive and never squeezes through a gap between two tiles. No play at all? Pass.',
      },
    ],
  },
];

/** Every rule, in reading order, for the tests and anyone counting words. */
export const RULES_ITEMS: ReadonlyArray<RuleItem> = RULE_GROUPS.flatMap((g) => g.rules);

export const rulesItemsHtml = (): string => rulesListHtml(RULE_GROUPS, GLOSSARY);

const ABOUT_PARAGRAPHS: ReadonlyArray<string> = [
  'Eleven bugs a side on a board that grows as you play: place them around the hive and move them along it, and the first Queen surrounded on all six sides loses. That is Hive, for two.',
  'Pass one phone back and forth, or open a table online and send the link: both phones show the same board, since nothing is hidden.',
];

export const aboutHtml = (): string =>
  linkJargon(ABOUT_PARAGRAPHS.map((p) => `<p>${p}</p>`).join('\n'), GLOSSARY);
