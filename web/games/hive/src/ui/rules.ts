// The Rules tab and the in-game rules sheet (docs/design/hive.md §5; the owner, 2026-10-02: "the
// ruleset to teach players should be as short as possible, ideally fitting on 1 screen"): the goal,
// placing, the Queen, each bug's move and the two rules of the hive, one line each; the long form
// is docs/design/hive.md §4. The About copy names the page, its first "hive" the lower-case word
// (the shell's glossary spec taps the game's own name in lower case, as briscola's About does:
// `linkJargon` links a term's first occurrence in any case, so a leading "Hive" would take the
// link and leave the word plain). Both are static, filled once at boot (render.ts `renderRules`).
import {
  linkJargon,
  rulesListHtml,
  type Glossary,
  type RuleItem,
} from '../../../../shared/ui/glossary.ts';

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

export const RULES: ReadonlyArray<RuleItem> = [
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
    id: 'queen',
    heading: 'Queen 🐝',
    body: 'Down by your fourth tile; no moves before her. She slides 1 step.',
  },
  {
    id: 'beetle',
    heading: 'Beetle 🪲',
    body: '1 step, may climb onto the hive; a covered tile is stuck and takes the Beetle’s colour.',
  },
  {
    id: 'grasshopper',
    heading: 'Grasshopper 🦗',
    body: 'Jumps a straight line of tiles to the first empty hex.',
  },
  { id: 'spider', heading: 'Spider 🕷️', body: 'Slides exactly 3 steps around the hive.' },
  { id: 'ant', heading: 'Ant 🐜', body: 'Slides any distance around the hive.' },
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
];

export const rulesItemsHtml = (): string => rulesListHtml(RULES, GLOSSARY);

const ABOUT_PARAGRAPHS: ReadonlyArray<string> = [
  'Eleven bugs a side on a board that grows as you play: place them around the hive and move them along it, and the first Queen surrounded on all six sides loses. That is Hive, for two.',
  'Pass one phone back and forth, or open a table online and send the link: both phones show the same board, since nothing is hidden.',
];

export const aboutHtml = (): string =>
  linkJargon(ABOUT_PARAGRAPHS.map((p) => `<p>${p}</p>`).join('\n'), GLOSSARY);
