// The Rules tab and the in-game rules sheet (docs/design/hearts.md §9; the owner, 2026-10-02: "the
// ruleset to teach players should be as short as possible, ideally fitting on 1 screen"): the goal,
// the pass, the lead, then one line per special case, eight lines that fit 390x844 with no scroll;
// the long form is docs/design/hearts.md §§2-6. The About copy names the page. Both are tables the
// boot renders once (web/shared/edge/boot.ts `copy`).
import type { Glossary, RuleItem } from '../../../../shared/ui/glossary.ts';

/**
 * The words linked to their rule (docs/design/glossary-links.md): "trick" opens the lead's rule,
 * "follow suit" the follow rule, "broken" the hearts rule, "shoot the moon" the moon's; "pass" in
 * the About copy opens the pass's rule. Longest phrases first, so "shoot the moon" links whole.
 */
export const GLOSSARY: Glossary = [
  { rule: 'moon', terms: ['shoot the moon', 'shoots the moon'] },
  { rule: 'follow', terms: ['follow suit', 'follows suit'] },
  { rule: 'broken', terms: ['broken'] },
  { rule: 'lead', terms: ['trick', 'tricks'] },
  { rule: 'pass', terms: ['pass', 'passes'] },
];

export const RULES_ITEMS: ReadonlyArray<RuleItem> = [
  {
    id: 'goal',
    heading: 'Goal',
    body: 'Take the fewest points. When someone reaches 100, the lowest score wins.',
  },
  {
    id: 'pass',
    heading: 'The pass',
    body: 'Before each hand, pass three cards: left, right, across, then hold.',
  },
  {
    id: 'lead',
    heading: 'The lead',
    body: 'The 2♣ leads the first trick; whoever takes a trick leads the next.',
  },
  {
    id: 'follow',
    heading: 'Follow suit',
    body: 'Follow suit if you can. The highest card of the suit led takes the trick.',
  },
  {
    id: 'first',
    heading: 'First trick',
    body: 'No hearts or queen of spades on the first trick.',
  },
  {
    id: 'broken',
    heading: 'Hearts broken',
    body: 'A heart leads only once one has been played (or you hold nothing else).',
  },
  { id: 'points', heading: 'Points', body: 'Each heart is 1 point. The queen of spades is 13.' },
  {
    id: 'moon',
    heading: 'The moon',
    body: 'Take all 26 and you shoot the moon: the others score 26, you score 0.',
  },
];

export const ABOUT_PARAGRAPHS: ReadonlyArray<string> = [
  'Hearts for three or four: pass three cards, follow suit, and dodge the hearts and the queen of spades until someone reaches 100 points. Or take them all and shoot the moon.',
  'Pass one phone around the table (a curtain hides each hand while the phone changes hands), or open a table online and send the link: every phone shows its own hand.',
];
