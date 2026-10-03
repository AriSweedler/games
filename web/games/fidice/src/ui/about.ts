// The About panel's copy (docs/design/fidice-shell-adoption.md §7 D12: a tab the legacy page never
// had, so the words are new), rendered at boot by the shell (main.ts `hooks.render`:
// web/shared/ui/shellPaint.ts `renderCopy` over web/shared/ui/glossary.ts `aboutHtml`) with its
// jargon linked to the rules (docs/design/glossary-links.md). Fidice's own voice, not another
// game's: the cup, the lake, the house rules.

export const ABOUT_PARAGRAPHS: ReadonlyArray<string> = [
  "Fidice is one-cup liar's dice the way the Crowe house plays it on Kezar Lake, Maine: five dice under one cup that goes round the table, a hand declared from the ladder each time it moves, and one question for whoever gets it next — raise, or call liar? Lose a call and you lose a life (or a kayak, if the table is playing for stakes); keep score instead and the fewest rounds lost wins when the evening ends.",
  'This page seats two to six. Pass one phone around the table, or open a table online and share its code; computers can take any empty chair, play against you alone, or play each other while you watch. The ladder of all 252 hands is a tab of its own, and the bid box finds a hand from a few typed letters.',
];
