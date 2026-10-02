import { describe, expect, test } from 'vitest';

import { now, viaJson } from '../../../../test/shared/engine-helpers.ts';
import { mulberry32 } from '../../../shared/lib/rng.ts';
import { createGame, viewFor } from './engine/index.ts';
import {
  action,
  decodeGuestFrame,
  decodeHostFrame,
  join,
  joinName,
  lobby,
  state,
  welcome,
} from './protocol.ts';

const seats = [
  { name: 'Lavi', connected: true },
  { name: null, connected: false },
];

describe("Flip 7's wire", () => {
  test('the welcome and the lobby carry the seat count, the table and the receiver`s seat at every size', () => {
    const w = welcome('Ari', { seatCount: 3 }, seats, 1);
    expect(w).toEqual({ t: 'welcome', hostName: 'Ari', seatCount: 3, seats, you: 1 });
    expect(decodeHostFrame(viaJson(w))).toEqual({ ok: true, value: w });
    const l = lobby('Ari', { seatCount: 2 }, [{ name: 'Lavi', connected: true }], 1);
    expect(l).toMatchObject({ t: 'lobby', seatCount: 2, you: 1 });
    expect(decodeHostFrame(viaJson(l)).ok).toBe(true);
    expect(decodeHostFrame({ ...w, seatCount: 13 }).ok).toBe(false);
  });

  test('a state frame round-trips a view; a guest sends its join and its actions', () => {
    const view = viewFor(createGame(['Ari', 'Lavi'], mulberry32(3), now), 1);
    expect(decodeHostFrame(viaJson(state(view)))).toEqual({ ok: true, value: state(view) });
    expect(decodeGuestFrame(viaJson(action({ type: 'give', seat: 1 })))).toEqual({
      ok: true,
      value: { t: 'action', action: { type: 'give', seat: 1 } },
    });
    const j = join('Lavi');
    expect(joinName(j)).toBe('Lavi');
    expect(joinName(action({ type: 'hit' }))).toBeNull();
    expect(decodeGuestFrame(viaJson(state(view))).ok).toBe(false);
  });
});
