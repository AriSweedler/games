import { describe, expect, test } from 'vitest';

import { apply, newGame, spiderPaths, type Game } from '../engine/engine.ts';
import { keyOf, type Hex } from '../engine/hex.ts';
import type { Bug } from '../engine/pieces.ts';
import { viewFor, type View } from '../engine/view.ts';
import { HEX_H, HEX_W, centerOf, fitCells, viewBoxOf, type Hop } from './board.ts';
import {
  TILE_VIEWBOX,
  boardHtml,
  cellHtml,
  columnLabel,
  liftHtml,
  peekHtml,
  proposedGame,
  stepsOf,
} from './render.ts';
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

describe('the hints hidden: the free board and the proposal', () => {
  const cellCount = (markup: string): number => markup.split('<g class="hex').length - 1;

  test('with a pick nothing lights and the whole ring is drawn as plain cells, the viewBox the same', () => {
    const shown = boardHtml(view, spiderPicked);
    const free = boardHtml(view, spiderPicked, null, null, null, null, 'hide');
    expect(shown).toContain(' lit');
    expect(free).not.toContain(' lit');
    expect(free).not.toContain('proposed');
    // The hive (a line of four) and the twelve hexes beside it: more cells than the lit ones, every one tappable.
    expect(cellCount(free)).toBeGreaterThan(cellCount(shown));
    expect(cellCount(free)).toBe(4 + 12);
    expect(/viewBox="([^"]+)"/.exec(free)?.[1]).toBe(/viewBox="([^"]+)"/.exec(shown)?.[1]);
    expect(cellOf(free, keyOf(SPIDER))).toContain('picked');
    // Without a pick the board is the plain one, whatever the hints.
    expect(boardHtml(view, null, null, null, null, null, 'hide')).toBe(boardHtml(view, null));
  });

  test('a proposal draws the tile where it was put, marked `proposed`, over the board as it would be; the game itself is untouched', () => {
    const to = h(0, -1);
    const markup = boardHtml(view, spiderPicked, null, null, null, null, 'hide', to);
    const cell = cellOf(markup, keyOf(to));
    expect(cell).toContain('hex w');
    expect(cell).toContain('proposed');
    expect(cell).toContain('data-bug="spider"');
    expect(cell).toContain('proposed: Confirm to play it');
    expect(cellOf(markup, keyOf(SPIDER))).toContain('hex empty picked');
    const proposed = proposedGame(view, spiderPicked, to);
    expect(proposed.board[keyOf(to)]).toEqual([{ side: 'white', bug: 'spider' }]);
    expect(proposed.board[keyOf(SPIDER)]).toBeUndefined();
    expect(game.board[keyOf(SPIDER)]).toEqual([{ side: 'white', bug: 'spider' }]);
    // A hand tile proposed on a taken hex: drawn on top of it as a stack.
    const onQueen = proposedGame(view, { kind: 'hand', bug: 'beetle' }, h(0, 0));
    expect(onQueen.board['0,0']).toEqual([
      { side: 'white', bug: 'queen' },
      { side: 'white', bug: 'beetle' },
    ]);
    expect(
      cellOf(
        boardHtml(view, { kind: 'hand', bug: 'beetle' }, null, null, null, null, 'hide', h(0, 0)),
        '0,0',
      ),
    ).toContain('stack');
    expect(proposedGame(view, null, to)).toBe(game);
    expect(proposedGame(view, spiderPicked, null)).toBe(game);
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

describe('the peek at a stack', () => {
  /** Black's Beetle climbed onto White's Ant, which stands on the Queen: three tiles at the origin. */
  const stacked: Game = {
    ...game,
    board: {
      ...game.board,
      '0,0': [
        { side: 'white', bug: 'queen' },
        { side: 'white', bug: 'ant' },
        { side: 'black', bug: 'beetle' },
      ],
    },
  };
  const stackedView: View = viewFor({ game: stacked, startedAt: 1 }, 0);
  const label = '3 tiles: Beetle (Black) over Soldier Ant (White) over Queen Bee (White)';

  test('the column reads aloud top first', () => {
    expect(columnLabel(stacked.board['0,0'] ?? [])).not.toBe(label);
    expect(columnLabel([...(stacked.board['0,0'] ?? [])].reverse())).toBe(label);
  });

  test('a stacked cell’s badge is a focusable control named with the whole column; a single tile has none', () => {
    const cell = cellHtml(stacked, h(0, 0), false, false);
    expect(cell).toContain('class="hex b stack"');
    expect(cell).toContain(
      `<g class="stack-badge" role="button" tabindex="0" aria-label="${label}" aria-expanded="false">`,
    );
    expect(cell).toContain('<circle class="hit"');
    expect(cell).toContain('<text class="badge"');
    expect(cell).toContain('>3</text>');
    expect(cellHtml(stacked, h(0, 0), false, false, null, false, true)).toContain(
      'aria-expanded="true"',
    );
    expect(cellHtml(stacked, h(1, 0), false, false)).not.toContain('stack-badge');
  });

  test('the peek: the column as mini tiles top to bottom in the side’s class, the top marked, on a panel beside the hex', () => {
    const box = viewBoxOf(fitCells(stacked.board));
    const markup = peekHtml(stacked, h(0, 0), box);
    expect(
      markup.startsWith(`<g class="peek" role="group" aria-label="${label}" data-for="0,0">`),
    ).toBe(true);
    expect(markup).toContain('<rect class="peek-bg"');
    const tiles = markup.split('<g class="peek-tile').slice(1);
    expect(tiles).toHaveLength(3);
    expect(tiles[0]).toMatch(/^ b top"/);
    expect(tiles[0]).toContain('data-bug="beetle"');
    expect(tiles[1]).toMatch(/^ w"/);
    expect(tiles[1]).toContain('data-bug="ant"');
    expect(tiles[2]).toMatch(/^ w"/);
    expect(tiles[2]).toContain('data-bug="queen"');
    // Top to bottom: each tile lower than the one before.
    const ys = tiles.map((t) => Number(/translate\([-\d.]+ ([-\d.]+)\)/.exec(t)?.[1] ?? NaN));
    expect(ys[0]).toBeLessThan(ys[1] ?? NaN);
    expect(ys[1]).toBeLessThan(ys[2] ?? NaN);
    // Beside the hex, to its right, inside the frame.
    const rect =
      /<rect class="peek-bg" x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/.exec(
        markup,
      );
    const [x, y, w, hh] = (rect ?? []).slice(1).map(Number);
    if (x === undefined || y === undefined || w === undefined || hh === undefined)
      throw new Error('a panel with a box');
    expect(x).toBeGreaterThan(centerOf(h(0, 0)).x + HEX_W / 2);
    expect(x + w).toBeLessThanOrEqual(box.x + box.w);
    expect(y).toBeGreaterThanOrEqual(box.y);
    expect(y + hh).toBeLessThanOrEqual(box.y + box.h);
    expect(peekHtml(stacked, h(1, 0), box)).toBe('');
  });

  test('the board draws the peek last, over the hive, and marks its badge open; none without a peek', () => {
    const markup = boardHtml(stackedView, null, null, null, null, h(0, 0));
    expect(markup.split('<g class="peek"').length - 1).toBe(1);
    expect(markup.indexOf('<g class="peek"')).toBeGreaterThan(markup.lastIndexOf('<g class="hex'));
    expect(cellOf(markup, '0,0')).toContain('aria-expanded="true"');
    expect(markup.endsWith('</g></svg>')).toBe(true);
    const closed = boardHtml(stackedView, null);
    expect(closed).not.toContain('class="peek"');
    expect(cellOf(closed, '0,0')).toContain('aria-expanded="false"');
  });
});
