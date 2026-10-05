import { describe, expect, test } from 'vitest';

import { must, viaJson } from '../../../../../test/shared/engine-helpers.ts';
import { mulberry32 } from '../../../../shared/lib/rng.ts';
import {
  NOT_YOUR_TURN_MSG,
  applyAction,
  createState,
  decodeAction,
  decodeState,
  decodeView,
  intentOf,
  legalActions,
  turnSeat,
  viewFor,
  type Action,
  type State,
} from './view.ts';

const NOW = (): number => 77;
const NAMES = ['Ann', 'Bob', 'Cat', 'Dan'];

/** Every seat passes its listed three, in seat order, then the 2♣ holder is to play. */
const passed = (state: State, rng: () => number): State =>
  NAMES.reduce<State>((s, _, seat) => {
    const first = viewFor(s, seat).legal[0];
    if (first === undefined) throw new Error('nothing to pass');
    return must(applyAction(s, seat, first, rng, NOW));
  }, state);

describe('Hearts: the shell adapters', () => {
  test('each seat sees its own hand and only the counts of the others; the pass is seated from the sender', () => {
    const rng = mulberry32(1);
    const state = createState(NAMES, rng, NOW);
    expect(state.startedAt).toBe(77);
    const v0 = viewFor(state, 0);
    const v1 = viewFor(state, 1);
    expect(v0.hand).toHaveLength(13);
    expect(v0.hand).toEqual(state.game.hands[0]);
    expect(v1.hand).toEqual(state.game.hands[1]);
    expect(v0).not.toHaveProperty('hands');
    expect(v0.counts).toEqual([13, 13, 13, 13]);
    expect(v0.phase).toBe('passing');
    expect(v0.passed).toEqual([false, false, false, false]);
    expect(turnSeat(state.game)).toBe(0);
    // Seat 2 may pass before seat 0: the pass is not a turn.
    const pass2 = v1.legal[0];
    if (pass2?.type !== 'pass') throw new Error('no pass');
    expect(intentOf(1, pass2)).toEqual({ type: 'pass', seat: 1, ids: pass2.ids });
    const after = must(applyAction(state, 1, pass2, rng, NOW));
    expect(viewFor(after, 0).passed).toEqual([false, true, false, false]);
    expect(viewFor(after, 1).myPass).toEqual(pass2.ids);
    expect(viewFor(after, 0).myPass).toBeNull();
    expect(viewFor(after, 1).legal).toEqual([]);
    // A pass of another seat's cards is the engine's refusal.
    expect(applyAction(state, 0, pass2, rng, NOW)).toEqual({
      ok: false,
      error: 'Pass three cards of your hand.',
    });
  });

  test('a play out of turn is refused; the view carries the trick, the last trick and its points', () => {
    const rng = mulberry32(2);
    const state = passed(createState(NAMES, rng, NOW), rng);
    const turn = turnSeat(state.game);
    if (turn === null) throw new Error('nobody to play');
    expect(viewFor(state, turn).legal).toEqual([{ type: 'play', id: '2C' }]);
    const other = (turn + 1) % 4;
    expect(viewFor(state, other).legal).toEqual([]);
    expect(applyAction(state, other, { type: 'play', id: '2C' }, rng, NOW)).toEqual({
      ok: false,
      error: NOT_YOUR_TURN_MSG,
    });
    expect(applyAction(state, turn, { type: 'nextHand' }, rng, NOW)).toEqual({
      ok: false,
      error: 'The hand is still on.',
    });
    const led = must(applyAction(state, turn, { type: 'play', id: '2C' }, rng, NOW));
    expect(viewFor(led, other).trick).toEqual({
      leader: turn,
      plays: [{ seat: turn, card: '2C' }],
    });
    expect(viewFor(led, other).counts[turn]).toBe(12);
    expect(legalActions(viewFor(led, other)).length).toBeGreaterThan(0);
    const trick = [1, 2, 3].reduce<State>((s) => {
      const seat = turnSeat(s.game);
      const first = seat === null ? undefined : viewFor(s, seat).legal[0];
      if (seat === null || first === undefined) throw new Error('stuck');
      return must(applyAction(s, seat, first, rng, NOW));
    }, led);
    const v = viewFor(trick, 0);
    expect(v.lastTrick?.plays).toHaveLength(4);
    expect(v.lastTrick?.points).toBe(0);
    expect(v.trick.plays).toEqual([]);
    expect(v.turn).toBe(v.lastTrick?.taker);
  });

  test('Play again from any seat restarts the clock; the decoders round-trip and refuse a stranger', () => {
    const rng = mulberry32(3);
    const state = createState(NAMES, rng, NOW);
    const over: State = {
      ...state,
      game: { ...state.game, phase: 'gameOver', scores: [101, 20, 30, 40] },
    };
    const v = viewFor(over, 2);
    expect(v.winners).toEqual([1]);
    expect(v.legal).toEqual([{ type: 'playAgain' }]);
    const again = must(applyAction(over, 2, { type: 'playAgain' }, rng, () => 99));
    expect(again.startedAt).toBe(99);
    expect(again.game.scores).toEqual([0, 0, 0, 0]);
    expect(decodeView(viaJson(v))).toEqual({ ok: true, value: v });
    expect(decodeState(viaJson(state))).toEqual({ ok: true, value: state });
    expect(decodeView({ seat: 4 }).ok).toBe(false);
    expect(decodeState({ game: { names: ['Ann'] } }).ok).toBe(false);
    const action: Action = { type: 'pass', ids: ['2C', '3C', '4C'] };
    expect(decodeAction(viaJson(action))).toEqual({ ok: true, value: action });
    expect(decodeAction({ type: 'play', id: '1X' }).ok).toBe(false);
  });
});
