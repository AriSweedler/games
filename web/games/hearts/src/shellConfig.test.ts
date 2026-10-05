import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../shared/lib/rng.ts';
import { defaultModeOf, keyOfView } from '../../../shared/ui/shell.ts';
import { viewFor } from './engine/view.ts';
import { HEARTS_SHELL } from './shellConfig.ts';

const PLAYERS = [
  { id: 'h', name: 'Ann' },
  { id: 'g', name: 'Bob' },
] as const;

describe('the shell config', () => {
  test('the copy and the modes', () => {
    expect(HEARTS_SHELL.copy.hostRoom('Ann', { seatCount: 2 }, 2, 2)).toBe(
      'Connected — waiting for Ann to start',
    );
    // The play mode is the shell's default (local or online; shell.test.ts).
    expect(HEARTS_SHELL.modes).toBeUndefined();
    expect(defaultModeOf(HEARTS_SHELL)).toBe('online');
    expect(HEARTS_SHELL.opts.parse({}, { seatCount: 2 })).toEqual({ seatCount: 2 });
  });

  test('the engine adapters: the start over the two seats, the names, a rename, the result', () => {
    const e = HEARTS_SHELL.engine;
    const game = e.create(PLAYERS, { seatCount: 2 }, mulberry32(1), () => 77);
    expect(e.names(game)).toEqual(['Ann', 'Bob']);
    expect(e.renameGuest(game, 'Bea', 1).game.names).toEqual(['Ann', 'Bea']);
    expect(e.finished(game)).toBe(false);
    const view = viewFor(game, 0);
    expect(e.over(view)).toBe(false);
    expect(keyOfView(HEARTS_SHELL, view)).toBe('77');
    expect(HEARTS_SHELL.result.playersOf(view)).toEqual(['Ann', 'Bob']);
    expect(HEARTS_SHELL.result.scoreOf(view)).toBe('');
    expect(HEARTS_SHELL.result.winnerOf(view)).toBeNull();
    const refused = e.apply(game, 1, { type: 'pass' }, mulberry32(1), () => 0);
    expect(refused.ok).toBe(false);
    const resigned = e.apply(game, 0, { type: 'resign' }, mulberry32(1), () => 0);
    if (!resigned.ok) throw new Error(resigned.error);
    expect(e.finished(resigned.value)).toBe(true);
    const over = viewFor(resigned.value, 0);
    expect(e.over(over)).toBe(true);
    expect(HEARTS_SHELL.result.scoreOf(over)).toBe('resign');
    expect(HEARTS_SHELL.result.winnerOf(over)).toBe(1);
  });
});
