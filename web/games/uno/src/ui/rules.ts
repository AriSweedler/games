// The Rules tab and the in-game rules sheet (docs/design/uno.md §9; the owner, 2026-10-02: "the
// ruleset to teach players should be as short as possible, ideally fitting on 1 screen"): the
// goal, the turn and the special cards, one line each; the long form is docs/design/uno.md. The
// About copy names the page. Both are static, filled once at boot (render.ts `renderRules`).
import {
  linkJargon,
  rulesListHtml,
  type Glossary,
  type RuleItem,
} from '../../../../shared/ui/glossary.ts';

/**
 * The words linked to their rule (docs/design/glossary-links.md): "wild" in the About copy opens
 * the Wild rule, the goal's "score" the points, the points' "wilds" the Wild rule.
 */
export const GLOSSARY: Glossary = [
  { rule: 'wild', terms: ['wild', 'wilds'] },
  { rule: 'points', terms: ['score'] },
  { rule: 'turn', terms: ['matches'] },
];

export const RULES: ReadonlyArray<RuleItem> = [
  {
    id: 'goal',
    heading: 'Goal',
    body: 'Empty your hand first. You score the cards left in the other hands; 500 wins.',
  },
  {
    id: 'turn',
    heading: 'Your turn',
    body: 'Play a card that matches the top card by colour, number or symbol. Can’t? Draw one; play it if it matches, or keep it and pass.',
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
    id: 'points',
    heading: 'Points',
    body: 'Number cards their face, actions 20, wilds 50.',
  },
];

export const rulesItemsHtml = (): string => rulesListHtml(RULES, GLOSSARY);

const ABOUT_PARAGRAPHS: ReadonlyArray<string> = [
  'UNO for two to twelve: lay a card that matches the colour or the number, or a wild that names the colour, and be the first with an empty hand.',
  'Pass one phone around the table (a curtain hides each hand while the phone changes hands), or open a table online and send the link: every phone shows its own hand.',
];

export const aboutHtml = (): string =>
  linkJargon(ABOUT_PARAGRAPHS.map((p) => `<p>${p}</p>`).join('\n'), GLOSSARY);
