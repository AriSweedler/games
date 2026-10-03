// The renderer's mechanics over tiny partials (docs/design/dry-round-2.md row G2): a slot fills
// inline, a block line becomes its block or nothing, a block is verbatim, the inner partials lose
// their file's final newline and page.html keeps its own, and every way a page and the partials can
// disagree is an Err that names the place. The real partials and pages are pinned to the committed
// files by test/dist/shell-markup.test.ts.
import { describe, expect, test } from 'vitest';

import { GUEST_SEAT_NAME, seatListHtml } from './page.ts';
import {
  BLOCK_IDS,
  GATE_IDS,
  RESULT_IDS,
  PARTIALS,
  SCREEN_IDS,
  SHELL_COPY,
  bodyAttrsOf,
  endgamePlaceholder,
  gateMarkup,
  idsIn,
  resultMarkup,
  renderShell,
  type ShellBlocks,
  type ShellCopy,
  type ShellLook,
  type ShellNotes,
  type ShellPage,
  type ShellTemplates,
} from './shell.ts';

const copy: ShellCopy = {
  modeOnline: 'Online',
  modeLocal: 'Local',
  hostLabel: 'Host',
  joinLabel: 'Join',
  joinBtnLabel: 'Go',
  localBtnLabel: 'Start',
  localNote: 'note',
  hostWaitTitle: 'Wait',
  hostWaitSubtitle: 'Bring a friend',
  openingMsg: 'Opening',
  keepOpenNote: 'keep',
  startLabel: 'Deal',
  curtainSub: 'sub',
  revealLabel: 'Show',
  rulesTitle: 'Rules',
  historyTitle: 'History',
};
const notes: ShellNotes = {
  homeNote: ' (home)',
  rulesTabNote: ': rules',
  glossaryDoc: 'g.md',
  aboutClose: '<!-- /about -->',
  curtainNote: ' (curtain)',
};
const look: ShellLook = {
  resumeClass: ' resume',
  resumeStyle: '',
  resumeBtnKind: 'btn-gold',
  onlineActive: ' active',
  mt8: ' style="margin-top:8px;"',
  mt10: '',
  mt14: '',
  mb8: '',
  pt10: '',
  m0: '',
  noteLeft: 'class="empty-note left"',
  centeredBox: 'class="card-box centered"',
  pulseMuted: 'class="pulse muted"',
  joinBtnWidth: '',
  curtainClass: '',
  curtainStyle: '',
  curtainSheet: 'class="sheet"',
  betweenRow: 'class="row"',
  historyClass: '',
  toastAttrs: ' role="status"',
};
const blocks: ShellBlocks = {
  head: '<head></head>',
  masthead: '  <h1>Game</h1>',
  submenuExtra: '',
  extraTabs: '',
  switchExtra: '',
  hostFields: '  <button id="hostBtn">{{hostLabel}}</button>',
  localFields: '  <input id="p1NameInput">\n  <input id="p2NameInput">',
  playExtra: '',
  homeExtra: '',
  hostWaitList: '',
  guestWaitList: '',
  guestSeatName: '',
  extraPanels: '',
  extraScreens: '',
  table:
    '  <div id="tableScreen"><button id="leaveBtn"></button><button id="soundBtn"></button><button id="handoffBtn"></button><button id="rulesBtnGame"></button><button id="historyBtn"></button></div>',
  endgame: '  <div id="endgameScreen"></div>',
  curtainIcon: '',
  result: '',
  sheetsBefore: '\n<div id="own"></div>',
  sheetsAfter: '',
  rulesIcon: '',
};
const page: ShellPage = { copy, notes, look, blocks };

const slotNames = Object.keys({ ...copy, ...notes, ...look });
const blockNames = Object.keys(blocks);

/** Partials that read every value once: the blocks as block lines, the slots inline in home. */
const templates: ShellTemplates = {
  page: [
    '{{head}}',
    '<body{{bodyAttrs}}>',
    '{{home}}',
    '{{waiting}}',
    '{{curtain}}',
    '{{sheets}}',
    '{{toast}}',
    '</body>',
    '',
  ].join('\n'),
  home: [
    '<!-- HOME{{homeNote}} -->',
    ...blockNames.map((name) => `{{${name}}}`),
    ...slotNames.filter((name) => name !== 'homeNote').map((name) => `<i>{{${name}}}</i>`),
    '',
  ].join('\n'),
  waiting: '<div id="hostWaitScreen"></div>\n',
  curtain: '<div id="curtainOverlay"></div>\n',
  sheets: '{{pause}}\n<div id="rulesOverlay"></div>\n',
  toast: '<div id="toast"></div>\n',
  pause: '<!-- P -->\n<div id="pauseOverlay"></div>\n\n<b></b>\n',
};

