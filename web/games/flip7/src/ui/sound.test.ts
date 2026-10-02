// Flip 7's cue table and its binding (docs/design/sounds.md "Flip 7"): every row names a cue the
// default font voices, with a buzz; the shell's four rows are the shared ones byte for byte; and
// `cuesBetween` pins the cues per moment over hand-built views: a flip, a modifier, a Second
// Chance taken and spent, a bust, a Freeze, a Flip Three, a stay, a Flip 7, the round settled, the
// new round's deal, the game's end on each device, and nothing on a repaint. `cueKey` tells two
// positions apart and a repaint from a move.
import { describe, expect, test } from 'vitest';

import { SHELL_CUES, baseOf, isCueId } from '../../../../shared/lib/sound/cues.ts';
import { fontByName, resolveSound } from '../../../../shared/lib/sound/fonts.ts';
import { DEFAULT_SOUNDS } from '../../../../shared/lib/sound/fonts/default.ts';
import type { Card } from '../engine/cards.ts';
import type { Seat } from '../engine/engine.ts';
import type { View } from '../engine/index.ts';
import { CUES, cueKey, cuesBetween, type Cue } from './sound.ts';

const EVENTS = Object.keys(CUES) as ReadonlyArray<Cue | 'tap'>;

// ---- the table -------------------------------------------------------------------------------

