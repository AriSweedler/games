// The legacy pin (docs/design/sound-fonts.md §10): every gin event, played in the `default` font,
// is the legacy `fx` object's notes, voice and gain number for number, and its buzz is unchanged.
// LEGACY below is a frozen copy of the numbers (legacy/gin-rummy/index.html, then ui/sound.ts
// before the fonts), not a read of the file it checks. The player itself is the shared one
// (web/shared/edge/cuePlayer.test.ts `shellFx`); the boot wires it to the `ginRummy_sound` key
// from shellConfig.ts.
import { describe, expect, test } from 'vitest';

import type { Note, OscillatorType } from '../../../../shared/edge/fx.ts';
import { SHELL_CUES } from '../../../../shared/lib/sound/cues.ts';
import { fontByName, resolveSound } from '../../../../shared/lib/sound/fonts.ts';
import type { Cue } from './cues.ts';
import { CUES } from './sound.ts';

type Legacy = Readonly<{
  notes: ReadonlyArray<Note>;
  type: OscillatorType;
  gain: number;
  buzz: number | ReadonlyArray<number>;
}>;
const n = (freq: number, dur: number, gap?: number): Note =>
  gap === undefined ? { freq, dur } : { freq, dur, gap };

const LEGACY: Readonly<Record<Cue | 'tap', Legacy>> = {
  tap: { notes: [n(660, 0.05)], type: 'triangle', gain: 0.08, buzz: 12 },
  yourTurn: {
    notes: [n(523, 0.12, 0.13), n(784, 0.22)],
    type: 'sine',
    gain: 0.2,
    buzz: [40, 60, 40],
  },
  knockGood: {
    notes: [n(587, 0.1, 0.11), n(740, 0.1, 0.11), n(880, 0.28)],
    type: 'triangle',
    gain: 0.2,
    buzz: [30, 40, 30, 40, 60],
  },
  gin: {
    notes: [n(523, 0.09, 0.1), n(659, 0.09, 0.1), n(784, 0.09, 0.1), n(1047, 0.36)],
    type: 'triangle',
    gain: 0.22,
    buzz: [50, 50, 50, 50, 120],
  },
  bad: { notes: [n(440, 0.14, 0.15), n(330, 0.3)], type: 'sawtooth', gain: 0.09, buzz: [120] },
  neutral: { notes: [n(494, 0.18)], type: 'sine', gain: 0.12, buzz: 30 },
  win: {
    notes: [
      n(523, 0.12, 0.13),
      n(659, 0.12, 0.13),
      n(784, 0.12, 0.13),
      n(1047, 0.18, 0.2),
      n(784, 0.1, 0.11),
      n(1047, 0.45),
    ],
    type: 'triangle',
    gain: 0.22,
    buzz: [80, 50, 80, 50, 200],
  },
  lose: {
    notes: [n(392, 0.2, 0.22), n(349, 0.2, 0.22), n(294, 0.45)],
    type: 'sine',
    gain: 0.14,
    buzz: [200],
  },
  oppStock: { notes: [n(392, 0.06, 0.07), n(330, 0.09)], type: 'triangle', gain: 0.09, buzz: 15 },
  oppDiscard: { notes: [n(494, 0.06, 0.07), n(587, 0.09)], type: 'triangle', gain: 0.1, buzz: 15 },
};
const EVENTS = Object.keys(LEGACY) as ReadonlyArray<Cue | 'tap'>;
describe('the table on the default font', () => {
  test.each(EVENTS)(
    '%s: the legacy notes, voice and gain number for number; the buzz unchanged',
    (event) => {
      const legacy = LEGACY[event];
      expect(resolveSound(fontByName('default'), CUES[event].cue)).toStrictEqual({
        kind: 'synth',
        notes: legacy.notes,
        voice: legacy.type,
        gain: legacy.gain,
      });
      expect(CUES[event].buzz).toEqual(legacy.buzz);
    },
  );

  test('ten events onto ten distinct generic cues', () => {
    expect(EVENTS).toHaveLength(10);
    expect(new Set(Object.values(CUES).map((s) => s.cue)).size).toBe(10);
  });

  test("the shell's four rows are the shared SHELL_CUES, byte for byte (dry-round-2.md E9)", () => {
    const shell = ['tap', 'yourTurn', 'win', 'lose'] as const;
    expect(Object.keys(SHELL_CUES)).toEqual(shell);
    expect(shell.map((event) => SHELL_CUES[event].cue)).toEqual(['tap', 'turn', 'victory', 'loss']);
    shell.forEach((event) => {
      expect(SHELL_CUES[event].buzz).toEqual(LEGACY[event].buzz);
      expect(CUES[event]).toBe(SHELL_CUES[event]);
    });
  });
});
