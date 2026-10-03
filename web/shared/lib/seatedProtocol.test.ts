import { describe, expect, test } from 'vitest';

import { viaJson } from '../../../test/shared/engine-helpers.ts';
import { integer, literal, object } from './json.ts';
import { seatedProtocol, seatingFault, type TableSeat } from './seatedProtocol.ts';

// A toy game over the seated protocol: two to four seats, one house rule after the count, an
// action and a view of one field each, and (for the lane) briscola-shaped intent frames.
const SEAT_COUNTS = [2, 3, 4] as const;
const options = { seatCount: literal(...SEAT_COUNTS), target: literal(50, 100) };
const decodeAction = object({ type: literal('hit', 'stay') });
const decodeView = object({ turn: integer(0, 3) });
const intentFrame = object({ t: literal('intent'), slot: integer(0, 2) });

const wire = seatedProtocol({ decodeAction, decodeView, options, seatCounts: SEAT_COUNTS });
const laned = seatedProtocol(
  { decodeAction, decodeView, options, seatCounts: SEAT_COUNTS },
  { ephemeral: intentFrame },
);

const BO: TableSeat = { name: 'Bo', connected: true };
const EMPTY: TableSeat = { name: null, connected: false };
const ROOM2 = { seatCount: 2, target: 50 } as const;
const ROOM3 = { seatCount: 3, target: 100 } as const;
const ROOM4 = { seatCount: 4, target: 100 } as const;

describe('the room frames', () => {
  test('at two seats the options alone, whatever table is passed; past two the table and the receiver`s seat after the options, in that key order', () => {
    expect(wire.welcome('Ann', ROOM2, [BO], 1)).toEqual({
      t: 'welcome',
      hostName: 'Ann',
      ...ROOM2,
    });
    expect(JSON.stringify(wire.lobby('Ann', ROOM3, [BO, EMPTY], 2))).toBe(
      '{"t":"lobby","hostName":"Ann","seatCount":3,"target":100,"seats":[{"name":"Bo","connected":true},{"name":null,"connected":false}],"you":2}',
    );
    const four = wire.welcome('Ann', ROOM4, [BO, EMPTY, EMPTY], 3);
    expect(wire.decodeFrame(viaJson(four))).toEqual({ ok: true, value: four });
    expect(wire.decodeHostFrame(viaJson(four))).toEqual({ ok: true, value: four });
  });

  test('seatingOf reads the table off a frame that carries one, null off a two-seat frame', () => {
    expect(wire.seatingOf(wire.lobby('Ann', ROOM3, [BO, EMPTY], 1))).toEqual({
      seats: [BO, EMPTY],
      you: 1,
    });
    expect(wire.seatingOf(wire.lobby('Ann', ROOM2, [BO], 1))).toBeNull();
  });
});

describe('the seating is checked against the seat count', () => {
  test.each<[string, unknown, string]>([
    [
      'a three-seat lobby with one row',
      { t: 'lobby', hostName: 'Ann', ...ROOM3, seats: [BO], you: 1 },
      '$.seats: expected 2 seat rows (seatCount - 1)',
    ],
    [
      'a three-seat welcome naming seat 3',
      { t: 'welcome', hostName: 'Ann', ...ROOM3, seats: [BO, EMPTY], you: 3 },
      '$.you: expected integer in [1, 2]',
    ],
    [
      'a lobby naming the host (the field decoder`s bound)',
      { t: 'lobby', hostName: 'Ann', ...ROOM4, seats: [EMPTY, EMPTY, EMPTY], you: 0 },
      '$.you: expected integer in [1, 3]',
    ],
    [
      'a two-seat welcome with two rows',
      { t: 'welcome', hostName: 'Ann', ...ROOM2, seats: [EMPTY, EMPTY] },
      '$.seats: expected 1 seat rows (seatCount - 1)',
    ],
    [
      'a row without its dot',
      { t: 'lobby', hostName: 'Ann', ...ROOM3, seats: [BO, { name: 'Cal' }], you: 1 },
      '$.seats[1].connected: expected boolean',
    ],
  ])('%s is refused', (_label, input, error) => {
    expect(wire.decodeFrame(input)).toEqual({ ok: false, error });
    expect(wire.decodeHostFrame(input)).toEqual({ ok: false, error });
  });

  test('a frame whose table fits is taken whole; a frame with no table fits at every count; a two-seat frame may carry its one row', () => {
    const lobby3 = { t: 'lobby', hostName: 'Ann', ...ROOM3, seats: [BO, EMPTY], you: 2 };
    expect(wire.decodeHostFrame(lobby3)).toEqual({ ok: true, value: lobby3 });
    const bare = { t: 'welcome', hostName: 'Ann', ...ROOM4 };
    expect(wire.decodeFrame(bare)).toEqual({ ok: true, value: bare });
    const tolerated = { t: 'welcome', hostName: 'Ann', ...ROOM2, seats: [BO], you: 1 };
    expect(wire.decodeFrame(tolerated)).toEqual({ ok: true, value: tolerated });
    expect(seatingFault({ seatCount: 3, seats: [BO, EMPTY], you: 2 })).toBeNull();
  });

  test('the other frames pass through as the skeleton decoded them, refusals included', () => {
    const view = wire.state({ turn: 1 });
    expect(wire.decodeHostFrame(viaJson(view))).toEqual({ ok: true, value: view });
    expect(wire.decodeFrame(viaJson(wire.toast('no')))).toEqual({
      ok: true,
      value: wire.toast('no'),
    });
    expect(wire.decodeFrame(viaJson(wire.full()))).toEqual({ ok: true, value: { t: 'full' } });
    expect(wire.decodeFrame({ t: 'nope' }).ok).toBe(false);
    expect(wire.decodeHostFrame(wire.join('Bo'))).toEqual({
      ok: false,
      error:
        '$.t: expected a host frame (one of "welcome" | "lobby" | "full" | "toast" | "state"), got "join"',
    });
  });
});

describe('the guest side', () => {
  test('a join names its player, an action does not; the host side never sees a seating', () => {
    const hit = wire.action({ type: 'hit' });
    expect(wire.decodeGuestFrame(viaJson(hit))).toEqual({ ok: true, value: hit });
    expect(wire.joinName(wire.join('Bo'))).toBe('Bo');
    expect(wire.joinName(hit)).toBeNull();
    expect(wire.decodeGuestFrame(wire.lobby('Ann', ROOM3, [BO, EMPTY], 1))).toEqual({
      ok: false,
      error: '$.t: expected a guest frame (one of "join" | "action"), got "lobby"',
    });
  });

  test('a declared ephemeral frame rides the lane on both sides and names no player; undeclared, it is an unknown tag', () => {
    const intent = { t: 'intent', slot: 2 };
    expect(laned.decodeGuestFrame(intent)).toEqual({ ok: true, value: intent });
    expect(laned.decodeHostFrame(intent)).toEqual({ ok: true, value: intent });
    expect(laned.joinName({ t: 'intent', slot: 2 })).toBeNull();
    expect(wire.decodeFrame(intent).ok).toBe(false);
  });
});
