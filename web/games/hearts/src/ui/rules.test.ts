import { describe, expect, test } from 'vitest';

import { aboutHtml, rulesListHtml } from '../../../../shared/ui/glossary.ts';
import { ABOUT_PARAGRAPHS, GLOSSARY, RULES_ITEMS } from './rules.ts';

describe('the rules', () => {
  test('short enough for one phone screen: eight one-line rules, under 130 words in all', () => {
    expect(RULES_ITEMS.map((r) => r.id)).toEqual([
      'goal',
      'pass',
      'lead',
      'follow',
      'first',
      'broken',
      'points',
      'moon',
    ]);
    const words = RULES_ITEMS.flatMap((r) => `${r.heading} ${r.body}`.split(/\s+/));
    expect(words.length).toBeLessThan(130);
    expect(RULES_ITEMS.find((r) => r.id === 'goal')?.body).toContain('100');
    expect(RULES_ITEMS.find((r) => r.id === 'points')?.body).toMatch(/1 point.*13/);
  });

  test('the jargon links: follow suit and the first trick to the lead, the About to the pass, follow suit and the moon', () => {
    const html = rulesListHtml(RULES_ITEMS, GLOSSARY);
    expect(html).toContain('<li id="rule-goal">');
    expect(html).toMatch(/id="rule-follow">(?:(?!<li).)*data-rule="lead"/s);
    expect(html).toMatch(/id="rule-first">(?:(?!<li).)*data-rule="lead"/s);
    const about = aboutHtml(ABOUT_PARAGRAPHS, GLOSSARY);
    expect(about).toContain('data-rule="pass"');
    expect(about).toContain('data-rule="follow">follow suit</a>');
    expect(about).toContain('data-rule="moon">shoot the moon</a>');
  });
});
