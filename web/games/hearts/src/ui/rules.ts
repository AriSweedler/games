// The Rules tab and the in-game rules sheet (docs/design/hearts.md §4; the owner, 2026-10-02: "the
// ruleset to teach players should be as short as possible, ideally fitting on 1 screen"): the goal,
// the turn, then the special cases one line each; the long form is docs/design/hearts.md. The About
// copy names the page. Both are tables the boot renders once (web/shared/edge/boot.ts `copy`). TODO: the
// real rules, as few lines as fit 390x844.
import type { Glossary, RuleItem } from '../../../../shared/ui/glossary.ts';

/** The words linked to their rule (docs/design/glossary-links.md): "pass" in the goal opens the Turn rule. */
export const GLOSSARY: Glossary = [{ rule: 'turn', terms: ['pass', 'passes'] }];

export const RULES_ITEMS: ReadonlyArray<RuleItem> = [
  {
    id: 'goal',
    heading: 'Goal',
    body: 'Be the seat the draw favours after ten passes, or outlast a resignation.',
  },
  { id: 'turn', heading: 'A turn', body: 'Pass, or resign. The turn then goes to the other seat.' },
  { id: 'end', heading: 'The end', body: 'After the tenth pass the draw names the winner.' },
];

export const ABOUT_PARAGRAPHS: ReadonlyArray<string> = [
  'Hearts, for two. This is the scaffold’s placeholder: each pass hands the turn over, and the tenth decides the game on a draw.',
  'Pass one phone back and forth, or open a table online and send the link.',
];
