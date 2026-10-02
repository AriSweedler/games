import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../shared/lib/rng.ts';
import { OPPONENT_LEFT_MSG, WAITING_FOR_GUEST_MSG } from '../../../shared/ui/shell.ts';
import { WAITING_MSG } from '../../../shared/net/host.ts';
import { createState, viewFor } from './engine/view.ts';
import {
  UNO_SHELL,
  emptySeatName,
  hostRoomMsg,
  joinedText,
  notEnoughMsg,
  parseOpts,
  parseSeatCount,
  seatGoneMsg,
  seatLeftMsg,
  seatNames,
  waitingMsg,
} from './shellConfig.ts';

describe('the N-seat copy: the shell’s string at two seats', () => {
  test('each form at two and past two', () => {
    expect(hostRoomMsg('Ann')).toBe('Connected — waiting for Ann to deal');
    expect(hostRoomMsg('Ann', 2, 4)).toBe('Connected — 2 of 4 seated · waiting for Ann to deal');
    expect(waitingMsg(2)).toBe(WAITING_MSG);
    expect(waitingMsg(4)).toBe('Waiting for 3 players to join');
    expect(joinedText('Bob', 1)).toBe('Bob joined! Waiting for 1 more.');
    expect(joinedText('Bob', 0)).toContain('Bob joined!');
    expect(seatLeftMsg('Bob', 1, 1, 2)).toBe(OPPONENT_LEFT_MSG);
    expect(seatLeftMsg(null, 2, 2, 3)).toBe('Seat 3 left. 2 of 3 seated.');
    expect(seatGoneMsg(null, 'KQZM', 1)).toContain(emptySeatName(1));
    expect(notEnoughMsg(1, 2)).toBe(WAITING_FOR_GUEST_MSG);
    expect(notEnoughMsg(2, 3)).toBe('2 of 3 seated — waiting for 1 more.');
    expect(UNO_SHELL.copy.hostRoom('Ann', { seatCount: 3 }, 2, 3)).toBe(hostRoomMsg('Ann', 2, 3));
    expect(UNO_SHELL.copy.joined?.('Bob', ['Bob'], 0)).toBe(joinedText('Bob', 0));
  });
});

describe('the options and the seats', () => {
  test('a count off either select, else the current one', () => {
    expect(parseSeatCount('3', 2)).toBe(3);
    expect(parseSeatCount('12', 2)).toBe(12);
    expect(parseSeatCount('13', 2)).toBe(2);
    expect(parseSeatCount(undefined, 4)).toBe(4);
    expect(parseOpts({ localPlayers: '4' }, { seatCount: 2 })).toEqual({ seatCount: 4 });
    expect(parseOpts({}, { seatCount: 3 })).toEqual({ seatCount: 3 });
    expect(UNO_SHELL.opts.capacity?.({ seatCount: 3 })).toBe(3);
    expect(UNO_SHELL.opts.pick({ seatCount: 4 })).toEqual({ seatCount: 4 });
    expect(seatNames(3, [{ id: 'p1', name: 'Ann' }])).toEqual(['Ann', 'Player 2', 'Player 3']);
    expect(UNO_SHELL.modes.parse('local', {} as never)).toEqual({
      shown: 'local',
      stored: 'local',
    });
    expect(UNO_SHELL.modes.parse('x', {} as never)).toEqual({ shown: 'online', stored: 'online' });
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
    expect(UNO_SHELL.result.scoreOf(view)).toBe('0–0–0');
    expect(UNO_SHELL.result.winnerOf(view)).toBeNull();
    expect(UNO_SHELL.result.winnerOf({ ...view, winner: 2 })).toBe(2);
    const applied = e.apply(game, 1, { type: 'draw' }, mulberry32(1), () => 0);
    expect(applied.ok).toBe(game.game.turn === 1);
    expect(createState(['A', 'B'], mulberry32(1), () => 0).startedAt).toBe(0);
  });
});
