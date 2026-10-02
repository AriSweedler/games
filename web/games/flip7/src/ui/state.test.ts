import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../../shared/lib/rng.ts';
import {
  DEFAULT_SEATS,
  MAX_SEATS,
  MIN_SEATS,
  gameOf,
  initialApp,
  nameOrDefault,
  reduce,
} from './state.ts';

const rng = mulberry32(21);

describe('the setup', () => {
  test('seat bounds and names', () => {
    expect(MIN_SEATS).toBe(2);
    expect(MAX_SEATS).toBe(8);
    expect(DEFAULT_SEATS).toBe(3);
    expect(nameOrDefault('  Ari ', 0)).toBe('Ari');
    expect(nameOrDefault('   ', 2)).toBe('Player 3');
    expect(gameOf(initialApp)).toBeNull();
  });

  test('start deals; fewer than two seats or a game in progress stays put; nine names are cut to eight', () => {
    const app = reduce(initialApp, { type: 'start', names: ['Ari', '', 'Cy'] }, rng);
    expect(app.kind).toBe('table');
    expect(gameOf(app)?.seats.map((s) => s.name)).toEqual(['Ari', 'Player 2', 'Cy']);
    expect(gameOf(app)?.opening).toBe(3);
    expect(reduce(initialApp, { type: 'start', names: ['Ari'] }, rng)).toBe(initialApp);
    expect(reduce(app, { type: 'start', names: ['x', 'y'] }, rng)).toBe(app);
    const nine = reduce(
      initialApp,
      { type: 'start', names: Array.from({ length: 9 }, (_, i) => String(i)) },
      rng,
    );
    expect(gameOf(nine)?.seats).toHaveLength(8);
  });
});

describe('the table', () => {
  test('a game intent plays through the engine; from the setup it does nothing', () => {
    const app = reduce(initialApp, { type: 'start', names: ['A', 'B'] }, rng);
    const hit = reduce(app, { type: 'game', intent: { type: 'hit' } }, rng);
    expect(hit.kind).toBe('table');
    expect(gameOf(hit)?.opening).toBe(1);
    expect(reduce(initialApp, { type: 'game', intent: { type: 'hit' } }, rng)).toBe(initialApp);
  });

  test('new game returns to the setup', () => {
    const app = reduce(initialApp, { type: 'start', names: ['A', 'B'] }, rng);
    expect(reduce(app, { type: 'newGame' }, rng)).toBe(initialApp);
  });
});