const rendered = renderShell(templates, page);

describe('renderShell', () => {
  test('the seven partials are named, page.html first, the opt-in pause last', () => {
    expect(PARTIALS).toEqual(['page', 'home', 'waiting', 'curtain', 'sheets', 'toast', 'pause']);
  });

  test('the pause partial is placed, indented as a block with a blank line after it, only for a page that opts in (ShellPage.pause)', () => {
    expect(rendered.ok && rendered.value.includes('pauseOverlay')).toBe(false);
    const paused = renderShell(templates, { ...page, pause: true });
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(paused.value).toContain(
      '    <!-- P -->\n    <div id="pauseOverlay"></div>\n\n    <b></b>\n\n<div id="rulesOverlay"></div>',
    );
  });

  test('slots fill inline, a block line becomes its block, an empty block drops its line', () => {
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const lines = rendered.value.split('\n');
    expect(lines[0]).toBe('<head></head>');
    expect(lines[1]).toBe('<body>');
    expect(lines[2]).toBe('<!-- HOME (home) -->');
    // The blocks in declaration order, the empty ones gone, each verbatim (the placeholder inside
    // hostFields is not filled, and sheetsBefore keeps the blank line it begins with).
    expect(lines.slice(3, 11)).toEqual([
      '<head></head>',
      '  <h1>Game</h1>',
      '  <button id="hostBtn">{{hostLabel}}</button>',
      '  <input id="p1NameInput">',
      '  <input id="p2NameInput">',
      blocks.table,
      '  <div id="endgameScreen"></div>',
      '',
    ]);
    expect(lines[11]).toBe('<div id="own"></div>');
    expect(lines[12]).toBe('<i>Online</i>');
    expect(rendered.value).toContain('<i>btn-gold</i>');
    expect(rendered.value).toContain('<i> style="margin-top:8px;"</i>');
    expect(rendered.value).toContain('<i></i>');
  });

  test('an extension slot a page leaves out composes as if it had spelled it empty; set, homeExtra follows playExtra', () => {
    const {
      submenuExtra,
      extraTabs,
      switchExtra,
      playExtra,
      homeExtra,
      hostWaitList,
      guestWaitList,
      guestSeatName,
      extraPanels,
      extraScreens,
      curtainIcon,
      result,
      sheetsAfter,
      rulesIcon,
      ...spelled
    } = blocks;
    expect([
      submenuExtra,
      extraTabs,
      switchExtra,
      playExtra,
      homeExtra,
      hostWaitList,
      guestWaitList,
      guestSeatName,
      extraPanels,
      extraScreens,
      curtainIcon,
      result,
      sheetsAfter,
      rulesIcon,
    ]).toEqual(Array.from({ length: 14 }, () => ''));
    expect(Object.keys(spelled).sort()).toEqual([
      'endgame',
      'head',
      'hostFields',
      'localFields',
      'masthead',
      'sheetsBefore',
      'table',
    ]);
    expect(renderShell(templates, { ...page, blocks: spelled })).toEqual(rendered);
    const extra = renderShell(templates, {
      ...page,
      blocks: { ...blocks, playExtra: '  <p></p>', homeExtra: '  <div id="homeRecent"></div>' },
    });
    expect(extra.ok).toBe(true);
    if (!extra.ok) return;
    expect(extra.value).toContain('  <p></p>\n  <div id="homeRecent"></div>\n');
  });

  test('the endgame left out is the placeholder screen, saying the game ends on the result sheet over the table', () => {
    const { endgame, ...noEndgame } = blocks;
    expect(endgame).toBe('  <div id="endgameScreen"></div>');
    const placeholder = renderShell(templates, { ...page, blocks: noEndgame });
    expect(placeholder.ok).toBe(true);
    if (!placeholder.ok) return;
    expect(placeholder.value).toContain(
      endgamePlaceholder('the game ends on the result sheet over the table.'),
    );
    expect(placeholder.value).not.toContain(endgame);
    // The placeholder is a block like any other: the leave button it lacks must be the table's.
    const withoutLeave = renderShell(templates, {
      ...page,
      blocks: { ...noEndgame, table: blocks.table.replace('<button id="leaveBtn"></button>', '') },
    });
    expect(withoutLeave).toEqual({
      ok: false,
      error: 'the table and endgame blocks must carry id="leaveBtn" exactly once between them',
    });
  });

  test('the copy a page does not spell is SHELL_COPY; what it spells wins', () => {
    const { localNote, startLabel, revealLabel, historyTitle } = copy;
    const own = renderShell(templates, {
      ...page,
      copy: { localNote, startLabel, revealLabel, historyTitle, modeLocal: 'Pass the phone' },
    });
    expect(own.ok).toBe(true);
    if (!own.ok) return;
    expect(own.value).toContain('<i>Pass the phone</i>');
    expect(own.value).toContain(`<i>${SHELL_COPY.joinLabel}</i>`);
    expect(own.value).toContain(`<i>${SHELL_COPY.keepOpenNote}</i>`);
    expect(own.value).toContain('<i>note</i>');
    expect(own.value).not.toContain('<i>Local</i>');
    expect(own.value).not.toContain('<i>sub</i>');
    expect(SHELL_COPY).toEqual({
      modeOnline: 'Online',
      modeLocal: 'Pass the phone',
      hostLabel: 'Open a table',
      joinLabel: 'Sit down at a table',
      joinBtnLabel: 'Sit down',
      localBtnLabel: 'Start',
      hostWaitTitle: 'Your table',
      hostWaitSubtitle: 'Have the others open this same page and enter the code',
      openingMsg: 'Opening the table…',
      keepOpenNote:
        'Keep this screen open while the others sit down. If you switch apps, come straight back and the table reconnects on its own.',
      curtainSub: '',
      rulesTitle: 'Rules',
    });
  });

  test('a seated page gets the two seat lists and the guest name card from the shell; one it spells itself is an Err', () => {
    const { hostWaitList, guestWaitList, guestSeatName, ...bare } = blocks;
    expect([hostWaitList, guestWaitList, guestSeatName]).toEqual(['', '', '']);
    const seated = renderShell(templates, { ...page, blocks: bare, seated: true });
    expect(seated.ok).toBe(true);
    if (!seated.ok) return;
    expect(seated.value).toContain(
      `${seatListHtml('seatList')}\n${seatListHtml('guestSeatList')}\n${GUEST_SEAT_NAME}\n`,
    );
    expect(seated.value.split('\n').filter((line) => line.includes('class="seat-list"'))).toEqual([
      '      <ul class="seat-list" id="seatList" aria-label="Seats"></ul>',
      '      <ul class="seat-list" id="guestSeatList" aria-label="Seats"></ul>',
    ]);
    expect(renderShell(templates, { ...page, blocks, seated: true })).toEqual({
      ok: false,
      error: [
        'the page is seated: the shell spells its "hostWaitList" block',
        'the page is seated: the shell spells its "guestWaitList" block',
        'the page is seated: the shell spells its "guestSeatName" block',
      ].join('\n'),
    });
  });

  test('endgamePlaceholder: the hidden fifth screen under a comment wrapped at 100 columns as the pages wrote it', () => {
    // Flip 7's, uno's and hive's words, as their pages had them line for line.
    expect(
      endgamePlaceholder('the game ends on the result panel over the table, with Play again.'),
    ).toBe(
      [
        "      <!-- ENDGAME: the shell's fifth screen, which this page never shows: the game ends on the",
        '           result panel over the table, with Play again. -->',
        '      <div id="endgameScreen" class="hidden">',
        '        <h1>Game over</h1>',
        '      </div>',
      ].join('\n'),
    );
    expect(
      endgamePlaceholder('a round and the game end on the result sheet over the table.')
        .split('\n')
        .slice(0, 2),
    ).toEqual([
      "      <!-- ENDGAME: the shell's fifth screen, which this page never shows: a round and the game end",
      '           on the result sheet over the table. -->',
    ]);
    const short = endgamePlaceholder('elsewhere.');
    expect(short.split('\n')[0]).toBe(
      "      <!-- ENDGAME: the shell's fifth screen, which this page never shows: elsewhere. -->",
    );
    expect(short.split('\n').every((line) => line.length <= 100)).toBe(true);
    expect(idsIn(short)).toEqual(['endgameScreen']);
  });

  test("the inner partials lose their file's final newline; page.html keeps its own", () => {
    if (!rendered.ok) return;
    expect(rendered.value).toContain(
      '<div id="hostWaitScreen"></div>\n<div id="curtainOverlay"></div>\n<div id="rulesOverlay"></div>\n<div id="toast"></div>\n</body>\n',
    );
    expect(rendered.value.endsWith('</body>\n')).toBe(true);
    expect(rendered.value.endsWith('</body>\n\n')).toBe(false);
  });

  test('a placeholder no page value fills is an Err naming the partial and the line', () => {
    const missing = renderShell(
      { ...templates, toast: '<div id="toast"{{toastAttrs}}{{nope}}></div>\n{{never}}\n' },
      page,
    );
    expect(missing).toEqual({
      ok: false,
      error: ['toast.html:1: no slot named "nope"', 'toast.html:2: no block named "never"'].join(
        '\n',
      ),
    });
  });

  test('a value no partial reads is an Err naming it', () => {
    const home = templates.home
      .replace('<i>{{historyTitle}}</i>\n', '')
      .replace('{{rulesIcon}}\n', '');
    expect(renderShell({ ...templates, home }, page)).toEqual({
      ok: false,
      error: [
        '"historyTitle" is declared by the page but no partial reads it',
        '"rulesIcon" is declared by the page but no partial reads it',
      ].join('\n'),
    });
  });

  test('the blocks that place shell ids must carry each exactly once', () => {
    expect(BLOCK_IDS).toEqual({
      hostFields: ['hostBtn'],
      localFields: ['p1NameInput', 'p2NameInput'],
      table: ['tableScreen', 'soundBtn', 'handoffBtn', 'rulesBtnGame', 'historyBtn'],
      endgame: ['endgameScreen'],
    });
    expect(SCREEN_IDS).toEqual(['leaveBtn']);
    const wrong: ShellPage = {
      ...page,
      blocks: {
        ...blocks,
        hostFields: '<button></button>',
        localFields: '<input id="p1NameInput"><input id="p1NameInput">',
        // The sound button missing, and a second leave button on the endgame screen.
        table: blocks.table.replace('<button id="soundBtn"></button>', ''),
        endgame: '<div id="endgameScreen"><button id="leaveBtn"></button></div>',
      },
    };
    expect(renderShell(templates, wrong)).toEqual({
      ok: false,
      error: [
        'the hostFields block must carry id="hostBtn" exactly once',
        'the localFields block must carry id="p1NameInput" exactly once',
        'the localFields block must carry id="p2NameInput" exactly once',
        'the table block must carry id="soundBtn" exactly once',
        'the table and endgame blocks must carry id="leaveBtn" exactly once between them',
      ].join('\n'),
    });
  });
});

