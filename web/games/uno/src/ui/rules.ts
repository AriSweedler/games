// The Rules tab and the in-game rules sheet (docs/design/uno.md §9; the owner, 2026-10-02: "the
// ruleset to teach players should be as short as possible, ideally fitting on 1 screen"): the
// goal, the turn, the special cards and the UNO call (§7), one line each; one round is the game, so
// no points (the owner: "UNO should only be single round games"); the long form is docs/design/uno.md. The About
// copy names the page. Both are static, filled once at boot (render.ts `renderRules`).
import {
  linkJargon,
  rulesListHtml,
  type Glossary,
  type RuleItem,
} from '../../../../shared/ui/glossary.ts';

/**
 * The words linked to their rule (docs/design/glossary-links.md): "wild" in the About copy and the
 * turn's rule opens the Wild rule, "draws" in the Draw Two and Wild Draw Four rules the turn's.
 */
export const GLOSSARY: Glossary = [
  { rule: 'wild', terms: ['wild', 'wilds'] },
  { rule: 'turn', terms: ['draws'] },
];

export const RULES_ITEMS: ReadonlyArray<RuleItem> = [
  {
    id: 'goal',
    heading: 'Goal',
    body: 'Empty your hand to win. One round is the game.',
  },
  {
    id: 'turn',
    heading: 'Your turn',
    body: 'Play a card that matches the top card by colour, number or symbol, or a wild. Can’t? Draw one; play it if it matches, or keep it and pass.',
  },
  { id: 'skip', heading: 'Skip ⊘', body: 'The next player misses a turn.' },
  { id: 'reverse', heading: 'Reverse ⇄', body: 'Play turns around (with two, you go again).' },
  { id: 'draw2', heading: 'Draw Two +2', body: 'The next player draws two and misses a turn.' },
  { id: 'wild', heading: 'Wild W', body: 'Plays on anything; you name the colour.' },
  {
    id: 'wild4',
    heading: 'Wild Draw Four +4',
    body: 'Name the colour; the next player draws four and misses a turn.',
  },
  {
    id: 'uno',
    heading: 'UNO!',
    body: 'Tap UNO as you play down to one card. Caught without it before the next player moves: draw two.',
  },
];

export const rulesItemsHtml = (): string => rulesListHtml(RULES_ITEMS, GLOSSARY);

const ABOUT_PARAGRAPHS: ReadonlyArray<string> = [
  'UNO for two to twelve: lay a card that matches the colour or the number, or a wild that names the colour, and be the first with an empty hand.',
  'Pass one phone around the table (a curtain hides each hand while the phone changes hands), or open a table online and send the link: every phone shows its own hand.',
];

export const aboutHtml = (): string =>
  linkJargon(ABOUT_PARAGRAPHS.map((p) => `<p>${p}</p>`).join('\n'), GLOSSARY);
