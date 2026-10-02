// The words that mean each rule (docs/design/glossary-links.md §2): what the About copy links to
// the Rules tab through web/shared/ui/glossary.ts `linkJargon`. Phrases beat the words inside them.
import type { Glossary } from '../../../../shared/ui/glossary.ts';

export const GLOSSARY: Glossary = [
  { rule: 'flip7', terms: ['flip 7', 'seven different numbers'] },
  { rule: 'goal', terms: ['points', '200'] },
  { rule: 'turn', terms: ['hit', 'stay', 'bank'] },
  { rule: 'bust', terms: ['bust', 'busts'] },
  { rule: 'freeze', terms: ['freeze'] },
  { rule: 'flipthree', terms: ['flip three'] },
  { rule: 'second', terms: ['second chance'] },
];
