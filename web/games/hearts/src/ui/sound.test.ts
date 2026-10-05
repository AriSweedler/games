// Hearts's cue table and its binding (docs/design/sound-fonts.md §5): every row names a cue the
// default font voices, with a buzz; the shell's four rows are the shared ones byte for byte; and
// `cuesBetween` pins one cue per moment over hand-built positions: a card laid, a trick gathered
// quietly, the hearts and the queen heard as the bad notice on the device whose pile they landed
// in, a seat's pass, the hand's end, the moon, the deal, the win and the loss, and nothing on a
// repaint.
import { describe, expect, test } from 'vitest';

import { SHELL_CUES, baseOf, isCueId } from '../../../../shared/lib/sound/cues.ts';
import { fontByName, resolveSound } from '../../../../shared/lib/sound/fonts.ts';
import { DEFAULT_SOUNDS } from '../../../../shared/lib/sound/fonts/default.ts';
import type { TrickResult } from '../engine/engine.ts';
import type { View } from '../engine/view.ts';
import { CUES, cuesBetween, type Cue } from './sound.ts';

const EVENTS = Object.keys(CUES) as ReadonlyArray<Cue | 'tap'>;

// ---- the table -------------------------------------------------------------------------------

describe('the table', () => {
  test('pins the mapping (docs/design/hearts.md §7)', () => {
    const mapping: Readonly<Record<Cue | 'tap', string>> = {
      tap: 'tap',
      yourTurn: 'turn',
      win: 'victory',
      lose: 'loss',
      pass: 'move.pass',
      play: 'move',
      trick: 'pickup',
      points: 'bad.points',
      queen: 'bad.queen',
      moon: 'great',
      handOver: 'neutral.hand',
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

  test('the queen is the louder bad notice: a longer buzz than the hearts', () => {
    const total = (buzz: number | ReadonlyArray<number>): number =>
      typeof buzz === 'number' ? buzz : buzz.reduce((a, b) => a + b, 0);
    expect(baseOf(CUES.queen.cue)).toBe('bad');
    expect(baseOf(CUES.points.cue)).toBe('bad');
    expect(total(CUES.queen.buzz)).toBeGreaterThan(total(CUES.points.buzz));
  });

  test("the shell's four rows are the shared SHELL_CUES (dry-round-2.md E9)", () => {
    (Object.keys(SHELL_CUES) as ReadonlyArray<keyof typeof SHELL_CUES>).forEach((event) => {
      expect(CUES[event]).toBe(SHELL_CUES[event]);
    });
  });
});

// ---- positions -------------------------------------------------------------------------------

const NAMES = ['Ann', 'Bob', 'Cat', 'Dan'];

/** Seat 0's view of a hand in play, nothing on the table yet; the fields a case changes are overridden. */
const view = (over: Partial<View> = {}): View => ({
  seat: 0,
  names: NAMES,
  phase: 'playing',
  round: 1,
  direction: 'left',
  hand: ['2C', '5D', 'KS'],
  counts: [3, 3, 3, 3],
  passed: [false, false, false, false],
  myPass: null,
  trick: { leader: 0, plays: [] },
  lastTrick: null,
  heartsBroken: false,
  turn: 0,
  scores: [0, 0, 0, 0],
  handScores: null,
  moon: null,
  winners: [],
  legal: [],
  note: '',
  startedAt: 77,
  ...over,
});

const PLAIN_TRICK: TrickResult = {
  leader: 1,
  plays: [
    { seat: 1, card: '9D' },
    { seat: 2, card: 'KD' },
    { seat: 3, card: '3D' },
    { seat: 0, card: '4D' },
  ],
  taker: 2,
  points: 0,
};
const HEARTS_TRICK: TrickResult = {
  leader: 1,
  plays: [
    { seat: 1, card: '9D' },
    { seat: 2, card: '7H' },
    { seat: 3, card: '3D' },
    { seat: 0, card: 'AD' },
  ],
  taker: 0,
  points: 1,
};
const QUEEN_TRICK: TrickResult = {
  ...HEARTS_TRICK,
  plays: [...HEARTS_TRICK.plays.slice(0, 2), { seat: 3, card: 'QS' }, { seat: 0, card: 'AD' }],
  points: 14,
};

describe('cuesBetween', () => {
  test('a repaint plays nothing', () => {
    const v = view();
    expect(cuesBetween(v, v)).toEqual([]);
  });

  test('a card laid is a play, by any seat', () => {
    const before = view({ turn: 1 });
    const after = view({
      turn: 2,
      counts: [3, 2, 3, 3],
      trick: { leader: 1, plays: [{ seat: 1, card: '9D' }] },
    });
    expect(cuesBetween(before, after)).toEqual(['play']);
  });

  test("a seat's pass chosen is the pass, mine or another's", () => {
    const before = view({ phase: 'passing', turn: null });
    const mine = view({
      phase: 'passing',
      turn: null,
      passed: [true, false, false, false],
      myPass: ['KS', '5D', '2C'],
      counts: [0, 3, 3, 3],
    });
    const theirs = view({
      phase: 'passing',
      turn: null,
      passed: [true, true, false, false],
      myPass: ['KS', '5D', '2C'],
      counts: [0, 0, 3, 3],
    });
    expect(cuesBetween(before, mine)).toEqual(['pass']);
    expect(cuesBetween(mine, theirs)).toEqual(['pass']);
  });

  test('a trick gathered with no points is the quiet gather, and so are points in another pile', () => {
    const full = view({ trick: { leader: 1, plays: PLAIN_TRICK.plays.slice(0, 3) } });
    expect(cuesBetween(full, view({ lastTrick: PLAIN_TRICK, turn: 2 }))).toEqual(['trick']);
    const theirs: TrickResult = { ...HEARTS_TRICK, taker: 2 };
    expect(cuesBetween(full, view({ lastTrick: theirs, turn: 2 }))).toEqual(['trick']);
  });

  test('hearts landed in my pile are the bad notice; the queen in my pile the louder one', () => {
    const full = view({ trick: { leader: 1, plays: HEARTS_TRICK.plays.slice(0, 3) } });
    expect(cuesBetween(full, view({ lastTrick: HEARTS_TRICK, heartsBroken: true }))).toEqual([
      'points',
    ]);
    expect(cuesBetween(full, view({ lastTrick: QUEEN_TRICK }))).toEqual(['queen']);
    // The same trick on another seat's device: the quiet gather.
    expect(cuesBetween({ ...full, seat: 1 }, view({ seat: 1, lastTrick: QUEEN_TRICK }))).toEqual([
      'trick',
    ]);
  });

  test("a hand's end is the scores' notice, or the moon when shot, once", () => {
    const last = view({
      counts: [0, 0, 0, 1],
      trick: { leader: 1, plays: PLAIN_TRICK.plays.slice(0, 3) },
    });
    const ended = view({
      phase: 'handOver',
      counts: [0, 0, 0, 0],
      lastTrick: HEARTS_TRICK,
      turn: null,
      handScores: [1, 13, 6, 6],
      scores: [1, 13, 6, 6],
    });
    expect(cuesBetween(last, ended)).toEqual(['handOver']);
    const shot = view({ ...ended, moon: 2, handScores: [26, 26, 0, 26], scores: [26, 26, 0, 26] });
    expect(cuesBetween(last, shot)).toEqual(['moon']);
    expect(cuesBetween(ended, ended)).toEqual([]);
    expect(cuesBetween(shot, shot)).toEqual([]);
  });

  test('the next hand dealt and a new game are the deal', () => {
    const ended = view({
      phase: 'handOver',
      counts: [0, 0, 0, 0],
      turn: null,
      handScores: [1, 13, 6, 6],
      scores: [1, 13, 6, 6],
    });
    const dealt = view({
      phase: 'passing',
      round: 2,
      direction: 'right',
      turn: null,
      scores: [1, 13, 6, 6],
    });
    expect(cuesBetween(ended, dealt)).toEqual(['deal']);
    const fresh = view({ phase: 'passing', turn: null, startedAt: 99 });
    expect(cuesBetween(view({ phase: 'gameOver' }), fresh)).toEqual(['deal']);
  });

  test('the game over is the win for a seat on the lowest score and the loss for the rest; a moon on the last hand sounds first', () => {
    const last = view({ scores: [90, 40, 60, 70] });
    const won = view({
      phase: 'gameOver',
      turn: null,
      scores: [91, 105, 60, 70],
      handScores: [1, 65, 0, 0],
      winners: [2],
    });
    expect(cuesBetween(last, won)).toEqual(['lose']);
    expect(cuesBetween({ ...last, seat: 2 }, { ...won, seat: 2 })).toEqual(['win']);
    const shot = view({
      ...won,
      moon: 0,
      scores: [90, 66, 86, 96],
      handScores: [0, 26, 26, 26],
      winners: [1],
    });
    expect(cuesBetween(last, shot)).toEqual(['moon', 'lose']);
    expect(cuesBetween({ ...last, seat: 1 }, { ...shot, seat: 1 })).toEqual(['moon', 'win']);
  });
});