describe('idsIn', () => {
  test('every id attribute, in order, repeats included; a data-id is not one', () => {
    expect(idsIn('<a id="x"><b id="y" data-id="z"></b><c id="x"></c>')).toEqual(['x', 'y', 'x']);
    expect(idsIn('<p class="id"></p>')).toEqual([]);
  });
});

describe('playing sideways (docs/design/shared-shell.md "Playing sideways")', () => {
  test('bodyAttrsOf: an upright page spells nothing on the body, so its composed bytes are what they were; a page that plays sideways carries data-plays', () => {
    expect(bodyAttrsOf({})).toBe('');
    expect(bodyAttrsOf({ plays: 'landscape' })).toBe(' data-plays="landscape"');
    // The screen frame's opt-in (docs/design/screen-frame.md): backgammon's body carries both.
    expect(bodyAttrsOf({ frame: true })).toBe(' data-frame');
    expect(bodyAttrsOf({ plays: 'landscape', frame: true })).toBe(
      ' data-plays="landscape" data-frame',
    );
    expect(rendered.ok && rendered.value.split('\n')[1]).toBe('<body>');
    const sideways = renderShell(templates, { ...page, plays: 'landscape' });
    expect(sideways.ok && sideways.value.split('\n')[1]).toBe('<body data-plays="landscape">');
  });

  test('a page that plays sideways over a page.html without the body slot is an Err naming it; an upright page over the same skeleton is fine', () => {
    const noSlot: ShellTemplates = {
      ...templates,
      page: templates.page.replace('{{bodyAttrs}}', ''),
    };
    expect(renderShell(noSlot, page).ok).toBe(true);
    expect(renderShell(noSlot, { ...page, plays: 'landscape' })).toEqual({
      ok: false,
      error: 'the page plays landscape but no partial places {{bodyAttrs}} on the body',
    });
  });

  test('gateMarkup: the gate block with its five ids in order (GATE_IDS, none a block id), the copy in its four places, Go sideways shipped hidden', () => {
    const markup = gateMarkup({
      title: 'Turn it',
      sub: 'The board lies flat.',
      goLabel: 'Go',
      keepLabel: 'Keep',
    });
    expect(idsIn(markup)).toEqual([...GATE_IDS]);
    expect(GATE_IDS).toEqual([
      'turnGate',
      'turnGateTitle',
      'turnGateSub',
      'turnGateGoBtn',
      'turnGateKeepBtn',
    ]);
    // None is a shell id: test/dist/shell-ids.test.ts pins SHELL_IDS to the partials' ids and BLOCK_IDS.
    expect(GATE_IDS.some((id) => Object.values(BLOCK_IDS).flat().includes(id))).toBe(false);
    expect(markup).toContain('<div class="sheet-title" id="turnGateTitle">Turn it</div>');
    expect(markup).toContain('<div class="sheet-sub" id="turnGateSub">The board lies flat.</div>');
    expect(markup).toContain(
      '<button class="btn btn-go btn-block hidden" id="turnGateGoBtn">Go</button>',
    );
    expect(markup).toContain('id="turnGateKeepBtn">Keep</button>');
    expect(markup).toContain('class="overlay hidden"');
    expect(markup).toContain('role="dialog"');
    // A block: it starts on its own line and is indented as page.html's blocks are.
    expect(markup.startsWith('\n    <!-- TURN GATE')).toBe(true);
  });

  test('resultMarkup: the result block with its ids in order (RESULT_IDS, then the buttons the game binds; none a block id), the line, Continue and the primary only when asked, the score element per shape', () => {
    const sheet = {
      note: 'the end.',
      score: 'list',
      primary: { id: 'rsAgainBtn', label: 'Play again' },
      secondary: { id: 'rsLeaveBtn', label: 'Leave the table' },
    } as const;
    const plain = resultMarkup(sheet);
    expect(idsIn(plain)).toEqual([
      'resultOverlay',
      'rsTitle',
      'rsScore',
      'rsAgainBtn',
      'rsLeaveBtn',
    ]);
    expect(plain).toContain('<!-- RESULT: the end. -->');
    expect(plain).toContain('<div class="sheet-title" id="rsTitle">Game over</div>');
    expect(plain).toContain('<div class="score-list" id="rsScore"></div>');
    expect(plain).toContain(
      '<button class="btn btn-go btn-block" id="rsAgainBtn">Play again</button>',
    );
    expect(plain).toContain(
      '<button class="btn btn-ghost btn-block btn-sm" id="rsLeaveBtn">Leave the table</button>',
    );
    expect(plain).not.toContain('rsSub');
    expect(plain).not.toContain('rsContinueBtn');
    const full = resultMarkup({ ...sheet, sub: true, score: 'line', continueBtn: true });
    expect(idsIn(full)).toEqual([...RESULT_IDS, 'rsContinueBtn', 'rsAgainBtn', 'rsLeaveBtn']);
    expect(full).toContain('<div class="sheet-sub" id="rsSub"></div>');
    expect(full).toContain('<div class="score-line" id="rsScore"></div>');
    expect(full).toContain(
      '<button class="btn btn-secondary btn-block" id="rsContinueBtn">Continue</button>',
    );
    const note = resultMarkup({
      note: sheet.note,
      score: 'note',
      continueBtn: true,
      secondary: sheet.secondary,
    });
    expect(note).toContain('<p class="result-note" id="rsScore"></p>');
    expect(idsIn(note)).toEqual([
      'resultOverlay',
      'rsTitle',
      'rsScore',
      'rsContinueBtn',
      'rsLeaveBtn',
    ]);
    expect(note).not.toContain('btn-go');
    // None is a shell id: a page without the sheet carries none (test/dist/shell-ids.test.ts).
    expect(RESULT_IDS.some((id) => Object.values(BLOCK_IDS).flat().includes(id))).toBe(false);
    // A block: indented as page.html's blocks are, a blank line after it before the rules sheet.
    expect(plain.startsWith('    <!-- RESULT')).toBe(true);
    expect(plain.endsWith('    </div>\n')).toBe(true);
  });
});
