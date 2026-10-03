import { describe, expect, test } from 'vitest';

import { apply, newGame, spiderPaths, type Game } from '../engine/engine.ts';
import { keyOf, type Hex } from '../engine/hex.ts';
import type { Bug } from '../engine/pieces.ts';
import { viewFor, type View } from '../engine/view.ts';
import { HEX_H, HEX_W, centerOf, type Hop } from './board.ts';
import { TILE_VIEWBOX, boardHtml, cellHtml, liftHtml, stepsOf } from './render.ts';
import type { Picked } from './state.ts';

const h = (q: number, r: number): Hex => ({ q, r });

/** Four placements: both Queens down, White's Spider a leaf at (-1,0), White to move. */
const PLACED: ReadonlyArray<readonly [Bug, Hex]> = [
  ['queen', h(0, 0)],
  ['queen', h(1, 0)],
  ['spider', h(-1, 0)],
  ['ant', h(2, 0)],
];
const game: Game = PLACED.reduce(
  (g, [bug, to]) => apply(g, { type: 'place', bug, to }),
  newGame({ white: 'Ann', black: 'Bob' }),
);
const SPIDER = h(-1, 0);
const view: View = viewFor({ game, startedAt: 1 }, 0);
const paths = spiderPaths(game, SPIDER);
const [toKey, path] = [...paths.entries()][0] ?? ['', []];
const to: Hex =
  view.movable
    .find((m) => m.from.q === SPIDER.q && m.from.r === SPIDER.r)
    ?.to.find((x) => keyOf(x) === toKey) ?? h(0, 0);
const spiderPicked: Picked = { kind: 'hex', hex: SPIDER };

/** The `g.hex` chunk of `markup` carrying `data-hex="<key>"` (the bug's own groups nest inside it), or '' when the cell is not drawn. */
const cellOf = (markup: string, key: string): string => {
  const chunk = markup.split('<g class="hex').find((c) => c.includes(`data-hex="${key}"`));
  return chunk === undefined ? '' : `<g class="hex${chunk}`;
};
const numerals = (markup: string): number => markup.split('class="step"').length - 1;

describe("the Spider's 1-2-3 on a pick", () => {
  test('the position has a Spider with paths of three hexes to aim at', () => {
    expect(game.turn).toBe('white');
    expect(paths.size).toBeGreaterThan(0);
    expect(path).toHaveLength(3);
    expect(keyOf(to)).toBe(toKey);
  });

  test('stepsOf numbers the picked Spider’s path to the aim 1, 2, 3; nothing without an aim, for another tile, or off the paths', () => {
    expect([...stepsOf(view, spiderPicked, to).entries()]).toEqual(
      path.map((x, i) => [keyOf(x), i + 1]),
    );
    expect(stepsOf(view, spiderPicked, null).size).toBe(0);
    expect(stepsOf(view, { kind: 'hex', hex: h(0, 0) }, to).size).toBe(0);
    expect(stepsOf(view, { kind: 'hand', bug: 'ant' }, to).size).toBe(0);
    expect(stepsOf(view, spiderPicked, h(9, 9)).size).toBe(0);
  });

  test('the board draws the numerals along the path: the way as trail cells (or lit ones), the aim lit; none with no aim', () => {
    const aimed = boardHtml(view, spiderPicked, null, to);
    expect(numerals(aimed)).toBe(3);
    path.forEach((x, i) => {
      const cell = cellOf(aimed, keyOf(x));
      expect(cell).toMatch(/\btrail\b|\blit\b/);
      expect(cell).toContain(`class="step"`);
      expect(cell).toContain(`>${String(i + 1)}</text>`);
      expect(cell).toContain(`step ${String(i + 1)} of the Spider’s path`);
    });
    expect(cellOf(aimed, keyOf(to))).toContain('lit');
    expect(cellOf(aimed, keyOf(to))).not.toContain('trail');
    // The way is drawn before the hive, so a hopping tile passes over it.
    const first = path[0] ?? to;
    expect(aimed.indexOf(`data-hex="${keyOf(first)}"`)).toBeLessThan(
      aimed.indexOf(`data-hex="${keyOf(SPIDER)}"`),
    );
    expect(numerals(boardHtml(view, spiderPicked))).toBe(0);
    expect(boardHtml(view, spiderPicked)).not.toContain('trail');
    expect(numerals(boardHtml(view, spiderPicked, null, null))).toBe(0);
  });
});

