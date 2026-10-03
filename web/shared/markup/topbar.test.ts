// The table's topbar: the shell's five buttons around the names strip, the dot where the page puts
// it, the page's own markup between the names, the two titles it may rename, every line indented.
import { describe, expect, test } from 'vitest';

import { idsIn } from './shell.ts';
import { TOPBAR_IDS, topbarHtml } from './topbar.ts';

describe('topbarHtml', () => {
  test('the dot last: the eight ids in order, the shell titles, nothing between the names', () => {
    const html = topbarHtml({ dot: 'last' });
    expect(idsIn(html)).toEqual(TOPBAR_IDS);
    expect(html).toContain(
      '<button class="icon-btn" id="leaveBtn" title="Leave the table" aria-label="Leave the table">✕</button>',
    );
    expect(html).toContain(
      '<button class="icon-btn hidden" id="handoffBtn" title="Continue online" aria-label="Continue online">🌐</button>',
    );
    expect(html).toContain(
      '<button class="icon-btn" id="historyBtn" title="History" aria-label="History">📜</button>',
    );
    expect(html).toContain('aria-pressed="true">🔊</button>');
    expect(html.split('\n')).toHaveLength(16);
  });

  test('the dot between: #oppDot before #oppName', () => {
    const ids = idsIn(topbarHtml({ dot: 'between' }));
    expect(ids.indexOf('oppDot')).toBe(ids.indexOf('myName') + 1);
    expect(ids.indexOf('oppName')).toBe(ids.indexOf('oppDot') + 1);
  });

  test('the page’s line between the names comes right after #myName, before the dot', () => {
    const html = topbarHtml({ dot: 'last', between: '<span class="vs">vs</span>', indent: '  ' });
    const lines = html.split('\n');
    const my = lines.findIndex((l) => l.includes('id="myName"'));
    expect(lines[my + 1]).toBe('      <span class="vs">vs</span>');
    expect(lines[my + 2]).toContain('id="oppName"');
    expect(lines.every((l) => l.startsWith('  '))).toBe(true);
  });

  test('the titles a page renames replace the shell’s, the rest stay', () => {
    const html = topbarHtml({
      dot: 'between',
      titles: { leave: 'Leave', history: 'Recent games' },
    });
    expect(html).toContain('id="leaveBtn" title="Leave" aria-label="Leave"');
    expect(html).toContain('id="historyBtn" title="Recent games" aria-label="Recent games"');
    expect(html).toContain('id="rulesBtnGame" title="Rules" aria-label="Rules"');
  });
});
