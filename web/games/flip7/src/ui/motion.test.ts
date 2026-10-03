// Flip 7's anticipation (ui/motion.ts): the clock and its reduced-motion stills, the reveal beat
// for the sound row, the plan of a paint's moments against the table the last paint left (the
// cards new to a seat staggered to the cap, the bust card and its seat, the Flip 7, the scores
// coming up; nothing for a repaint, no bust or bonus on a cold paint), and the two DOM steps over
// the page fake: the table read back by seat index and tile id, the clock written on the root.
import { describe, expect, test } from 'vitest';

import { fakeEl, fakePage, type FakeEl } from '../../../../shared/edge/page.fake.ts';
import type { Card } from '../engine/cards.ts';
import type { Seat, Status, View } from '../engine/index.ts';
import {
  CLOCK_VARS,
  DURATIONS,
  MAX_STAGGER,
  NOTHING_PAINTED,
  NO_MOMENTS,
  REDUCED_DURATIONS,
  durationsFor,
  moments,
  readPainted,
  revealAtMs,
  writeClock,
  type Painted,
} from './motion.ts';

const n = (id: string, value: number): Card => ({ id, kind: 'number', value });
const seat = (name: string, line: ReadonlyArray<Card>, status: Status = 'active'): Seat => ({
  name,
  line,
  status,
});
const view = (seats: ReadonlyArray<Seat>, phase: View['phase'] = { kind: 'turn' }): View => ({
  seats,
  dealer: 0,
  turn: 0,
  opening: 0,
  flip3: null,
  pending: [],
  phase,
  scores: seats.map(() => 0),
  target: 200,
  round: 1,
  note: '',
  me: 0,
  drawCount: 80,
  discardCount: 0,
  startedAt: 1,
});
const painted = (
  seats: ReadonlyArray<readonly [number, Status | null, ReadonlyArray<string>]>,
  resultShown = false,
): Painted => ({
  seats: seats.map(([s, status, cards]) => ({ seat: s, status, cards })),
  resultShown,
});

describe('the clock', () => {
  test('the design figures, and 1 ms turns with no stagger and a 300 ms still under reduced motion', () => {
    expect(DURATIONS).toEqual({
      flipMs: 360,
      gapMs: 140,
      landMs: 280,
      beatMs: 720,
      rowMs: 260,
      rowGapMs: 90,
      glowMs: 900,
    });
    expect(REDUCED_DURATIONS).toEqual({
      flipMs: 1,
      gapMs: 0,
      landMs: 1,
      beatMs: 300,
      rowMs: 1,
      rowGapMs: 0,
      glowMs: 1,
    });
    expect(durationsFor(false)).toBe(DURATIONS);
    expect(durationsFor(true)).toBe(REDUCED_DURATIONS);
    // The beat holds the flip and the landing: the pause never rises over a card still turning.
    expect(DURATIONS.beatMs).toBeGreaterThanOrEqual(DURATIONS.flipMs + DURATIONS.landMs);
  });

  test('revealAtMs: the face shows at the turn`s midpoint, a gap later per card up to the cap; at once under reduced motion', () => {
    expect(revealAtMs(0, DURATIONS)).toBe(180);
    expect(revealAtMs(2, DURATIONS)).toBe(2 * 140 + 180);
    expect(revealAtMs(MAX_STAGGER + 5, DURATIONS)).toBe(revealAtMs(MAX_STAGGER, DURATIONS));
    expect(revealAtMs(3, REDUCED_DURATIONS)).toBe(0.5);
  });
});

