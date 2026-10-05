import { describe, expect, test } from 'vitest';

import { aboutHtml, rulesListHtml } from '../../../../shared/ui/glossary.ts';
import { ABOUT_PARAGRAPHS, GLOSSARY, RULES_ITEMS } from './rules.ts';

describe('the rules', () => {
  test('short enough for one phone screen: the goal, the turn and the end, under 150 words in all', () => {
    expect(RULES_ITEMS.map((r) => r.id)).toEqual(['goal', 'turn', 'end']);
    const words = RULES_ITEMS.flatMap((r) => `${r.heading} ${r.body}`.split(/\s+/));
    expect(words.length).toBeLessThan(150);
  });

  test('the jargon links: the goal to the turn, the About to the turn', () => {
    const html = rulesListHtml(RULES_ITEMS, GLOSSARY);
    expect(html).toContain('<li id="rule-goal">');
    expect(html).toMatch(/id="rule-goal">.*data-rule="turn"/);
    expect(aboutHtml(ABOUT_PARAGRAPHS, GLOSSARY)).toContain('data-rule="turn">pass</a>');
  });
});