describe("the Spider's 1-2-3 as it moves", () => {
  const after = apply(game, { type: 'move', from: SPIDER, to });
  const landed: View = viewFor({ game: after, startedAt: 1 }, 1);
  const hop: Hop = { key: 'k', bug: 'spider', side: 'white', from: SPIDER, path, reduced: false };

  test('the move was taken', () => {
    expect(after.turn).toBe('black');
    expect(after.board[keyOf(to)]).toEqual([{ side: 'white', bug: 'spider' }]);
  });

  test('with a hop the path is numbered: trail cells for the way, drawn before the hive, and 3 on the tile itself', () => {
    const markup = boardHtml(landed, null, null, null, hop);
    expect(numerals(markup)).toBe(3);
    const [one, two] = path;
    if (one === undefined || two === undefined) throw new Error('a path of three');
    [one, two].forEach((x, i) => {
      const cell = cellOf(markup, keyOf(x));
      expect(cell).toContain('hex empty trail');
      expect(cell).toContain(`>${String(i + 1)}</text>`);
      expect(cell).toContain('A hex the Spider stepped on');
    });
    const tile = cellOf(markup, keyOf(to));
    expect(tile).toContain('hex w');
    expect(tile).not.toContain('trail');
    expect(tile).toContain('Ann’s Spider, step 3 of the Spider’s path');
    expect(tile).toContain('>3</text>');
    expect(markup.indexOf(`data-hex="${keyOf(one)}"`)).toBeLessThan(
      markup.indexOf(`data-hex="${keyOf(to)}"`),
    );
  });

  test('the same position without a hop draws neither trail nor numerals', () => {
    const markup = boardHtml(landed, null);
    expect(markup).not.toContain('trail');
    expect(numerals(markup)).toBe(0);
  });

  test('a cell’s numeral sits centred on an empty hex and in the upper left of a tile, clear of its bug', () => {
    const stepX = (markup: string): number =>
      Number(/class="step" x="([-\d.]+)"/.exec(markup)?.[1] ?? NaN);
    const empty = cellHtml(game, h(5, 5), true, false, 2);
    expect(stepX(empty)).toBeCloseTo(centerOf(h(5, 5)).x, 1);
    const tile = cellHtml(after, to, false, false, 3);
    expect(stepX(tile)).toBeLessThan(centerOf(to).x);
  });
});

describe('the lift over a dragged board tile', () => {
  test('a nested svg on the cell’s box, the tray tile’s viewBox, the face drawn about its origin and no svg.tile inside', () => {
    const c = centerOf(SPIDER);
    const markup = liftHtml(game, SPIDER);
    expect(markup.startsWith('<svg class="hex lift w"')).toBe(true);
    expect(markup).toContain(`x="${(c.x - HEX_W / 2).toFixed(2)}"`);
    expect(markup).toContain(`y="${(c.y - HEX_H / 2).toFixed(2)}"`);
    expect(markup).toContain(`width="${HEX_W.toFixed(2)}" height="${HEX_H.toFixed(2)}"`);
    expect(markup).toContain(`viewBox="${TILE_VIEWBOX}"`);
    // The face about (0, 0): a nested `svg.tile` would sit at this origin, the hex's centre, and
    // render half a hex off, clipped to a quarter (the ghost of PR #24).
    expect(markup).not.toContain('class="tile"');
    expect(markup.split('<svg').length - 1).toBe(1);
    expect(markup).toContain('<polygon class="face"');
    expect(markup).toContain('data-bug="spider"');
    expect(markup.endsWith('</svg>')).toBe(true);
  });

  test('an empty hex has no lift', () => {
    expect(liftHtml(game, h(5, 5))).toBe('');
  });
});
