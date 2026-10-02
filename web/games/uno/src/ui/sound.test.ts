// UNO's cue table and its binding (docs/design/sounds.md "UNO"): every row names a cue the
// default font voices, with a buzz; the shell's four rows are the shared ones byte for byte; and
// `cuesBetween` pins one cue per moment over hand-built positions: a number played, each action
// card, the Draw Two and the Wild Draw Four heard as the penalty on the device that took the
// cards, a draw by any seat, the deal, the win and the loss, and nothing on a repaint.
import { describe, expect, test } from 'vitest';

import { SHELL_CUES, baseOf, isCueId } from '../../../../shared/lib/sound/cues.ts';
import { fontByName, resolveSound } from '../../../../shared/lib/sound/fonts.ts';
import { DEFAULT_SOUNDS } from '../../../../shared/lib/sound/fonts/default.ts';
import type { Card, Color, Kind } from '../engine/cards.ts';
import type { Game } from '../engine/engine.ts';
import { viewFor, type State, type View } from '../engine/view.ts';
import { CUES, cuesBetween, type Cue } from './sound.ts';

const EVENTS = Object.keys(CUES) as ReadonlyArray<Cue | 'tap'>;

// ---- the table -------------------------------------------------------------------------------

describe('the table', () => {
  test('pins the mapping (docs/design/sounds.md "UNO")', () => {
    const mapping: Readonly<Record<Cue | 'tap', string>> = {
      tap: 'tap',
      yourTurn: 'turn',
      win: 'victory',
      lose: 'loss',
      play: 'move',
      draw: 'draw',
      skip: 'neutral.skip',
      reverse: 'neutral.reverse',
      draw2: 'challenge.draw2',
      wild: 'move.wild',
      wild4: 'challenge.wild4',
      penalty: 'bad.penalty',
      deal: 'start.deal',
    };
    expect(Object.fromEntries(EVENTS.map((e) => [e, CUES[e].cue]))).toEqual(mapping);
  });

  test.each(EVENTS)('%s is a cue id the default font voices at its base, with a buzz', (event) => {
    const { cue, buzz } = CUES[event];
    expect(isCueId(cue)).toBe(true);
    const sound = resolveSound(fontByName('default'), cue);
    expect(sound).toBe(DEFAULT_SOUNDS[baseOf(cue)]);
    expect(sound.kind).toBe('synth');
    const pattern = typeof buzz === 'number' ? [buzz] : buzz;
    expect(pattern.length).toBeGreaterThan(0);
    pattern.forEach((ms) => {
      expect(ms).toBeGreaterThan(0);
    });
  });

  test('no two rows share an id, so a font voices each moment apart', () => {
    expect(new Set(EVENTS.map((e) => CUES[e].cue)).size).toBe(EVENTS.length);
  });

  test('a draw falls off the face-down stock; a play is the tock of a card laid', () => {
    expect(CUES.draw.cue).toBe('draw');
    expect(CUES.play.cue).toBe('move');
  });

  test("the shell's four rows are the shared SHELL_CUES (dry-round-2.md E9)", () => {
    (Object.keys(SHELL_CUES) as ReadonlyArray<keyof typeof SHELL_CUES>).forEach((event) => {
      expect(CUES[event]).toBe(SHELL_CUES[event]);
    });
  });
});

// ---- positions -------------------------------------------------------------------------------

const card = (id: string, color: Color | null, kind: Kind, value: number | null): Card => ({
  id,
  color,
  kind,
  value,
});

const R5 = card('r5a', 'red', 'number', 5);
const R7 = card('r7a', 'red', 'number', 7);
const G9 = card('g9a', 'green', 'number', 9);
const B2 = card('b2a', 'blue', 'number', 2);
const SKIP = card('rsk', 'red', 'skip', null);
const REV = card('rrv', 'red', 'reverse', null);
const D2 = card('rd2', 'red', 'draw2', null);
const WILD = card('w1', null, 'wild', null);
const W4 = card('w4a', null, 'wild4', null);

/** Ann (seat 0) has just played on a red 5; Bob (1) and Cy (2) wait. */
const position = (over: Partial<Game> = {}): State => ({
  startedAt: 42,
  game: {
    names: ['Ann', 'Bob', 'Cy'],
    hands: [
      [R7, B2, WILD],
      [G9, B2],
      [B2, G9],
    ],
    draw: [G9, B2, R7, G9, B2, R7],
    discard: [R5],
    color: 'red',
    turn: 1,
    direction: 1,
    phase: { kind: 'turn' },
    note: '',
    ...over,
  },
});

