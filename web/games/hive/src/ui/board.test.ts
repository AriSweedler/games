import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { apply, legalTurns, mustPass, newGame, type Game } from '../engine/engine.ts';
import { ORIGIN, dedupe, neighbours, ring, type Hex } from '../engine/hex.ts';
import { cellsOf, fitCells, viewBoxOf } from './board.ts';

const NAMES = { white: 'Ann', black: 'Bob' } as const;

/** Where the turns on offer land: every placement's and every move's hex. */
const destinations = (game: Game): ReadonlyArray<Hex> => legalTurns(game).map((t) => t.to);

/** `turns` turns of a seeded game, each the rng's pick of the legal ones (a pass where there is none), as every position. */
const positions = (seed: number, turns: number): ReadonlyArray<Game> =>
  Array.from({ length: turns }).reduce<ReadonlyArray<Game>>(
    (acc) => {
      const game = acc.at(-1) ?? newGame(NAMES);
      if (game.result !== null) return acc;
      const rng = mulberry32(seed + acc.length);
      const turnsOn = legalTurns(game);
      const pick = turnsOn[Math.floor(rng() * turnsOn.length)];
      const next =
        pick === undefined
          ? mustPass(game)
            ? apply(game, { type: 'pass' })
            : game
          : apply(game, pick);
      return [...acc, next];
    },
    [newGame(NAMES)],
  );

describe('the fit of the board', () => {
  test('an empty board fits the origin and its ring', () => {
    expect(fitCells({})).toHaveLength(7);
    expect(viewBoxOf(fitCells({}))).toEqual(viewBoxOf([ORIGIN, ...ring(ORIGIN, 1)]));
  });

  test('the fit of a hive equals the fit of the same hive plus its ring', () => {
    positions(11, 40).forEach((game) => {
      const fit = fitCells(game.board);
      const withRing = dedupe([...fit, ...fit.flatMap(neighbours)]);
      // The ring is already in the fit: adding every neighbour of an occupied hex changes nothing.
      const occupiedRing = dedupe(
        Object.keys(game.board)
          .map((k) => {
            const [q = 0, r = 0] = k.split(',').map(Number);
            return { q, r };
          })
          .flatMap(neighbours),
      );
      expect(viewBoxOf(dedupe([...fit, ...occupiedRing]))).toEqual(viewBoxOf(fit));
      // And the ring is the fit's edge: one more ring out is a wider box.
      expect(viewBoxOf(withRing)).not.toEqual(viewBoxOf(fit));
    });
  });

  test('picking never moves the board: every legal destination is inside the fit, through three seeded games', () => {
    [3, 7, 19].forEach((seed) => {
      positions(seed, 60).forEach((game) => {
        const fit = fitCells(game.board);
        const lit = destinations(game);
        // The cells drawn with the pick lit sit inside the fit, so the viewBox is the same box.
        expect(viewBoxOf(dedupe([...fit, ...cellsOf(game.board, lit)]))).toEqual(viewBoxOf(fit));
        // The same hexes, read directly: each destination is a fit cell.
        const keys = new Set(fit.map((h) => `${String(h.q)},${String(h.r)}`));
        lit.forEach((h) => {
          expect(keys.has(`${String(h.q)},${String(h.r)}`)).toBe(true);
        });
      });
    });
  });
});
