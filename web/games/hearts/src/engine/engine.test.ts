// The placeholder engine (docs/design/hearts.md §2): positions by hand, and whole bot games at the
// seat count with the counts checked at every step (AGENT.md "A new game" step 2). Replace the
// cases as the rules land; keep the bot game.
import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { MAX_TURNS, apply, legalIntents, newGame, other, type Game } from './engine.ts';

const NAMES = ['Ann', 'Bob'] as const;

/** Every seat passes until the game ends; each step is checked. */
const botGame = (seed: number): Game =>
  Array.from({ length: MAX_TURNS }).reduce<Game>((game, _, i) => {
    expect(game.result).toBeNull();
    expect(game.turn).toBe(i % 2);
    expect(game.turns).toBe(i);
    expect(legalIntents(game)).toEqual([{ type: 'pass' }, { type: 'resign' }]);
    const next = apply(game, { type: 'pass' }, mulberry32(seed));
    if (!next.ok) throw new Error(next.error);
    expect(next.value.turn).toBe(other(game.turn));
    expect(next.value.turns).toBe(i + 1);
    return next.value;
  }, newGame(NAMES));

describe('Hearts: the placeholder engine', () => {
  test('a fresh game: seat 0 to play, nothing decided', () => {
    const game = newGame(NAMES);
    expect(game).toMatchObject({ turn: 0, turns: 0, result: null });
    expect(game.note).toBe('Ann to play.');
  });

  test('a pass hands the turn over and says so', () => {
    const next = apply(newGame(NAMES), { type: 'pass' }, mulberry32(1));
    if (!next.ok) throw new Error(next.error);
    expect(next.value).toMatchObject({ turn: 1, turns: 1, result: null });
    expect(next.value.note).toBe('Ann passed. Bob to play.');
  });

  test('a resign ends the game for the other seat; nothing is legal after', () => {
    const over = apply(newGame(NAMES), { type: 'resign' }, mulberry32(1));
    if (!over.ok) throw new Error(over.error);
    expect(over.value.result).toEqual({ kind: 'win', winner: 1, by: 'resign' });
    expect(legalIntents(over.value)).toEqual([]);
    expect(apply(over.value, { type: 'pass' }, mulberry32(1))).toEqual({
      ok: false,
      error: 'The game is over.',
    });
  });

  test('a bot game at two seats: MAX_TURNS passes end on the seeded draw, the same for the same seed', () => {
    const a = botGame(7);
    const b = botGame(7);
    expect(a.result?.kind).toBe('win');
    expect(a.result).toMatchObject({ by: 'luck' });
    expect(a).toEqual(b);
    expect(a.turns).toBe(MAX_TURNS);
    expect(legalIntents(a)).toEqual([]);
  });
});
