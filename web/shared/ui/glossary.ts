// Glossary links (docs/design/glossary-links.md): jargon in a game's About copy, and in a rule that
// names another rule, is a link to that rule. The owner: "Clicking jargon in the 'about' section
// will take you to the 'rules' section. This should be true for ALL of the games." Pure and
// shared: a game supplies its rules as `RuleItem`s with ids and its `Glossary` (the words that mean
// each rule); these helpers build the rules list with the anchors, wrap the terms in links and read
// a `#rule-<id>` deep link. The edge that scrolls and flashes the rule is web/shared/edge/glossary.ts.

/**
 * A rule item: an id (the anchor), its heading and body as safe HTML (the body may contain jargon),
 * and `art`, inline SVG markup (a game's own, hive's engraved bug on a tile) that makes the rule a
 * panel with the picture at its left.
 */
export type RuleItem = Readonly<{ id: string; heading: string; body: string; art?: string }>;

/**
 * A group of rules under one heading (the owner, 2026-10-02, on hive: "the specific-to-movement-
 * of-a-bug rules and the other rules should be in separate columns"): the slot's list becomes one
 * `<li>` per group, each holding its own `rules-list`, stacked on a phone and side by side where
 * the slot is wide (shell.css). `id` names the group (`data-group`); the rules keep their anchors.
 */
export type RuleGroup = Readonly<{ id: string; heading: string; rules: ReadonlyArray<RuleItem> }>;

/** A glossary entry: the words that mean this rule (whole words, any case; phrases allowed). */
export type GlossaryEntry = Readonly<{ rule: string; terms: ReadonlyArray<string> }>;
export type Glossary = ReadonlyArray<GlossaryEntry>;

const ANCHOR_PREFIX = 'rule-';

/** The element id of a rule: `rule-<id>`, the `<li>`'s id and the hash a deep link carries. */
export const ruleAnchor = (id: string): string => `${ANCHOR_PREFIX}${id}`;

/** The class every jargon link carries (styled by each theme; the edge delegates clicks on it). */
export const JARGON_CLASS = 'jargon';

/**
 * The ids of the two rules-list `<ul>` slots every game renders from one list: the home tab's and
 * the in-game overlay's. Both hold the same `<li id="rule-<id>">`s, so `revealRule` takes the slot
 * the reducer says is on screen rather than searching the document. (No class attribute is spelt
 * here: test/dist/class-contract.test.ts reads `class="…"` out of source, comments included.)
 */
export const RULES_SLOT_IDS = ['rulesList', 'rulesOverlayList'] as const;
export type RulesSlot = (typeof RULES_SLOT_IDS)[number];

/** A term and the rule it means, one row per term. */
type Term = Readonly<{ term: string; rule: string }>;
/** A term with its place in the glossary, for a stable sort. */
type Ranked = Readonly<{ row: Term; index: number }>;

/** A regexp that matches `text` literally. */
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The first whole-word occurrence of `term`, any case. */
const wordPattern = (term: string): RegExp => new RegExp(`\\b(${escapeRegExp(term)})\\b`, 'i');

/**
 * `html` cut at every tag: even indices are text, odd indices are tags (`<…>`), so a term can never
 * be matched inside a tag's name or attributes.
 */
const segments = (html: string): ReadonlyArray<string> => html.split(/(<[^>]*>)/);

/**
 * For each segment, whether it sits inside an `<a>` already open (its own text is never re-linked)
 * or inside a `<table>` (a rule's table of values is data, never prose: its cells are never linked).
 */
const insideProtected = (parts: ReadonlyArray<string>): ReadonlyArray<boolean> =>
  parts
    .reduce<ReadonlyArray<Readonly<{ depth: number; inside: boolean }>>>((acc, part) => {
      const depth = acc.at(-1)?.depth ?? 0;
      const opens = /^<(a|table)[\s>]/i.test(part);
      const closes = /^<\/(a|table)\s*>/i.test(part);
      return [...acc, { depth: depth + (opens ? 1 : 0) - (closes ? 1 : 0), inside: depth > 0 }];
    }, [])
    .map((s) => s.inside);

const linkTag = (rule: string, word: string): string =>
  `<a class="${JARGON_CLASS}" href="#${ruleAnchor(rule)}" data-rule="${rule}">${word}</a>`;

/**
 * `html` with the first occurrence of `term` (outside tags, existing links and tables) wrapped as a
 * link to `rule`; `html` unchanged when the term is absent.
 */
const linkOne = (html: string, { term, rule }: Term): string => {
  const parts = segments(html);
  const inside = insideProtected(parts);
  const pattern = wordPattern(term);
  const at = parts.findIndex(
    (part, i) => i % 2 === 0 && !(inside[i] ?? false) && pattern.test(part),
  );
  if (at === -1) return html;
  return parts
    .map((part, i) =>
      i === at ? part.replace(pattern, (_m, word: string) => linkTag(rule, word)) : part,
    )
    .join('');
};

