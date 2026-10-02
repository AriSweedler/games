import { describe, expect, test } from 'vitest';

import { RULES_ITEMS, aboutHtml, rulesItemsHtml } from './rules.ts';

describe('the rules', () => {
  test('short enough for one phone screen: eight one-line rules, no points, under 120 words in all', () => {
    expect(RULES_ITEMS.map((r) => r.id)).toEqual([
      'goal',
      'turn',
      'skip',
      'reverse',
      'draw2',
      'wild',
      'wild4',
      'uno',
    ]);
    const words = RULES_ITEMS.flatMap((r) => `${r.heading} ${r.body}`.split(/\s+/));
    expect(words.length).toBeLessThan(120);
    expect(RULES_ITEMS.find((r) => r.id === 'goal')?.body).toContain('Empty your hand to win');
    expect(words.join(' ')).not.toMatch(/points|score|500/);
  });

  test('the jargon links: the turn to the wild, Draw Two to the turn, the About to the wild', () => {
    const html = rulesItemsHtml();
    expect(html).toContain('<li id="rule-goal">');
    expect(html).toMatch(/id="rule-turn">.*data-rule="wild"/);
    expect(html).toMatch(/id="rule-draw2">.*data-rule="turn"/);
    expect(aboutHtml()).toContain('data-rule="wild"');
  });
});
