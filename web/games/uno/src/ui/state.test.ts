import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { makeDeck, type Cards } from '../engine/cards.ts';
import { playableIds, type Game } from '../engine/engine.ts';
import {
  DEFAULT_SEATS,
  MAX_SEATS,
  MIN_SEATS,
  gameOf,
  initialApp,
  nameOrDefault,
  reduce,
  type App,
} from './state.ts';

const rng = mulberry32(11);
const must = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) throw new Error('expected a value');
  return value;
};
const DECK = makeDeck();
const cards = (...ids: ReadonlyArray<string>): Cards =>
  ids.map((id) => must(DECK.find((c) => c.id === id)));

const table = (hands: ReadonlyArray<ReadonlyArray<string>>, top: string, turn = 0): App => {
  const topCard = must(DECK.find((c) => c.id === top));
  const game: Game = {
    names: hands.map((_, i) => `P${String(i + 1)}`),
    hands: hands.map((ids) => cards(...ids)),
    draw: cards('g5a', 'y9b', 'b2a'),
    discard: [topCard],
    color: topCard.color ?? 'red',
    turn,
    direction: 1,
    phase: { kind: 'turn' },
    scores: hands.map(() => 0),
    target: 500,
    round: 1,
    note: '',
  };
  return { kind: 'table', game };
};

describe('the setup', () => {
  test('seat bounds and names', () => {
    expect(MIN_SEATS).toBe(2);
    expect(MAX_SEATS).toBe(6);
    expect(DEFAULT_SEATS).toBe(2);
    expect(nameOrDefault('  Ari ', 0)).toBe('Ari');
    expect(nameOrDefault('   ', 2)).toBe('Player 3');
    expect(gameOf(initialApp)).toBeNull();
  });

  test('start deals and drops the curtain for the first seat; fewer than two seats stays put', () => {
    const app = reduce(initialApp, { type: 'start', names: ['Ari', ''] }, rng);
    expect(app.kind).toBe('curtain');
    expect(gameOf(app)?.names).toEqual(['Ari', 'Player 2']);
    expect(reduce(initialApp, { type: 'start', names: ['Ari'] }, rng)).toBe(initialApp);
    // Only the setup starts a game.
    expect(reduce(app, { type: 'start', names: ['x', 'y'] }, rng)).toBe(app);
  });

  test('more than six names are cut to six', () => {
    const app = reduce(
      initialApp,
      { type: 'start', names: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
      rng,
    );
    expect(gameOf(app)?.names).toHaveLength(6);
  });
});

describe('the curtain and the table', () => {
  test('reveal lifts the curtain; elsewhere it is a no-op', () => {
    const curtain = reduce(initialApp, { type: 'start', names: ['A', 'B'] }, rng);
    const shown = reduce(curtain, { type: 'reveal' }, rng);
    expect(shown.kind).toBe('table');
    expect(reduce(shown, { type: 'reveal' }, rng)).toBe(shown);
    expect(reduce(initialApp, { type: 'reveal' }, rng)).toBe(initialApp);
  });

  test('a play that passes the turn drops the curtain for the next seat', () => {
    const app = table([['r1a', 'g2a'], ['y1a']], 'r5a');
    const next = reduce(app, { type: 'game', intent: { type: 'play', id: 'r1a' } }, rng);
    expect(next.kind).toBe('curtain');
    expect(gameOf(next)?.turn).toBe(1);
  });

  test('a refused play stays on the table with the engine note', () => {
    const app = table([['g2a'], ['y1a']], 'r5a');
    const next = reduce(app, { type: 'game', intent: { type: 'play', id: 'g2a' } }, rng);
    expect(next.kind).toBe('table');
    expect(gameOf(next)?.note).toBe('green 2 does not match.');
  });

  test('a wild keeps the table up for the colour, then the curtain drops', () => {
    const app = table([['W1', 'r1a'], ['y1a']], 'g5a');
    const waiting = reduce(app, { type: 'game', intent: { type: 'play', id: 'W1' } }, rng);
    expect(waiting.kind).toBe('table');
    expect(gameOf(waiting)?.phase.kind).toBe('color');
    const named = reduce(waiting, { type: 'game', intent: { type: 'color', color: 'red' } }, rng);
    expect(named.kind).toBe('curtain');
  });

  test('a drawn playable card keeps the table (same seat decides)', () => {
    const base = table([['g2a'], ['y1a']], 'r5a');
    const app: App = { kind: 'table', game: { ...must(gameOf(base)), draw: cards('r9a') } };
    const drawn = reduce(app, { type: 'game', intent: { type: 'draw' } }, rng);
    expect(drawn.kind).toBe('table');
    expect(playableIds(must(gameOf(drawn)))).toEqual(['r9a']);
  });

  test('going out shows the table to everyone; the next round starts behind the curtain', () => {
    const app = table([['r1a'], ['y1a']], 'r5a');
    const over = reduce(app, { type: 'game', intent: { type: 'play', id: 'r1a' } }, rng);
    expect(over.kind).toBe('table');
    expect(gameOf(over)?.phase.kind).toBe('roundOver');
    const next = reduce(over, { type: 'game', intent: { type: 'nextRound' } }, rng);
    expect(next.kind).toBe('curtain');
    expect(gameOf(next)?.round).toBe(2);
  });

  test('a game intent from the curtain or the setup does nothing', () => {
    const curtain = reduce(initialApp, { type: 'start', names: ['A', 'B'] }, rng);
    expect(reduce(curtain, { type: 'game', intent: { type: 'draw' } }, rng)).toBe(curtain);
    expect(reduce(initialApp, { type: 'game', intent: { type: 'draw' } }, rng)).toBe(initialApp);
  });

  test('new game returns to the setup', () => {
    const app = table([['r1a'], ['y1a']], 'r5a');
    expect(reduce(app, { type: 'newGame' }, rng)).toBe(initialApp);
  });
});
