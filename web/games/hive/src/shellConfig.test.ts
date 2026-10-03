import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../shared/lib/rng.ts';
import { ORIGIN } from './engine/hex.ts';
import { viewFor } from './engine/view.ts';
import { HIVE_SHELL, sideName } from './shellConfig.ts';

const PLAYERS = [
  { id: 'h', name: 'Ann' },
  { id: 'g', name: 'Bob' },
] as const;

describe('the shell config', () => {
  test('the copy and the modes', () => {
    expect(HIVE_SHELL.copy.hostRoom('Ann', { seatCount: 2 }, 2, 2)).toBe(
      'Connected — waiting for Ann to start',
    );
    expect(sideName(0)).toBe('White');
    expect(sideName(1)).toBe('Black');
    expect(HIVE_SHELL.modes.parse('local', {} as never)).toEqual({
      shown: 'local',
      stored: 'local',
    });
    expect(HIVE_SHELL.modes.parse('x', {} as never)).toEqual({ shown: 'online', stored: 'online' });
    expect(HIVE_SHELL.opts.parse({}, { seatCount: 2 })).toEqual({ seatCount: 2 });
    expect(HIVE_SHELL.seats).toBeUndefined();
  });

  test('the engine adapters: the start over the two seats, the names, a rename, the result', () => {
    const e = HIVE_SHELL.engine;
    const game = e.create(PLAYERS, { seatCount: 2 }, mulberry32(1), () => 77);
    expect(game.game.names).toEqual({ white: 'Ann', black: 'Bob' });
    expect(HIVE_SHELL.opts.ofGame(game)).toEqual({ seatCount: 2 });
    expect(e.names(game)).toEqual(['Ann', 'Bob']);
    expect(e.renameGuest(game, 'Bea', 1).game.names).toEqual({ white: 'Ann', black: 'Bea' });
    expect(e.finished(game)).toBe(false);
    const view = viewFor(game, 0);
    expect(e.over(view)).toBe(false);
    expect(HIVE_SHELL.result.keyOf(view)).toBe('77');
    expect(HIVE_SHELL.result.playersOf(view)).toEqual(['Ann', 'Bob']);
    expect(HIVE_SHELL.result.scoreOf(view)).toBe('');
    expect(HIVE_SHELL.result.winnerOf(view)).toBeNull();
    const refused = e.apply(
      game,
      1,
      { type: 'place', bug: 'ant', to: ORIGIN },
      mulberry32(1),
      () => 0,
    );
    expect(refused.ok).toBe(false);
    const resigned = e.apply(game, 0, { type: 'resign' }, mulberry32(1), () => 0);
    if (!resigned.ok) throw new Error(resigned.error);
    expect(e.finished(resigned.value)).toBe(true);
    const over = viewFor(resigned.value, 0);
    expect(e.over(over)).toBe(true);
    expect(HIVE_SHELL.result.scoreOf(over)).toBe('resigned');
    expect(HIVE_SHELL.result.winnerOf(over)).toBe(1);
  });
});
