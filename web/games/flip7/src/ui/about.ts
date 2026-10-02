// The About panel's copy, its jargon linked to the rules (docs/design/glossary-links.md). The
// first word linked is the game's own name, the way the shell's glossary spec taps it.
import { linkJargon } from '../../../../shared/ui/glossary.ts';
import { GLOSSARY } from './glossary.ts';

export const ABOUT_PARAGRAPHS: ReadonlyArray<string> = [
  'Flip 7 is a press-your-luck card game: flip cards one at a time, bank your line before a repeated number busts it, and chase seven different numbers for the bonus.',
  'Two to six players: pass one phone around, or open a table online and send the link. Every card is face up, so nobody needs to look away.',
];

export const aboutHtml = (): string =>
  linkJargon(ABOUT_PARAGRAPHS.map((p) => `<p>${p}</p>`).join('\n'), GLOSSARY);
