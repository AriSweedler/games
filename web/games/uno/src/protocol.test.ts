import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../shared/lib/rng.ts';
import { viaJson } from '../../../../test/shared/engine-helpers.ts';
import { createState, viewFor } from './engine/view.ts';
import {
  action,
  decodeFrame,
  decodeGuestFrame,
  decodeHostFrame,
  join,
  joinName,
  lobby,
  state,
  welcome,
  type TableSeat,
} from './protocol.ts';

const BOB: TableSeat = { name: 'Bob', connected: true };
const EMPTY: TableSeat = { name: null, connected: false };
const SEATS: ReadonlyArray<TableSeat> = [BOB, EMPTY];

describe('the room frames', () => {
  test('at two seats the seat count alone; past two the table and the receiver’s seat', () => {
    expect(welcome('Ann', { seatCount: 2 }, [BOB], 1)).toEqual({
      t: 'welcome',
      hostName: 'Ann',
      seatCount: 2,
    });
    const three = lobby('Ann', { seatCount: 3 }, SEATS, 2);
    expect(three).toEqual({ t: 'lobby', hostName: 'Ann', seatCount: 3, seats: SEATS, you: 2 });
    expect(decodeHostFrame(viaJson(three))).toEqual({ ok: true, value: three });
    expect(decodeFrame(viaJson(welcome('Ann', { seatCount: 4 }, [...SEATS, EMPTY], 3))).ok).toBe(
      true,
    );
  });

  test('a seating that does not fit its seat count is refused', () => {
    expect(
      decodeHostFrame({ t: 'lobby', hostName: 'Ann', seatCount: 4, seats: SEATS, you: 1 }),
    ).toEqual({ ok: false, error: '$.seats: expected 3 seat rows (seatCount - 1)' });
    expect(
      decodeHostFrame({ t: 'lobby', hostName: 'Ann', seatCount: 3, seats: SEATS, you: 3 }),
    ).toEqual({ ok: false, error: '$.you: expected integer in [1, 2]' });
    expect(decodeHostFrame({ t: 'nope' }).ok).toBe(false);
  });
});

describe('the game frames', () => {
  test('a seat’s view and a guest’s action read back; a join names its player', () => {
    const view = viewFor(
      createState(['Ann', 'Bob', 'Cy'], mulberry32(5), () => 9),
      2,
    );
    expect(decodeHostFrame(viaJson(state(view)))).toEqual({ ok: true, value: state(view) });
    const play = action({ type: 'play', id: 'r5a' });
    expect(decodeGuestFrame(viaJson(play))).toEqual({ ok: true, value: play });
    expect(joinName(join('Bob'))).toBe('Bob');
    expect(joinName(play)).toBeNull();
  });
});
