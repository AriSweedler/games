import { describe, expect, test } from 'vitest';

import { RULES, aboutHtml, rulesItemsHtml } from './rules.ts';

describe('the rules', () => {
  test('short enough for one phone screen: eight one-line rules, under 120 words in all', () => {
    expect(RULES.map((r) => r.id)).toEqual([
      'goal',
      'turn',
      'skip',
      'reverse',
      'draw2',
      'wild',
      'wild4',
      'points',
    ]);
    const words = RULES.flatMap((r) => `${r.heading} ${r.body}`.split(/\s+/));
    expect(words.length).toBeLessThan(120);
  });

  test('the jargon links: the goal to the points, the points to the wild, the About to the wild', () => {
    const html = rulesItemsHtml();
    expect(html).toContain('<li id="rule-goal">');
    expect(html).toMatch(/id="rule-goal">.*data-rule="points"/);
    expect(html).toMatch(/id="rule-points">.*data-rule="wild"/);
    expect(aboutHtml()).toContain('data-rule="wild"');
  });
});
