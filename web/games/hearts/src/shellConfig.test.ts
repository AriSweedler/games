import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../shared/lib/rng.ts';
import { defaultModeOf, keyOfView } from '../../../shared/ui/shell.ts';
import { viewFor } from './engine/view.ts';
import { HEARTS_SHELL } from './shellConfig.ts';

const PLAYERS = [
  { id: 'h', name: 'Ann' },
  { id: 'g', name: 'Bob' },
  { id: 'i', name: 'Cat' },
] as const;

describe('the shell config', () => {
  test('the copy, the modes and the seat range', () => {
    expect(HEARTS_SHELL.copy.hostRoom('Ann', { seatCount: 3 }, 3, 3)).toBe(
      'Connected — 3 of 3 seated · waiting for Ann to deal',
    );
    // The play mode is the shell's default (local or online; shell.test.ts).
    expect(HEARTS_SHELL.modes).toBeUndefined();
    expect(defaultModeOf(HEARTS_SHELL)).toBe('online');
    expect(HEARTS_SHELL.seats).toEqual({ min: 3, max: 4, fixed: true });
    expect(HEARTS_SHELL.opts.initial).toEqual({ seatCount: 3 });
    expect(HEARTS_SHELL.opts.parse({ players: '4' }, { seatCount: 3 })).toEqual({ seatCount: 4 });
    expect(HEARTS_SHELL.opts.parse({ players: '5' }, { seatCount: 3 })).toEqual({ seatCount: 3 });
  });

  test('the engine adapters: the deal over three seats, the names, a rename, a play out of turn, the result', () => {
    const e = HEARTS_SHELL.engine;
    const game = e.create([...PLAYERS], { seatCount: 3 }, mulberry32(1), () => 77);
    expect(game.game.names).toEqual(['Ann', 'Bob', 'Cat']);
    expect(game.game.hands.map((h) => h.length)).toEqual([17, 17, 17]);
    expect(HEARTS_SHELL.opts.ofGame(game)).toEqual({ seatCount: 3 });
    expect(e.names(game)).toEqual(['Ann', 'Bob']);
    expect(e.renameGuest(game, 'Bea', 2).game.names).toEqual(['Ann', 'Bob', 'Bea']);
    expect(e.finished(game)).toBe(false);
    const view = viewFor(game, 0);
    expect(e.over(view)).toBe(false);
    expect(keyOfView(HEARTS_SHELL, view)).toBe('77');
    expect(HEARTS_SHELL.result.playersOf(view)).toEqual(['Ann', 'Bob', 'Cat']);
    expect(HEARTS_SHELL.result.scoreOf(view)).toBe('0–0–0');
    expect(HEARTS_SHELL.result.winnerOf(view)).toBeNull();
    const refused = e.apply(game, 1, { type: 'play', id: '2C' }, mulberry32(1), () => 0);
    expect(refused).toEqual({ ok: false, error: 'Not your turn.' });
    const over = {
      ...game,
      game: { ...game.game, phase: 'gameOver' as const, scores: [40, 101, 12] },
    };
    expect(e.finished(over)).toBe(true);
    const ended = viewFor(over, 0);
    expect(e.over(ended)).toBe(true);
    expect(HEARTS_SHELL.result.scoreOf(ended)).toBe('40–101–12');
    expect(HEARTS_SHELL.result.winnerOf(ended)).toBe(2);
  });
});
