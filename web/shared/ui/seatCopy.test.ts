// The N-seat waiting copy (seatCopy.ts): every form is the shell's two-seat string at a table of
// two and counts past it, the verb the game's; the strings here are the ones uno, flip7 and
// briscola each pinned before the hoist (docs/design/shell-hoist.md §4 B), byte for byte.
import { describe, expect, test } from 'vitest';

import {
  TABLE_FULL_MSG,
  emptySeatName,
  hostRoomMsg,
  parseSeatCount,
  seatedCopy,
} from './seatCopy.ts';
import { OPPONENT_LEFT_MSG, WAITING_FOR_GUEST_MSG, guestGoneMsg, joinedMsg } from './shell.ts';

const WAITING = 'Waiting for your opponent to join…';
const deal = seatedCopy({ verb: 'deal', waitingAtTwo: WAITING });

describe('the N-seat copy: the shell’s string at two seats, the count past', () => {
  test('the guest’s status names the host and the verb; past two seats the count rides in front', () => {
    expect(deal.hostRoom('Ann', {}, 2, 2)).toBe('Connected — waiting for Ann to deal');
    expect(deal.hostRoom('Ann', {}, 2, 4)).toBe(
      'Connected — 2 of 4 seated · waiting for Ann to deal',
    );
    expect(hostRoomMsg('start')('Ann', {}, 2, 2)).toBe('Connected — waiting for Ann to start');
    expect(seatedCopy({ verb: 'roll', waitingAtTwo: WAITING }).hostRoom('Bo', {}, 3, 6)).toBe(
      'Connected — 3 of 6 seated · waiting for Bo to roll',
    );
  });

  test('the host’s open status: the session’s line at two, the empty seats past', () => {
    expect(deal.waiting(2)).toBe(WAITING);
    expect(deal.waiting(4)).toBe('Waiting for 3 players to join');
  });

  test('a join: the shell’s line once the table is full, else how many are still to come', () => {
    expect(deal.joined('Bob', ['Bob'], 0)).toBe(joinedMsg('Bob'));
    expect(deal.joined('Bob', ['Bob'], 1)).toBe('Bob joined! Waiting for 1 more.');
    expect(deal.joined('Cara', ['Bob', 'Cara'], 2)).toBe('Cara joined! Waiting for 2 more.');
  });

  test('a seat that left: the shell’s line at two; past two, who left (or the seat’s number) and the count', () => {
    expect(deal.seatLeft('Bob', 1, 1, 2)).toBe(OPPONENT_LEFT_MSG);
    expect(deal.seatLeft('Bob', 1, 2, 3)).toBe('Bob left. 2 of 3 seated.');
    expect(deal.seatLeft(null, 2, 3, 4)).toBe('Seat 3 left. 3 of 4 seated.');
    expect(emptySeatName(0)).toBe('Seat 1');
  });

  test('a channel down mid-game: the shell’s toast, the seat named or numbered', () => {
    expect(deal.guestGone('Bob', 'ABCD', 1)).toBe(guestGoneMsg('Bob', 'ABCD'));
    expect(deal.guestGone(null, 'ABCD', 2)).toBe(guestGoneMsg('Seat 3', 'ABCD'));
    expect(deal.guestGone(null, null, 1)).toBe(guestGoneMsg(emptySeatName(1), null));
  });

  test('a full table, and Start below a short one', () => {
    expect(deal.roomFull).toBe(TABLE_FULL_MSG);
    expect(deal.notEnough(1, 2)).toBe(WAITING_FOR_GUEST_MSG);
    expect(deal.notEnough(2, 3)).toBe('2 of 3 seated — waiting for 1 more.');
    expect(deal.notEnough(2, 4)).toBe('2 of 4 seated — waiting for 2 more.');
  });
});

describe('parseSeatCount', () => {
  const COUNTS = [2, 3, 4] as const;
  test('one of the game’s counts off the raw value, else the fallback', () => {
    expect(parseSeatCount(COUNTS, '3', 2)).toBe(3);
    expect(parseSeatCount(COUNTS, '4', 2)).toBe(4);
    expect(parseSeatCount(COUNTS, '9', 2)).toBe(2);
    expect(parseSeatCount(COUNTS, 'nope', 3)).toBe(3);
    expect(parseSeatCount(COUNTS, undefined, 4)).toBe(4);
  });
});
