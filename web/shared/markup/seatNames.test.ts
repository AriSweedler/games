// The seat-name grid: one input per seat up to `max`, the shell's two shown, the rest hidden, the
// ids the binder and the painter look up (web/shared/ui/seatNames.ts), every line indented.
import { describe, expect, test } from 'vitest';

import { idsIn } from './shell.ts';
import { extraSeats, seatNameInputId, seatNamesHtml } from './seatNames.ts';

describe('seatNamesHtml', () => {
  test('twelve seats: the grid, p1 to p12 in order, the first two shown and the rest hidden', () => {
    const html = seatNamesHtml({ max: 12 });
    expect(idsIn(html)).toEqual([
      'seatNames',
      ...Array.from({ length: 12 }, (_, i) => seatNameInputId(i)),
    ]);
    expect(html).toContain('<div class="seat-names" id="seatNames">');
    expect(html).toContain(
      '<input type="text" id="p1NameInput" class="grow" placeholder="Player 1" maxlength="20" autocomplete="off" />',
    );
    expect(html).toContain(
      '<input type="text" id="p3NameInput" class="grow hidden" placeholder="Player 3" maxlength="20" autocomplete="off" />',
    );
    expect(html.match(/class="grow"/g)).toHaveLength(2);
    expect(html.match(/class="grow hidden"/g)).toHaveLength(10);
  });

  test('the indent prefixes every line; two seats hide nothing', () => {
    const html = seatNamesHtml({ max: 2, indent: '    ' });
    expect(html.split('\n').every((line) => line.startsWith('    '))).toBe(true);
    expect(html.split('\n')).toHaveLength(4);
    expect(html).not.toContain('hidden');
  });

  test('extraSeats: the seats past the second, none at two', () => {
    expect(extraSeats(4)).toEqual([2, 3]);
    expect(extraSeats(2)).toEqual([]);
    expect(extraSeats(1)).toEqual([]);
  });
});
