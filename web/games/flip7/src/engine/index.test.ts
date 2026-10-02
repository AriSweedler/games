import { describe, expect, test } from 'vitest';

import { NOW, now, viaJson } from '../../../../../test/shared/engine-helpers.ts';
import { mulberry32 } from '../../../../shared/lib/rng.ts';
import {
  NOT_YOUR_TURN_MSG,
  actorOf,
  applyAction,
  createGame,
  decodeAction,
  decodeState,
  decodeView,
  isMyTurn,
  legalActions,
  nameOf,
  viewFor,
  type State,
} from './index.ts';

const fresh = (n = 3): State =>
  createGame(['Ari', 'Lavi', 'Sandro', 'Grant', 'Noa', 'Ethan'].slice(0, n), mulberry32(7), now);

describe('the shell-facing engine', () => {
  test('the deal: round 1, the seat after the dealer deals itself first, the clock kept', () => {
    const game = fresh();
    expect(game.startedAt).toBe(NOW);
    expect(game.round).toBe(1);
    expect(game.opening).toBe(3);
    expect(actorOf(game)).toBe(0);
    expect(nameOf(game, 1)).toBe('Lavi');
    expect(nameOf(game, 9)).toBe('');
  });

  test('turn authority: only the seat whose move it is may act, and only with what applies now', () => {
    const game = fresh();
    expect(applyAction(game, 1, { type: 'hit' }, mulberry32(1))).toEqual({
      ok: false,
      error: NOT_YOUR_TURN_MSG,
    });
    expect(applyAction(game, 0, { type: 'stay' }, mulberry32(1))).toEqual({
      ok: false,
      error: 'The deal comes first.',
    });
    expect(applyAction(game, 0, { type: 'nextRound' }, mulberry32(1))).toEqual({
      ok: false,
      error: 'The round is not over.',
    });
    expect(applyAction(game, 0, { type: 'give', seat: 1 }, mulberry32(1)).ok).toBe(false);
    const hit = applyAction(game, 0, { type: 'hit' }, mulberry32(1));
    expect(hit.ok).toBe(true);
    if (hit.ok) {
      expect(hit.value.startedAt).toBe(NOW);
      expect(hit.value.seats[0]?.line.length ?? 0).toBeGreaterThan(0);
    }
  });

  test('actorOf: the turn, the drawer of an action card, the host between rounds, nobody at the end', () => {
    const game = fresh();
    expect(actorOf({ ...game, phase: { kind: 'roundOver' } })).toBe(0);
    expect(actorOf({ ...game, phase: { kind: 'gameOver', winner: 1 } })).toBeNull();
    expect(
      actorOf({
        ...game,
        phase: {
          kind: 'target',
          card: { id: 'freeze-1', kind: 'freeze', value: null },
          from: 2,
          choices: [0, 1, 2],
        },
      }),
    ).toBe(2);
    const roundOver: State = { ...game, phase: { kind: 'roundOver' } };
    expect(applyAction(roundOver, 0, { type: 'nextRound' }, mulberry32(1)).ok).toBe(true);
    const target: State = {
      ...game,
      phase: {
        kind: 'target',
        card: { id: 'freeze-1', kind: 'freeze', value: null },
        from: 0,
        choices: [0, 1],
      },
    };
    expect(applyAction(target, 0, { type: 'give', seat: 2 }, mulberry32(1))).toEqual({
      ok: false,
      error: 'Sandro cannot take it.',
    });
  });

  test('a view hides the piles: their counts, never their order', () => {
    const game = fresh();
    const view = viewFor(game, 1);
    expect(view.me).toBe(1);
    expect(view.drawCount).toBe(game.draw.length);
    expect(view.discardCount).toBe(0);
    expect('draw' in view).toBe(false);
    expect(isMyTurn(view)).toBe(false);
    expect(isMyTurn(viewFor(game, 0))).toBe(true);
  });

  test('legal actions: Hit alone in the opening, Hit and Stay after, the choices, Next round; none when not mine', () => {
    const game = fresh();
    expect(legalActions(viewFor(game, 0))).toEqual([{ type: 'hit' }]);
    expect(legalActions(viewFor(game, 1))).toEqual([]);
    expect(legalActions(viewFor({ ...game, opening: 0 }, 0))).toEqual([
      { type: 'hit' },
      { type: 'stay' },
    ]);
    const target: State = {
      ...game,
      phase: {
        kind: 'target',
        card: { id: 'flip3-1', kind: 'flip3', value: null },
        from: 0,
        choices: [0, 2],
      },
    };
    expect(legalActions(viewFor(target, 0))).toEqual([
      { type: 'give', seat: 0 },
      { type: 'give', seat: 2 },
    ]);
    expect(legalActions(viewFor({ ...game, phase: { kind: 'roundOver' } }, 0))).toEqual([
      { type: 'nextRound' },
    ]);
    expect(legalActions(viewFor({ ...game, phase: { kind: 'gameOver', winner: 0 } }, 0))).toEqual(
      [],
    );
  });

  test('the decoders read back what the save and the wire carry', () => {
    const game = fresh(6);
    expect(decodeState(viaJson(game))).toEqual({ ok: true, value: game });
    const view = viewFor(game, 2);
    expect(decodeView(viaJson(view))).toEqual({ ok: true, value: view });
    (
      [{ type: 'hit' }, { type: 'stay' }, { type: 'give', seat: 3 }, { type: 'nextRound' }] as const
    ).forEach((action) => {
      expect(decodeAction(viaJson(action))).toEqual({ ok: true, value: action });
    });
    expect(decodeAction({ type: 'give', seat: 12 }).ok).toBe(false);
    expect(decodeAction({ type: 'draw' }).ok).toBe(false);
    expect(decodeState({ ...game, seats: 'x' }).ok).toBe(false);
  });
});
