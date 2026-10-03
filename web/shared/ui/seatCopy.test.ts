import { describe, expect, test } from 'vitest';

import { WAITING_MSG } from '../lib/shellDefaults.ts';
import {
  TABLE_FULL_MSG,
  emptySeatName,
  leaveCopy,
  parseSeatCount,
  seatedCopy,
} from './seatCopy.ts';
import { OPPONENT_LEFT_MSG, WAITING_FOR_GUEST_MSG, guestGoneMsg, joinedMsg } from './shell.ts';

describe('leaveCopy (dry-review-2026-10.md §2.3): the two leave confirms from three nouns', () => {
  test('the defaults are the card games` words: a game, the score, the table', () => {
    expect(leaveCopy()).toEqual({
      leaveLocal: 'End this game? The score will be cleared.',
      leaveOnline: 'Leave this game? The table will close.',
    });
  });

  test('each noun alone turns its sentence: hive`s board, backgammon`s match and room, gin`s scores', () => {
    expect(leaveCopy({ cleared: 'The board' })).toEqual({
      leaveLocal: 'End this game? The board will be cleared.',
      leaveOnline: 'Leave this game? The table will close.',
    });
    expect(leaveCopy({ ends: 'match', closes: 'room' })).toEqual({
      leaveLocal: 'End this match? The score will be cleared.',
      leaveOnline: 'Leave this match? The room will close.',
    });
    expect(leaveCopy({ cleared: 'Scores', closes: 'room' })).toEqual({
      leaveLocal: 'End this game? Scores will be cleared.',
      leaveOnline: 'Leave this game? The room will close.',
    });
  });
});

describe('seatedCopy: the leave confirms ride with the seven N-seat forms', () => {
  test('a seated game spells its verb alone: the defaults for the leaves and the two-seat waiting line', () => {
    const copy = seatedCopy({ verb: 'deal' });
    expect(copy.leaveLocal).toBe('End this game? The score will be cleared.');
    expect(copy.leaveOnline).toBe('Leave this game? The table will close.');
    expect(copy.waiting(2)).toBe(WAITING_MSG);
    expect(copy.waiting(4)).toBe('Waiting for 3 players to join');
    expect(copy.hostRoom('Ann', {}, 2, 2)).toBe('Connected — waiting for Ann to deal');
    expect(copy.seatLeft(null, 1, 1, 2)).toBe(OPPONENT_LEFT_MSG);
  });

  test('the seven forms past two seats: the count rides along, an unnamed seat is numbered', () => {
    const copy = seatedCopy({ verb: 'deal' });
    expect(copy.hostRoom('Ann', {}, 3, 4)).toBe(
      'Connected — 3 of 4 seated · waiting for Ann to deal',
    );
    expect(copy.joined('Bob', ['Bob'], 0)).toBe(joinedMsg('Bob'));
    expect(copy.joined('Bob', ['Bob'], 2)).toBe('Bob joined! Waiting for 2 more.');
    expect(copy.seatLeft('Bob', 1, 2, 4)).toBe('Bob left. 2 of 4 seated.');
    expect(copy.seatLeft(null, 2, 2, 4)).toBe(`${emptySeatName(2)} left. 2 of 4 seated.`);
    expect(copy.guestGone('Bob', 'ABCD', 1)).toBe(guestGoneMsg('Bob', 'ABCD'));
    expect(copy.guestGone(null, null, 3)).toBe(guestGoneMsg('Seat 4', null));
    expect(copy.roomFull).toBe(TABLE_FULL_MSG);
    expect(copy.notEnough(1, 2)).toBe(WAITING_FOR_GUEST_MSG);
    expect(copy.notEnough(2, 4)).toBe('2 of 4 seated — waiting for 2 more.');
    expect(parseSeatCount([2, 3, 4] as const, '3', 2)).toBe(3);
    expect(parseSeatCount([2, 3, 4] as const, '9', 2)).toBe(2);
    expect(parseSeatCount([2, 3, 4] as const, undefined, 4)).toBe(4);
  });

  test('its own words where it has them: the waiting line at two and the leave nouns', () => {
    const copy = seatedCopy({ verb: 'start', waitingAtTwo: 'Hold on…', leave: { ends: 'match' } });
    expect(copy.waiting(2)).toBe('Hold on…');
    expect(copy.leaveLocal).toBe('End this match? The score will be cleared.');
  });
});
