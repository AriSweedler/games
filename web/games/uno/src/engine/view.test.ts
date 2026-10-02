import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../../../../shared/lib/rng.ts';
import { viaJson } from '../../../../../test/shared/engine-helpers.ts';
import type { Card } from './cards.ts';
import { HAND_SIZE, type Game } from './engine.ts';
import {
  NOT_YOUR_TURN_MSG,
  applyAction,
  createState,
  decodeAction,
  decodeState,
  decodeView,
  legalActions,
  viewFor,
  type State,
} from './view.ts';

const card = (
  id: string,
  color: Card['color'],
  kind: Card['kind'],
  value: number | null,
): Card => ({
  id,
  kind,
  color,
  value,
});
const R5 = card('r5a', 'red', 'number', 5);
const R7 = card('r7a', 'red', 'number', 7);
const B2 = card('b2a', 'blue', 'number', 2);
const G9 = card('g9a', 'green', 'number', 9);
const WILD = card('W1', null, 'wild', null);

/** A hand-built round: Ann (seat 0) to play on a red 5, Bob and Cy waiting. */
const table = (over: Partial<Game> = {}): State => ({
  startedAt: 42,
  game: {
    names: ['Ann', 'Bob', 'Cy'],
    hands: [[R7, B2, WILD], [G9], [B2, G9]],
    draw: [G9, B2, R7],
    discard: [R5],
    color: 'red',
    turn: 0,
    direction: 1,
    phase: { kind: 'turn' },
    note: 'Ann starts.',
    ...over,
  },
});

describe('createState', () => {
  test('deals seven to every seated name and stamps the clock', () => {
    const s = createState(['Ann', 'Bob'], mulberry32(3), () => 1234);
    expect(s.startedAt).toBe(1234);
    expect(s.game.names).toEqual(['Ann', 'Bob']);
    expect(s.game.hands.map((h) => h.length)).toEqual([HAND_SIZE, HAND_SIZE]);
  });
});

describe('applyAction', () => {
  test('a seat out of turn is refused; Next round may come from any seat', () => {
    expect(applyAction(table(), 1, { type: 'draw' }, mulberry32(1), () => 0)).toEqual({
      ok: false,
      error: NOT_YOUR_TURN_MSG,
    });
    const over = table({ phase: { kind: 'gameOver', winner: 0 } });
    const res = applyAction(over, 2, { type: 'again' }, mulberry32(1), () => 99);
    expect(res.ok && res.value.startedAt).toBe(99);
    expect(res.ok && res.value.game.phase.kind).not.toBe('gameOver');
  });

  test("the engine's refusal (only the note rewritten) is the error; a play is the next state", () => {
    expect(applyAction(table(), 0, { type: 'play', id: 'b2a' }, mulberry32(1), () => 0)).toEqual({
      ok: false,
      error: 'blue 2 does not match.',
    });
    const res = applyAction(table(), 0, { type: 'play', id: 'r7a' }, mulberry32(1), () => 0);
    expect(res.ok && res.value.game.turn).toBe(1);
    expect(res.ok && res.value.startedAt).toBe(42);
  });
});

describe('viewFor', () => {
  test('my own hand and everyone’s count, never another hand', () => {
    const v = viewFor(table(), 1);
    expect(v.seat).toBe(1);
    expect(v.hand).toEqual([G9]);
    expect(v.counts).toEqual([3, 1, 2]);
    expect(v.playable).toEqual([]);
    expect(v.drawn).toBeNull();
    expect(v.winner).toBeNull();
    expect(JSON.stringify(v)).not.toContain('W1');
    const mine = viewFor(table(), 0);
    expect(mine.playable).toEqual(['r7a', 'W1']);
    expect(mine.top).toEqual(R5);
    expect(mine.drawCount).toBe(3);
  });

  test('the drawn card is the drawer’s alone; the round’s winner and points are everyone’s', () => {
    const drawn = table({ phase: { kind: 'drawn', card: R7 } });
    expect(viewFor(drawn, 0).drawn).toEqual(R7);
    expect(viewFor(drawn, 1).drawn).toBeNull();
    const won = viewFor(table({ phase: { kind: 'gameOver', winner: 1 } }), 0);
    expect([won.winner, won.phase]).toEqual([1, 'gameOver']);
  });
});

describe('legalActions', () => {
  test('per phase: plays and the draw, plays and the pass, the colours, the next round, none', () => {
    expect(legalActions(viewFor(table(), 0))).toEqual([
      { type: 'play', id: 'r7a' },
      { type: 'play', id: 'W1' },
      { type: 'draw' },
    ]);
    expect(legalActions(viewFor(table(), 1))).toEqual([]);
    expect(legalActions(viewFor(table({ phase: { kind: 'drawn', card: R7 } }), 0))).toEqual([
      { type: 'play', id: 'r7a' },
      { type: 'pass' },
    ]);
    expect(legalActions(viewFor(table({ phase: { kind: 'color', card: WILD } }), 0))).toHaveLength(
      4,
    );
    const over = table({ phase: { kind: 'gameOver', winner: 0 } });
    expect(legalActions(viewFor(over, 0))).toEqual([{ type: 'again' }]);
    expect(legalActions(viewFor(over, 2))).toEqual([{ type: 'again' }]);
  });
});

describe('the decoders', () => {
  test('a dealt state and every seat’s view read back as they were sent', () => {
    const s = createState(['Ann', 'Bob', 'Cy', 'Di'], mulberry32(11), () => 7);
    expect(decodeState(viaJson(s))).toEqual({ ok: true, value: s });
    [0, 1, 2, 3].forEach((seat) => {
      const v = viewFor(s, seat);
      expect(decodeView(viaJson(v))).toEqual({ ok: true, value: v });
    });
    const phases: ReadonlyArray<Game['phase']> = [
      { kind: 'drawn', card: R7 },
      { kind: 'color', card: WILD },
      { kind: 'gameOver', winner: 1 },
    ];
    phases.forEach((phase) => {
      const t = table({ phase });
      expect(decodeState(viaJson(t))).toEqual({ ok: true, value: t });
    });
  });

  test('the five intents decode; anything else is refused', () => {
    const intents = [
      { type: 'play', id: 'r7a' },
      { type: 'color', color: 'blue' },
      { type: 'draw' },
      { type: 'pass' },
      { type: 'again' },
    ];
    intents.forEach((intent) => {
      expect(decodeAction(intent)).toEqual({ ok: true, value: intent });
    });
    expect(decodeAction({ type: 'cheat' }).ok).toBe(false);
    expect(decodeAction({ type: 'color', color: 'pink' }).ok).toBe(false);
  });
});