describe('the table', () => {
  test('pins the mapping (docs/design/sounds.md "Flip 7")', () => {
    const mapping: Readonly<Record<Cue | 'tap', string>> = {
      tap: 'tap',
      yourTurn: 'turn',
      win: 'victory',
      lose: 'loss',
      flip: 'draw',
      modifier: 'score.modifier',
      second: 'good.second',
      save: 'good.save',
      bust: 'bad.bust',
      freeze: 'neutral.freeze',
      flipThree: 'challenge.flip3',
      stay: 'score.stay',
      flip7: 'great.flip7',
      roundOver: 'neutral.round',
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

  test("the shell's four rows are the shared SHELL_CUES (dry-round-2.md E9)", () => {
    (Object.keys(SHELL_CUES) as ReadonlyArray<keyof typeof SHELL_CUES>).forEach((event) => {
      expect(CUES[event]).toBe(SHELL_CUES[event]);
    });
  });
});

// ---- views -----------------------------------------------------------------------------------

const num = (value: number, copy = 1): Card => ({
  id: `n${String(value)}-${String(copy)}`,
  kind: 'number',
  value,
});
const PLUS4: Card = { id: 'plus4', kind: 'plus', value: 4 };
const X2: Card = { id: 'times2', kind: 'times2', value: null };
const SECOND: Card = { id: 'second-1', kind: 'second', value: null };
const FREEZE: Card = { id: 'freeze-1', kind: 'freeze', value: null };

const seat = (
  name: string,
  line: ReadonlyArray<Card> = [],
  status: Seat['status'] = 'active',
): Seat => ({
  name,
  line,
  status,
});

/** Ann (0) to act with a 3 and a 7 down; Bob (1) and Cy (2) wait with one card each; round 2 of a game. */
const base: View = {
  seats: [seat('Ann', [num(3), num(7)]), seat('Bob', [num(5)]), seat('Cy', [num(9)])],
  dealer: 2,
  turn: 0,
  opening: 0,
  flip3: null,
  pending: [],
  phase: { kind: 'turn' },
  scores: [40, 12, 25],
  target: 200,
  round: 2,
  note: '',
  me: 0,
  drawCount: 60,
  discardCount: 10,
  startedAt: 42,
};

const withSeat = (v: View, i: number, s: Seat): View => ({
  ...v,
  seats: v.seats.map((old, j) => (j === i ? s : old)),
});

const ann = (line: ReadonlyArray<Card>, status: Seat['status'] = 'active', v: View = base): View =>
  withSeat(
    { ...v, drawCount: v.drawCount - (line.length - (v.seats[0]?.line.length ?? 0)) },
    0,
    seat('Ann', line, status),
  );

// ---- cuesBetween -----------------------------------------------------------------------------

describe('cuesBetween', () => {
  test('a repaint of the same position plays nothing, and its key stands', () => {
    expect(cuesBetween(base, base, false)).toEqual([]);
    expect(cueKey(base)).toBe(cueKey({ ...base, note: 'anything' }));
  });

  test('a number flipped into a line is a flip; a modifier its own row', () => {
    expect(cuesBetween(base, ann([num(3), num(7), num(11)]), false)).toEqual(['flip']);
    expect(cuesBetween(base, ann([num(3), num(7), PLUS4]), false)).toEqual(['modifier']);
    expect(cuesBetween(base, ann([num(3), num(7), X2]), false)).toEqual(['modifier']);
  });

  test('every device hears the table: the same flip on each seat`s view', () => {
    const after = ann([num(3), num(7), num(11)]);
    [0, 1, 2].forEach((me) => {
      expect(cuesBetween({ ...base, me }, { ...after, me }, false)).toEqual(['flip']);
    });
  });

  test('a Second Chance taken is its row; spent on a duplicate it is the save, and the seat plays on', () => {
    const held = ann([num(3), num(7), SECOND]);
    expect(cuesBetween(base, held, false)).toEqual(['second']);
    // Another 7: the Second Chance and the duplicate go to the discards; the line keeps its numbers.
    const spent: View = {
      ...withSeat(held, 0, seat('Ann', [num(3), num(7)])),
      discardCount: 12,
      drawCount: held.drawCount - 1,
    };
    expect(cuesBetween(held, spent, false)).toEqual(['save']);
  });

  test('a duplicate with no Second Chance busts: the card stays on the table and the seat is out', () => {
    const busted = ann([num(3), num(7), num(7, 2)], 'busted');
    expect(cuesBetween(base, busted, false)).toEqual(['flip', 'bust']);
  });

  test('a stay banks the line; a Freeze given does the same for its taker', () => {
    expect(cuesBetween(base, ann([num(3), num(7)], 'stayed'), false)).toEqual(['stay']);
    // Ann flipped a Freeze (pending), then gave it to Bob: his status flips, the card is discarded.
    const pending: View = {
      ...base,
      pending: [{ card: FREEZE, from: 0 }],
      phase: { kind: 'target', card: FREEZE, from: 0, choices: [1, 2] },
    };
    expect(cuesBetween(base, pending, false)).toEqual([]);
    const frozen: View = withSeat(
      { ...pending, pending: [], phase: { kind: 'turn' }, turn: 1 },
      1,
      seat('Bob', [num(5)], 'frozen'),
    );
    expect(cuesBetween(pending, frozen, false)).toEqual(['freeze']);
  });

  test('a Flip Three lands two or three cards in one step: the challenge, then each card', () => {
    const three = ann([num(3), num(7), num(1), PLUS4, num(12)]);
    expect(cuesBetween(base, three, false)).toEqual(['flipThree', 'flip', 'modifier', 'flip']);
    // …and a bust on the second card ends it early: two cards, the bust.
    const bustedEarly = ann([num(3), num(7), num(1), num(3, 2)], 'busted');
    expect(cuesBetween(base, bustedEarly, false)).toEqual(['flipThree', 'flip', 'flip', 'bust']);
  });

  test('seven distinct numbers: the flip, the Flip 7, and the round settles', () => {
    const six = ann([num(1), num(2), num(3), num(4), num(5), num(6)]);
    const seven = {
      ...ann([num(1), num(2), num(3), num(4), num(5), num(6), num(7)], 'flip7', six),
      phase: { kind: 'roundOver' } as const,
      scores: [40 + 28 + 15, 12 + 5, 25 + 9],
    };
    expect(cuesBetween(six, seven, false)).toEqual(['flip', 'flip7', 'roundOver']);
  });

  test('the round settled by the last stay is the stay then the round`s notice', () => {
    const others = withSeat(
      withSeat(base, 1, seat('Bob', [num(5)], 'stayed')),
      2,
      seat('Cy', [num(9)], 'busted'),
    );
    const settled: View = {
      ...ann([num(3), num(7)], 'stayed', others),
      phase: { kind: 'roundOver' },
      scores: [50, 17, 25],
    };
    expect(cuesBetween(others, settled, false)).toEqual(['stay', 'roundOver']);
  });

  test('the next round is the deal: lines cleared, statuses back to active, nothing else sounds', () => {
    const over: View = {
      ...base,
      phase: { kind: 'roundOver' },
      seats: [
        seat('Ann', [num(3)], 'stayed'),
        seat('Bob', [], 'busted'),
        seat('Cy', [num(9)], 'frozen'),
      ],
    };
    const dealt: View = {
      ...base,
      round: 3,
      dealer: 0,
      turn: 1,
      opening: 3,
      seats: [seat('Ann'), seat('Bob', [num(2)]), seat('Cy')],
    };
    expect(cuesBetween(over, dealt, false)).toEqual(['deal']);
    expect(cuesBetween(base, { ...base, startedAt: 43, round: 1 }, false)).toEqual(['deal']);
  });

  test('the game won: the win on the winner`s device, the loss on the others`, the win on the shared phone', () => {
    const final: View = {
      ...ann([num(3), num(7)], 'stayed'),
      phase: { kind: 'gameOver', winner: 0 },
      scores: [205, 12, 25],
    };
    expect(cuesBetween(base, final, false)).toEqual(['stay', 'win']);
    expect(cuesBetween({ ...base, me: 1 }, { ...final, me: 1 }, false)).toEqual(['stay', 'lose']);
    expect(cuesBetween({ ...base, me: 1 }, { ...final, me: 1 }, true)).toEqual(['stay', 'win']);
  });

  test('cueKey tells a flip, a status change, a gift and the round apart', () => {
    const keys = [
      base,
      ann([num(3), num(7), num(11)]),
      ann([num(3), num(7)], 'stayed'),
      { ...base, pending: [{ card: FREEZE, from: 0 }] },
      { ...base, round: 3 },
    ].map(cueKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
