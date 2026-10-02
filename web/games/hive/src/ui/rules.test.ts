import { describe, expect, test } from 'vitest';

import { RULES_ITEMS, aboutHtml, rulesItemsHtml } from './rules.ts';

describe('the rules', () => {
  test('short enough for one phone screen: nine one-line rules, under 150 words in all', () => {
    expect(RULES_ITEMS.map((r) => r.id)).toEqual([
      'goal',
      'place',
      'queen',
      'beetle',
      'grasshopper',
      'spider',
      'ant',
      'hive',
      'slide',
    ]);
    const words = RULES_ITEMS.flatMap((r) => `${r.heading} ${r.body}`.split(/\s+/));
    expect(words.length).toBeLessThan(150);
    expect(RULES_ITEMS.find((r) => r.id === 'goal')?.body).toContain('Surround the other Queen');
  });

  test('the jargon links: the goal to the Queen, the Beetle to the hive, the About to the hive', () => {
    const html = rulesItemsHtml();
    expect(html).toContain('<li id="rule-goal">');
    expect(html).toMatch(/id="rule-goal">.*data-rule="queen"/);
    expect(html).toMatch(/id="rule-beetle">.*data-rule="hive"/);
    // The About's link is the lower-case word itself, the one the shell's glossary spec taps
    // (e2e/shell-glossary.spec.ts: `aboutTerm: 'hive'`); the game's name later stays plain.
    expect(aboutHtml()).toContain('data-rule="hive">hive</a>');
    expect(aboutHtml()).not.toMatch(/data-rule="hive">Hive</);
  });
});
