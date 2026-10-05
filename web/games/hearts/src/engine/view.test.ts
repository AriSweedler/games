import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../../shared/lib/rng.ts';
import {
  applyAction,
  createState,
  decodeState,
  decodeView,
  legalActions,
  turnSeat,
  viewFor,
  winnerSeat,
} from './view.ts';

const NOW = (): number => 77;
const rng = mulberry32(1);

describe('Hearts: the shell adapters', () => {
  test('the start, the view per seat, a play out of turn refused, the result', () => {
    const state = createState(['Ann', 'Bob'], NOW);
    expect(state.startedAt).toBe(77);
    expect(turnSeat(state.game)).toBe(0);
    expect(viewFor(state, 0).legal).toHaveLength(2);
    expect(viewFor(state, 1).legal).toEqual([]);
    expect(applyAction(state, 1, { type: 'pass' }, rng, NOW).ok).toBe(false);
    expect(applyAction(state, 0, { type: 'again' }, rng, NOW).ok).toBe(false);
    const resigned = applyAction(state, 0, { type: 'resign' }, rng, NOW);
    if (!resigned.ok) throw new Error(resigned.error);
    expect(turnSeat(resigned.value.game)).toBeNull();
    expect(winnerSeat(resigned.value.game.result)).toBe(1);
    expect(legalActions(viewFor(resigned.value, 0))).toEqual([{ type: 'again' }]);
    const again = applyAction(resigned.value, 1, { type: 'again' }, rng, () => 99);
    if (!again.ok) throw new Error(again.error);
    expect(again.value).toMatchObject({ startedAt: 99, game: { turns: 0, result: null } });
  });

  test('the decoders round-trip a view and a state, and refuse a stranger', () => {
    const state = createState(['Ann', 'Bob'], NOW);
    const view = viewFor(state, 0);
    expect(decodeView(JSON.parse(JSON.stringify(view)))).toEqual({ ok: true, value: view });
    expect(decodeState(JSON.parse(JSON.stringify(state)))).toEqual({ ok: true, value: state });
    expect(decodeView({ seat: 2 }).ok).toBe(false);
    expect(decodeState({ game: { names: ['Ann'] } }).ok).toBe(false);
  });
});
