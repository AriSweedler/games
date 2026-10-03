import { describe, expect, test } from 'vitest';

import { failureOf, viaJson } from '../../../../../test/shared/engine-helpers.ts';
import { columnAt } from './engine.ts';
import { ORIGIN } from './hex.ts';
import {
  applyAction,
  createState,
  decodeAction,
  decodeState,
  decodeView,
  legalActions,
  seatOf,
  sideOf,
  turnSeat,
  viewFor,
  winnerSeat,
} from './view.ts';

const now = (): number => 7;
const fresh = createState(['Ann', 'Bob'], now);

describe('the engine as the shell plays it', () => {
  test('seats: White is 0 and Black 1, both ways', () => {
    expect(sideOf(0)).toBe('white');
    expect(seatOf('black')).toBe(1);
    expect(turnSeat(fresh.game)).toBe(0);
    expect(winnerSeat(null)).toBeNull();
    expect(winnerSeat({ kind: 'draw' })).toBeNull();
    expect(winnerSeat({ kind: 'win', winner: 'black', by: 'resign' })).toBe(1);
  });

  test('a view: the whole game, the seat to move sees its placements, the other nothing', () => {
    const white = viewFor(fresh, 0);
    expect(white.names).toEqual(['Ann', 'Bob']);
    expect(white.placements.length).toBe(5);
    expect(white.movable).toEqual([]);
    expect(white.canPass).toBe(false);
    const black = viewFor(fresh, 1);
    expect(black.placements).toEqual([]);
    expect(legalActions(black)).toEqual([]);
    expect(legalActions(white)).toHaveLength(6);
    expect(legalActions(white).at(-1)).toEqual({ type: 'resign' });
  });

  test('actions: out of turn refused, a refusal carries the note, a placement moves the turn, again restarts', () => {
    expect(failureOf(applyAction(fresh, 1, { type: 'place', bug: 'ant', to: ORIGIN }, now))).toBe(
      'Not your turn.',
    );
    expect(failureOf(applyAction(fresh, 0, { type: 'pass' }, now))).toContain('pass only');
    expect(failureOf(applyAction(fresh, 0, { type: 'again' }, now))).toBe('The game is still on.');
    const placed = applyAction(fresh, 0, { type: 'place', bug: 'ant', to: ORIGIN }, now);
    expect(placed.ok && placed.value.game.turn).toBe('black');
    expect(placed.ok && placed.value.startedAt).toBe(7);
    const resigned = applyAction(fresh, 0, { type: 'resign' }, now);
    expect(resigned.ok && resigned.value.game.result).toEqual({
      kind: 'win',
      winner: 'black',
      by: 'resign',
    });
    if (!resigned.ok) throw new Error(resigned.error);
    expect(turnSeat(resigned.value.game)).toBeNull();
    expect(legalActions(viewFor(resigned.value, 1))).toEqual([{ type: 'again' }]);
    const again = applyAction(resigned.value, 1, { type: 'again' }, () => 9);
    expect(again.ok && again.value).toEqual(createState(['Ann', 'Bob'], () => 9));
  });

  test('the decoders round-trip a state, a view and every action; a bad board is refused', () => {
    const placed = applyAction(fresh, 0, { type: 'place', bug: 'ant', to: ORIGIN }, now);
    if (!placed.ok) throw new Error(placed.error);
    expect(decodeState(viaJson(placed.value))).toEqual({ ok: true, value: placed.value });
    const view = viewFor(placed.value, 1);
    expect(decodeView(viaJson(view))).toEqual({ ok: true, value: view });
    expect(decodeView(viaJson({ ...view, names: ['one'] })).ok).toBe(false);
    expect(
      decodeState(
        viaJson({ ...placed.value, game: { ...placed.value.game, board: { '0,0': [] } } }),
      ).ok,
    ).toBe(false);
    expect(
      decodeState(
        viaJson({
          ...placed.value,
          game: { ...placed.value.game, board: { x: [{ side: 'white', bug: 'ant' }] } },
        }),
      ).ok,
    ).toBe(false);
    const actions = [
      { type: 'place', bug: 'queen', to: { q: 1, r: -1 } },
      { type: 'move', from: ORIGIN, to: { q: 1, r: 0 } },
      { type: 'pass' },
      { type: 'resign' },
      { type: 'again' },
    ];
    actions.forEach((a) => {
      expect(decodeAction(viaJson(a))).toEqual({ ok: true, value: a });
    });
    expect(decodeAction({ type: 'fly' }).ok).toBe(false);
  });

  test('a stacked cell comes through the wire as its whole column, and reads top first', () => {
    const stack = [
      { side: 'white', bug: 'queen' },
      { side: 'white', bug: 'ant' },
      { side: 'black', bug: 'beetle' },
    ] as const;
    const state = { ...fresh, game: { ...fresh.game, board: { '0,0': stack } } };
    const view = viewFor(state, 1);
    const decoded = decodeView(viaJson(view));
    if (!decoded.ok) throw new Error(decoded.error.expected);
    expect(decoded.value.game.board['0,0']).toEqual(stack);
    expect(columnAt(decoded.value.game.board, ORIGIN)).toEqual([...stack].reverse());
    expect(columnAt(decoded.value.game.board, ORIGIN)[0]).toEqual({
      side: 'black',
      bug: 'beetle',
    });
    expect(columnAt(decoded.value.game.board, { q: 3, r: 3 })).toEqual([]);
  });
});
