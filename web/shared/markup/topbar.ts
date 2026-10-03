// The table's topbar (docs/design/dry-review-2026-10.md §2.2 row 179-211, §7 row 14): the shell's
// five buttons around the names strip, spelled once for the pages whose strip is the two names and
// the other seat's connection dot (uno's and Flip 7's; hive's carries its side swatches, briscola's
// and backgammon's a menu, so theirs stay their own). Left of the strip, Leave and the hidden
// Continue online; right of it, Rules, History and Sound: the ids the shell binds and paints
// (web/shared/markup/shell.ts BLOCK_IDS, SCREEN_IDS; web/shared/ui/shellPaint.ts). The strip is
// `.names-strip` (each theme styles it): `#myName`, `#oppName` and `#oppDot`, the dot between the
// names or after them, and whatever the page puts between the names (uno's direction arrow).
// Pure: a string.

/** The topbar: where the dot sits, what the page puts between the names, the two titles a page says differently, the indent every line gets. */
export type TopbarMarkup = Readonly<{
  /** The other seat's connection dot: between the two names (Flip 7) or after them (uno). */
  dot: 'between' | 'last';
  /** One line of the page's own markup between my name and the other's; none by default. */
  between?: string;
  /** The Leave and History buttons' title and label, where the page's words differ from the shell's. */
  titles?: Readonly<Partial<Record<'leave' | 'history', string>>>;
  indent?: string;
}>;

/** The shell's words for the two buttons a page may rename. */
export const TOPBAR_TITLES: Readonly<Record<'leave' | 'history', string>> = {
  leave: 'Leave the table',
  history: 'History',
};

/** The strip's ids, in the markup's order for a dot after the names. */
export const TOPBAR_IDS: ReadonlyArray<string> = [
  'leaveBtn',
  'handoffBtn',
  'myName',
  'oppName',
  'oppDot',
  'rulesBtnGame',
  'historyBtn',
  'soundBtn',
];

/** An icon button: its id, its title (the label too), its glyph, any extra classes or attributes. */
const iconBtn = (id: string, title: string, glyph: string, extra = ''): string =>
  `<button class="icon-btn${extra}" id="${id}" title="${title}" aria-label="${title}">${glyph}</button>`;

const DOT = '<span class="conn-dot" id="oppDot"></span>';

/** The topbar's markup, every line prefixed with `indent`. */
export const topbarHtml = ({ dot, between, titles, indent = '' }: TopbarMarkup): string => {
  const t = { ...TOPBAR_TITLES, ...titles };
  return [
    '<div class="topbar">',
    '  <div class="row tight">',
    `    ${iconBtn('leaveBtn', t.leave, '✕')}`,
    `    ${iconBtn('handoffBtn', 'Continue online', '🌐', ' hidden')}`,
    '  </div>',
    '  <div class="names-strip">',
    '    <span id="myName">You</span>',
    ...(between === undefined ? [] : [`    ${between}`]),
    ...(dot === 'between' ? [`    ${DOT}`] : []),
    '    <span id="oppName">Opponent</span>',
    ...(dot === 'last' ? [`    ${DOT}`] : []),
    '  </div>',
    '  <div class="row tight">',
    `    ${iconBtn('rulesBtnGame', 'Rules', '📖')}`,
    `    ${iconBtn('historyBtn', t.history, '📜')}`,
    `    <button class="icon-btn" id="soundBtn" title="Sound &amp; vibration" aria-label="Sound" aria-pressed="true">🔊</button>`,
    '  </div>',
    '</div>',
  ]
    .map((line) => `${indent}${line}`)
    .join('\n');
};
