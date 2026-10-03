// The About copy (ui/about.ts): two paragraphs in Flip 7's voice, the seat range the page seats
// (page.ts PLAYERS, engine/index.ts SEAT_COUNTS), the jargon linked to the rules once.
import { describe, expect, test } from 'vitest';

import { aboutHtml } from '../../../../shared/ui/glossary.ts';
import { SEAT_COUNTS } from '../engine/index.ts';
import { ABOUT_PARAGRAPHS } from './about.ts';
import { GLOSSARY } from './glossary.ts';

const WORDS: Readonly<Record<number, string>> = { 2: 'two', 12: 'twelve' };

describe('the About copy', () => {
  test('two paragraphs, one <p> each, seating the range the steppers offer; no other game named', () => {
    expect(ABOUT_PARAGRAPHS).toHaveLength(2);
    const html = aboutHtml(ABOUT_PARAGRAPHS, GLOSSARY);
    expect(html.match(/<p>/g)).toHaveLength(2);
    const [min, max] = [SEAT_COUNTS[0], SEAT_COUNTS[SEAT_COUNTS.length - 1] ?? SEAT_COUNTS[0]];
    expect(html.toLowerCase()).toContain(
      `${WORDS[min] ?? String(min)} to ${WORDS[max] ?? String(max)} players`,
    );
    expect(html).not.toMatch(/two to six/i);
    expect(html).not.toMatch(/uno|gin|briscola|backgammon|hive/i);
  });

  test('the first "Flip 7" links to the flip7 rule, and "busts" to the bust rule', () => {
    const html = aboutHtml(ABOUT_PARAGRAPHS, GLOSSARY);
    expect(html).toMatch(/<a [^>]*#rule-flip7[^>]*>Flip 7<\/a>/);
    expect(html).toMatch(/<a [^>]*#rule-bust[^>]*>busts<\/a>/);
  });
});