const before = position();
const view = (state: State, seat: number): View => viewFor(state, seat);

/** Ann laid `top` on the red 5 (her hand one card shorter); `rest` adjusts the position after it. */
const laid = (top: Card, rest: Partial<Game> = {}): State =>
  position({
    discard: [R5, top],
    hands: [
      [B2, WILD],
      [G9, B2],
      [B2, G9],
    ],
    ...rest,
  });

// ---- cuesBetween -----------------------------------------------------------------------------

describe('cuesBetween', () => {
  test('a repaint of the same position plays nothing', () => {
    expect(cuesBetween(view(before, 0), view(before, 0))).toEqual([]);
    expect(cuesBetween(view(before, 1), view(before, 1))).toEqual([]);
  });

  test('a number laid is a play, heard by every seat', () => {
    const after = laid(R7);
    [0, 1, 2].forEach((seat) => {
      expect(cuesBetween(view(before, seat), view(after, seat))).toEqual(['play']);
    });
  });

  test('a Skip and a Reverse are their own notices', () => {
    expect(cuesBetween(view(before, 1), view(laid(SKIP, { turn: 2 }), 1))).toEqual(['skip']);
    expect(cuesBetween(view(before, 1), view(laid(REV, { direction: -1, turn: 2 }), 1))).toEqual([
      'reverse',
    ]);
  });

  test('a Draw Two stings the table, and is the penalty on the device whose hand took the two', () => {
    // Bob (seat 1) draws two and is skipped: Cy is next.
    const after = laid(D2, {
      hands: [
        [B2, WILD],
        [G9, B2, R7, G9],
        [B2, G9],
      ],
      turn: 2,
    });
    expect(cuesBetween(view(before, 0), view(after, 0))).toEqual(['draw2']);
    expect(cuesBetween(view(before, 2), view(after, 2))).toEqual(['draw2']);
    expect(cuesBetween(view(before, 1), view(after, 1))).toEqual(['penalty']);
  });

  test('a Wild laid waits for its colour: one row at the play, nothing when a plain Wild is coloured', () => {
    const played = laid(WILD, { phase: { kind: 'color', card: WILD }, turn: 0 });
    expect(cuesBetween(view(before, 1), view(played, 1))).toEqual(['wild']);
    const coloured = laid(WILD, { color: 'blue', turn: 1 });
    expect(cuesBetween(view(played, 1), view(coloured, 1))).toEqual([]);
  });

  test('a Wild Draw Four: the play, then the colour named deals the four (the penalty to the taker)', () => {
    const played = laid(W4, { phase: { kind: 'color', card: W4 }, turn: 0 });
    expect(cuesBetween(view(before, 2), view(played, 2))).toEqual(['wild']);
    // Blue named: Bob draws four and is skipped; Cy is next.
    const named = laid(W4, {
      color: 'blue',
      hands: [
        [B2, WILD],
        [G9, B2, R7, G9, B2, R7],
        [B2, G9],
      ],
      turn: 2,
    });
    expect(cuesBetween(view(played, 0), view(named, 0))).toEqual(['wild4']);
    expect(cuesBetween(view(played, 2), view(named, 2))).toEqual(['wild4']);
    expect(cuesBetween(view(played, 1), view(named, 1))).toEqual(['penalty']);
  });

  test('one card off the stock is a draw, whoever drew it', () => {
    const drew = position({
      draw: [G9, B2, R7, G9, B2],
      hands: [
        [R7, B2, WILD],
        [G9, B2, R7],
        [B2, G9],
      ],
    });
    [0, 1, 2].forEach((seat) => {
      expect(cuesBetween(view(before, seat), view(drew, seat))).toEqual(['draw']);
    });
  });

  test('the game won is the win on the winner`s device and the loss on the others`', () => {
    const won = laid(R7, {
      hands: [[], [G9, B2], [B2, G9]],
      phase: { kind: 'gameOver', winner: 0 },
    });
    expect(cuesBetween(view(before, 0), view(won, 0))).toEqual(['win']);
    expect(cuesBetween(view(before, 1), view(won, 1))).toEqual(['lose']);
    // Pass-and-play: the view is the holder's, and the engine hands it to the winner.
    expect(cuesBetween(view(before, 2), view(won, 2))).toEqual(['lose']);
  });

  test('Play again is the deal, whatever else changed', () => {
    const again: State = { ...position({ discard: [G9] }), startedAt: 43 };
    expect(cuesBetween(view(before, 1), view(again, 1))).toEqual(['deal']);
  });
});
