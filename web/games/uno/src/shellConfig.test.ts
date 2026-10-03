import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../shared/lib/rng.ts';
import { WAITING_MSG } from '../../../shared/net/host.ts';
import { createState, viewFor } from './engine/view.ts';
import { UNO_SHELL, parseOpts, seatNames } from './shellConfig.ts';

describe('the N-seat copy is the shell’s (web/shared/ui/seatCopy.ts), dealt', () => {
  test('the forms are wired in, the verb is deal', () => {
    expect(UNO_SHELL.copy.hostRoom('Ann', { seatCount: 2 }, 2, 2)).toBe(
      'Connected — waiting for Ann to deal',
    );
    expect(UNO_SHELL.copy.hostRoom('Ann', { seatCount: 4 }, 2, 4)).toBe(
      'Connected — 2 of 4 seated · waiting for Ann to deal',
    );
    expect(UNO_SHELL.copy.waiting?.(2)).toBe(WAITING_MSG);
    expect(UNO_SHELL.copy.joined?.('Bob', ['Bob'], 1)).toBe('Bob joined! Waiting for 1 more.');
  });
});

describe('the options and the seats', () => {
  test('a count off either stepper, else the current one', () => {
    expect(parseOpts({ players: '12' }, { seatCount: 2 })).toEqual({ seatCount: 12 });
    expect(parseOpts({ players: '13' }, { seatCount: 2 })).toEqual({ seatCount: 2 });
    expect(parseOpts({ localPlayers: '4' }, { seatCount: 2 })).toEqual({ seatCount: 4 });
    expect(parseOpts({}, { seatCount: 3 })).toEqual({ seatCount: 3 });
    expect(UNO_SHELL.opts.capacity?.({ seatCount: 3 })).toBe(3);
    expect(UNO_SHELL.opts.pick({ seatCount: 4 })).toEqual({ seatCount: 4 });
    expect(seatNames(3, [{ id: 'p1', name: 'Ann' }])).toEqual(['Ann', 'Player 2', 'Player 3']);
    // The play mode is the shell's default (local or online; shell.test.ts).
    expect(UNO_SHELL.modes).toEqual({ default: 'online' });
  });

  test('the engine adapters: the deal over the seated list, the names, a rename, the result', () => {
    const e = UNO_SHELL.engine;
    const game = e.create(
      [
        { id: 'h', name: 'Ann' },
        { id: 'g1', name: 'Bob' },
        { id: 'g2', name: 'Cy' },
      ],
      { seatCount: 3 },
      mulberry32(2),
      () => 77,
    );
    expect(game.game.names).toEqual(['Ann', 'Bob', 'Cy']);
    expect(UNO_SHELL.opts.ofGame(game)).toEqual({ seatCount: 3 });
    expect(e.names(game)).toEqual(['Ann', 'Bob']);
    expect(e.renameGuest(game, 'Bea', 1).game.names).toEqual(['Ann', 'Bea', 'Cy']);
    expect(e.finished(game)).toBe(false);
    const view = viewFor(game, 0);
    expect(e.over(view)).toBe(false);
    expect(UNO_SHELL.result.keyOf(view)).toBe('77');
    expect(UNO_SHELL.result.playersOf(view)).toEqual(['Ann', 'Bob', 'Cy']);
    expect(UNO_SHELL.result.scoreOf(view)).toBe(view.counts.map(String).join('–'));
    expect(UNO_SHELL.result.winnerOf(view)).toBeNull();
    expect(UNO_SHELL.result.winnerOf({ ...view, winner: 2 })).toBe(2);
    const applied = e.apply(game, 1, { type: 'draw' }, mulberry32(1), () => 0);
    expect(applied.ok).toBe(game.game.turn === 1);
    expect(createState(['A', 'B'], mulberry32(1), () => 0).startedAt).toBe(0);
  });
});
