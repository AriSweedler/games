import { describe, expect, test } from 'vitest';

import { BUGS } from '../engine/pieces.ts';
import { SIZE } from './board.ts';
import { BUG_FIT, LINE, RIM, bugHtml, symbolOf } from './engrave.ts';

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
  <!-- a note -->
  <g stroke-width="4.5">
    <circle cx="50" cy="50" r="10" />
    <line x1="0" y1="0" x2="1" y2="1" stroke-width="3.5" />
  </g>
</svg>`;

describe('the engraving', () => {
  test('a file becomes a symbol: the root attributes but stroke-width on a group, comments gone, a shape keeps its own width', () => {
    const symbol = symbolOf('ant', SAMPLE);
    expect(symbol.startsWith('<symbol id="bug-ant" viewBox="0 0 100 100"><g ')).toBe(true);
    expect(symbol).toContain(
      'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"',
    );
    expect(symbol).not.toContain('<!--');
    expect(symbol).not.toContain('stroke-width="6"');
    expect(symbol).not.toContain('stroke-width="4.5"');
    expect(symbol).toContain('stroke-width="3.5"');
    expect(symbol).not.toContain('<svg');
    expect(symbol).toContain('viewBox="0 0 100 100"');
  });

  test('every fit is one scale into the hex (a 100-box art at a fifth or less of a 20-unit hex), centred on the art’s axis', () => {
    BUGS.forEach((bug) => {
      const { cx, cy, scale } = BUG_FIT[bug];
      // The hex is 2 * SIZE tall; the tallest art (the Queen, 74 units) fills 84% of it at most.
      expect(scale).toBeGreaterThan(0.1);
      expect(scale).toBeLessThanOrEqual(0.22);
      expect(74 * scale).toBeLessThanOrEqual(2 * SIZE * 0.84);
      expect(cx).toBe(50);
      expect(cy).toBeGreaterThan(40);
      expect(cy).toBeLessThan(60);
    });
  });

  test('the drawn group: four layers of the one symbol, the line normalised to LINE tile units, the rim wider', () => {
    const html = bugHtml('spider', { x: 3, y: -4 });
    const { cx, cy, scale } = BUG_FIT.spider;
    expect(html).toContain('class="bug" data-bug="spider"');
    expect(html.split('href="#bug-spider"')).toHaveLength(5);
    expect(html).toContain(
      `translate(3 -4) scale(${String(scale)}) translate(${String(-cx)} ${String(-cy)})`,
    );
    const widths = [...html.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]) * scale);
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBeCloseTo(LINE, 2);
    expect(widths[1]).toBeCloseTo(LINE + 2 * RIM, 2);
    ['rim', 'shade', 'gleam', 'ink'].forEach((layer) => {
      expect(html).toContain(`class="${layer}"`);
    });
  });
});