/**
 * Every term of `glossary` (minus the rule `except`), longest first so "doubling cube" wins over
 * "cube" and "bear them off" over "bear off"; ties keep the glossary's order.
 */
const termsOf = (glossary: Glossary, except: string | undefined): ReadonlyArray<Term> =>
  glossary
    .filter((entry) => entry.rule !== except)
    .flatMap((entry) => entry.terms.map((term): Term => ({ term, rule: entry.rule })))
    .map((row, index): Ranked => ({ row, index }))
    .sort((a: Ranked, b: Ranked) => b.row.term.length - a.row.term.length || a.index - b.index)
    .map((ranked: Ranked) => ranked.row);

/** `short` is a word inside a longer term already linked for the same rule ("cube" in "doubling cube"). */
const insideLinkedTerm = (linked: ReadonlyArray<Term>, short: Term): boolean =>
  linked.some(
    (long) =>
      long.rule === short.rule &&
      long.term !== short.term &&
      wordPattern(short.term).test(long.term),
  );

/**
 * `html` with its jargon linked: every term on its first occurrence (longest terms first), whole
 * words, any case, never inside a tag, an existing `<a>` or a `<table>`. A word that is part of a longer term
 * already linked for the same rule is left alone, so "adds the doubling cube" after a linked
 * "doubling cube" does not grow a link on "cube" alone. `except` is the rule this text sits in, so
 * a rule never links to itself.
 */
export const linkJargon = (
  html: string,
  glossary: Glossary,
  options: Readonly<{ except?: string }> = {},
): string =>
  termsOf(glossary, options.except).reduce<Readonly<{ html: string; linked: ReadonlyArray<Term> }>>(
    (acc, term) => {
      if (insideLinkedTerm(acc.linked, term)) return acc;
      const next = linkOne(acc.html, term);
      return next === acc.html ? acc : { html: next, linked: [...acc.linked, term] };
    },
    { html, linked: [] },
  ).html;

/** The class of a rule that carries art: a panel, the art tile at its left (shell.css `.rule-card`). */
const CARD_CLASS = 'rule-card';

/**
 * One `<li id="rule-<id>"><strong>Heading:</strong> body</li>`, the body's jargon linked; with art,
 * `<li class="rule-card">` holding the art in a `<span class="rule-art">` (decoration: the heading
 * names the bug) and the text in a `<span class="rule-copy">`.
 */
const ruleHtml = (item: RuleItem, glossary: Glossary): string => {
  const copy = `<strong>${item.heading}:</strong> ${linkJargon(item.body, glossary, { except: item.id })}`;
  return item.art === undefined
    ? `<li id="${ruleAnchor(item.id)}">${copy}</li>`
    : `<li id="${ruleAnchor(item.id)}" class="${CARD_CLASS}"><span class="rule-art" aria-hidden="true">${item.art}</span><span class="rule-copy">${copy}</span></li>`;
};

/** A list of groups rather than of rules: the first entry carries `rules`. */
const isGrouped = (
  list: ReadonlyArray<RuleItem> | ReadonlyArray<RuleGroup>,
): list is ReadonlyArray<RuleGroup> => {
  const first = list[0];
  return first !== undefined && 'rules' in first;
};

/**
 * One `<li class="rules-group" data-group="<id>">` per group: its `<h3>` and a nested
 * `<ul class="rules-list">` of its rules (the slot is itself a `<ul>`, so a group is a list item,
 * not a `<section>`: the markup stays valid and every rule's `<li id="rule-<id>">` is still inside
 * the slot for `revealRule`).
 */
const groupHtml = (group: RuleGroup, glossary: Glossary): string =>
  `<li class="rules-group" data-group="${group.id}"><h3>${group.heading}</h3><ul class="rules-list">\n${group.rules
    .map((item) => ruleHtml(item, glossary))
    .join('\n')}\n</ul></li>`;

/**
 * The rules slot's markup: one `<li id="rule-<id>"><strong>Heading:</strong> body</li>` per item of
 * a flat list, the body's jargon linked (a rule with `art` is a `rule-card`), or one `rules-group`
 * `<li>` per group of a grouped list.
 */
export const rulesListHtml = (
  list: ReadonlyArray<RuleItem> | ReadonlyArray<RuleGroup>,
  glossary: Glossary,
): string =>
  isGrouped(list)
    ? list.map((group) => groupHtml(group, glossary)).join('\n')
    : list.map((item) => ruleHtml(item, glossary)).join('\n');

/** The rule id a `#rule-<id>` hash names (`location.hash`, with or without the `#`), else null. */
export const ruleFromHash = (hash: string): string | null => {
  const m = /^#?rule-([a-z][a-z0-9-]*)$/.exec(hash);
  return m?.[1] ?? null;
};
