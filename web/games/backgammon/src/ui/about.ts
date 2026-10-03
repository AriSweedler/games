// The About panel's copy (docs/design/backgammon-board.md §5.1: two short paragraphs, reviewed by
// the owner), rendered keyed on the ruleset by render.ts `renderAbout` over the shared
// web/shared/ui/glossary.ts `aboutHtml`, its jargon linked to that ruleset's rules
// (docs/design/glossary-links.md: "Clicking jargon in the 'about' section will take you to the
// 'rules' section"). The title never says Sephardic; this paragraph does, as the owner asked.

/** The paragraphs, plain prose: the links are added per ruleset, since Portes has no cube rule to land on. */
export const ABOUT_PARAGRAPHS: ReadonlyArray<string> = [
  'Sheshbesh is what Sephardic Jews around the eastern Mediterranean called backgammon: six and five, the roll that gives the game its name. It was played in the cafés of Salonica, Izmir and Jerusalem on the same wooden boards their Greek and Turkish neighbours used, and it travelled with the families who left.',
  'This page plays two rulesets. Portes is the first game of the Greek set: no doubling cube, a gammon counts double, and the winner of the opening roll rolls again. Western backgammon adds the doubling cube, the triple for a backgammon and the Crawford rule in a match. Bear off all fifteen to win a game; pass one phone between you, or open a table and share the code.',
];
