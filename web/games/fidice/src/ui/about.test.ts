// The About copy (ui/about.ts): two paragraphs in fidice's voice, the jargon linked to the rules once.
import { describe, expect, test } from 'vitest';

import { aboutHtml } from '../../../../shared/ui/glossary.ts';
import { ABOUT_PARAGRAPHS } from './about.ts';
import { GLOSSARY } from './rules.ts';

describe('the About copy', () => {
  test('two paragraphs, one <p> each, about the cup, the lake and this page; no other game named', () => {
    expect(ABOUT_PARAGRAPHS).toHaveLength(2);
    const html = aboutHtml(ABOUT_PARAGRAPHS, GLOSSARY);
    expect(html.match(/<p>/g)).toHaveLength(2);
    expect(html).toContain('Kezar Lake');
    expect(html).toContain('two to six');
    expect(html).not.toMatch(/gin|briscola|backgammon/i);
  });

  test('the first "the ladder" links to the ladder rule, and the later "ladder" stays plain; "call liar" links to calling', () => {
    const html = aboutHtml(ABOUT_PARAGRAPHS, GLOSSARY);
    expect(html).toMatch(/<a [^>]*#rule-ladder[^>]*>the ladder<\/a>/);
    expect(html.match(/#rule-ladder/g)).toHaveLength(1);
    expect(html).toMatch(/<a [^>]*#rule-calling[^>]*>call liar<\/a>/);
  });
});