describe('moments', () => {
  const a = seat('Ari', [n('n5-1', 5), n('n9-1', 9)]);
  const b = seat('Lavi', [n('n3-1', 3)]);

  test('a repaint of the same table: nothing', () => {
    const v = view([a, b]);
    const prev = painted([
      [0, 'active', ['n5-1', 'n9-1']],
      [1, 'active', ['n3-1']],
    ]);
    const m = moments(prev, v);
    expect([...m.dealt]).toEqual([]);
    expect(m.bustCards.size + m.busting.size + m.flip7.size).toBe(0);
    expect(m.scores).toBe(false);
    expect(NO_MOMENTS.dealt.size).toBe(0);
  });

  test('a hit: the one new card is dealt first in the stagger; a seat that moved to the foreground keeps its cards', () => {
    const v = view([seat('Ari', [...a.line, n('n2-1', 2)]), b]);
    // The last paint showed Ari in the background grid: the index, not the place, keys the seat.
    const m = moments(
      painted([
        [1, 'active', ['n3-1']],
        [0, 'active', ['n5-1', 'n9-1']],
      ]),
      v,
    );
    expect([...m.dealt]).toEqual([['n2-1', 0]]);
    expect(m.busting.size).toBe(0);
  });

  test('a cold paint (no seats before): every card deals in, staggered in seat then line order to the cap; no bust, no bonus', () => {
    const busted = seat('Lavi', [n('n3-1', 3), n('n3-2', 3)], 'busted');
    const many = seat(
      'Sandro',
      Array.from({ length: 9 }, (_, i) => n(`c${String(i)}`, i)),
      'flip7',
    );
    const m = moments(NOTHING_PAINTED, view([a, busted, many]));
    expect([...m.dealt].slice(0, 5)).toEqual([
      ['n5-1', 0],
      ['n9-1', 1],
      ['n3-1', 2],
      ['n3-2', 3],
      ['c0', 4],
    ]);
    expect(m.dealt.get('c8')).toBe(MAX_STAGGER);
    expect(m.dealt.size).toBe(13);
    expect(m.busting.size).toBe(0);
    expect(m.bustCards.size).toBe(0);
    expect(m.flip7.size).toBe(0);
  });

  test('a bust: the seat that was alive is busting and its last, new card is the bust card; a seat already busted is neither', () => {
    const v = view([
      seat('Ari', [...a.line, n('n5-2', 5)], 'busted'),
      seat('Lavi', [n('n3-1', 3), n('n3-2', 3)], 'busted'),
    ]);
    const m = moments(
      painted([
        [0, 'active', ['n5-1', 'n9-1']],
        [1, 'busted', ['n3-1', 'n3-2']],
      ]),
      v,
    );
    expect([...m.busting]).toEqual([0]);
    expect([...m.bustCards]).toEqual(['n5-2']);
    expect([...m.dealt]).toEqual([['n5-2', 0]]);
    // A seat whose status the DOM did not carry (null) is not newly anything.
    const cold = moments(painted([[0, null, ['n5-1', 'n9-1']]]), v);
    expect(cold.busting.size).toBe(0);
    expect(cold.bustCards.size).toBe(0);
  });

  test('a Flip 7: the seat that reached it this paint, and the round`s end brings the scores up once', () => {
    const seven = seat(
      'Ari',
      Array.from({ length: 7 }, (_, i) => n(`c${String(i)}`, i + 1)),
      'flip7',
    );
    const prev = painted([
      [0, 'active', ['c0', 'c1', 'c2', 'c3', 'c4', 'c5']],
      [1, 'stayed', ['n3-1']],
    ]);
    const m = moments(prev, view([seven, seat('Lavi', b.line, 'stayed')], { kind: 'roundOver' }));
    expect([...m.flip7]).toEqual([0]);
    expect([...m.dealt]).toEqual([['c6', 0]]);
    expect(m.scores).toBe(true);
    // The panel already up: the rows do not reveal again; a seat already at Flip 7 is not new to it.
    const again = moments({ ...prev, resultShown: true }, view([seven], { kind: 'roundOver' }));
    expect(again.scores).toBe(false);
    const still = moments(painted([[0, 'flip7', seven.line.map((c) => c.id)]]), view([seven]));
    expect(still.flip7.size).toBe(0);
    expect(moments(prev, view([a, b], { kind: 'gameOver', winner: 0 })).scores).toBe(true);
    expect(moments(prev, view([a, b])).scores).toBe(false);
  });
});

describe('the DOM steps', () => {
  const tiles = (ids: ReadonlyArray<string>): ReadonlyArray<FakeEl> =>
    ids.map((id) => fakeEl(`tile-${id}`, { classes: ['tile'], attrs: { 'data-card': id } }));
  const seatEl = (id: string, index: string, status: string, ids: ReadonlyArray<string>): FakeEl =>
    fakeEl(id, {
      classes: ['seat', `status-${status}`],
      attrs: { 'data-seat': index },
      queries: { '.tile': tiles(ids) },
    });

  test('readPainted: every seat under #seats by index with its status and tile ids, and whether the result is up', () => {
    const mine = seatEl('mySeat', '0', 'active', ['n5-1', 'n9-1']);
    const other = seatEl('li1', '1', 'busted', ['n3-1']);
    const unkeyed = fakeEl('li2', { classes: ['seat'], queries: { '.tile': tiles(['x']) } });
    const seats = fakeEl('seats', { queries: { '.seat[data-seat]': [other, mine, unkeyed] } });
    const result = fakeEl('resultOverlay', { classes: ['overlay', 'hidden'] });
    const page = fakePage([seats, result]);
    expect(readPainted(page.doc)).toEqual({
      seats: [
        { seat: 1, status: 'busted', cards: ['n3-1'] },
        { seat: 0, status: 'active', cards: ['n5-1', 'n9-1'] },
      ],
      resultShown: false,
    });
    const shown = fakePage([fakeEl('seats'), fakeEl('resultOverlay', { classes: ['overlay'] })]);
    expect(readPainted(shown.doc)).toEqual({ seats: [], resultShown: true });
  });

  test('writeClock: one --f7-*-ms per duration on the root', () => {
    const set: Record<string, string> = {};
    const doc = {
      getElementById: () => null,
      documentElement: {
        style: {
          setProperty: (p: string, v: string) => {
            set[p] = v;
          },
        },
      },
    };
    writeClock(doc, DURATIONS);
    expect(set).toEqual({
      '--f7-flip-ms': '360ms',
      '--f7-gap-ms': '140ms',
      '--f7-land-ms': '280ms',
      '--f7-beat-ms': '720ms',
      '--f7-row-ms': '260ms',
      '--f7-row-gap-ms': '90ms',
      '--f7-glow-ms': '900ms',
    });
    expect(Object.values(CLOCK_VARS).sort()).toEqual(Object.keys(set).sort());
    // A root without a style (the page fake): nothing thrown, nothing written.
    writeClock(fakePage([]).doc, REDUCED_DURATIONS);
  });
});
