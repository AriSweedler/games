import { describe, expect, test } from 'vitest';

import { BUGS } from '../engine/pieces.ts';
import { RULES_ITEMS, RULE_GROUPS, aboutHtml, bugArt, rulesItemsHtml } from './rules.ts';

describe('the rules', () => {
  test('two groups, the bugs first: nine one-line rules, under 150 words in all', () => {
    expect(RULE_GROUPS.map((g) => [g.id, g.rules.map((r) => r.id)])).toEqual([
      ['bugs', ['queen', 'beetle', 'grasshopper', 'spider', 'ant']],
      ['game', ['goal', 'place', 'hive', 'slide']],
    ]);
    const words = RULES_ITEMS.flatMap((r) => `${r.heading} ${r.body}`.split(/\s+/));
    expect(words.length).toBeLessThan(150);
    expect(RULES_ITEMS.find((r) => r.id === 'goal')?.body).toContain('Surround the other Queen');
  });

  test('each bug is a panel with its engraved tile, named without an emoji; the other rules carry no art', () => {
    const [bugs, game] = RULE_GROUPS;
    bugs?.rules.forEach((rule, i) => {
      expect(rule.art).toBe(bugArt(BUGS[i] ?? 'ant'));
      expect(rule.heading).toMatch(/^[A-Za-z]+$/);
    });
    game?.rules.forEach((rule) => {
      expect(rule.art).toBeUndefined();
    });
    expect(bugArt('queen')).toContain('<svg class="tile w"');
    expect(bugArt('queen')).toContain('<polygon class="face"');
    expect(bugArt('queen')).toContain('href="#bug-queen"');
    expect(bugArt('queen')).not.toContain('class="sheen"');
  });

  test('the slot markup: a rules-group per group, the cards inside the first', () => {
    const html = rulesItemsHtml();
    expect(html).toContain('<li class="rules-group" data-group="bugs"><h3>The bugs</h3>');
    expect(html).toContain('<li class="rules-group" data-group="game"><h3>The game</h3>');
    expect(html.indexOf('data-group="bugs"')).toBeLessThan(html.indexOf('data-group="game"'));
    expect(html).toContain('<li id="rule-queen" class="rule-card">');
    expect(html).toContain('<li id="rule-goal"><strong>Goal:</strong>');
  });

  test('the jargon links: the goal to the Queen, the Beetle to the hive, the About to the hive', () => {
    const html = rulesItemsHtml();
    expect(html).toContain('<li id="rule-goal">');
    expect(html).toMatch(/id="rule-goal">.*data-rule="queen"/);
    expect(html).toMatch(/id="rule-beetle" class="rule-card">.*data-rule="hive"/);
    // The About's link is the lower-case word itself, the one the shell's glossary spec taps
    // (e2e/shell-glossary.spec.ts: `aboutTerm: 'hive'`); the game's name later stays plain.
    expect(aboutHtml()).toContain('data-rule="hive">hive</a>');
    expect(aboutHtml()).not.toMatch(/data-rule="hive">Hive</);
  });
});
