// The Rules tab (docs/design/flip7.md §1-§6 is the long form): the game in as few words as fit one
// phone screen (390x844, no scroll), the one source both slots render from (`#rulesList` on the
// home tab, `#rulesOverlayList` over the table). The goal, the turn, the bust and the special
// cards, one line each; each item's id is the anchor a glossary link lands on.
import type { RuleItem } from '../../../../shared/ui/glossary.ts';

export const RULES_ITEMS: ReadonlyArray<RuleItem> = [
  { id: 'goal', heading: 'Goal', body: 'First to 200 points wins.' },
  {
    id: 'turn',
    heading: 'Your turn',
    body: 'Hit: flip a card into your line. Stay: bank your line and sit out the round.',
  },
  { id: 'bust', heading: 'Bust', body: 'A number you already have: you score 0 this round.' },
  {
    id: 'flip7',
    heading: 'Flip 7',
    body: 'Seven different numbers: +15, and the round ends for everyone.',
  },
  { id: 'freeze', heading: 'Freeze', body: 'Give it to a player still in: they bank and are out.' },
  {
    id: 'flipthree',
    heading: 'Flip Three',
    body: 'Give it to a player still in: they flip three cards.',
  },
  { id: 'second', heading: 'Second Chance', body: 'Keep it: it cancels one bust.' },
  { id: 'bonus', heading: '+2 to +10, x2', body: 'Add to your line; x2 doubles its numbers.' },
];
