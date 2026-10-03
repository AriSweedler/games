// The table (sound.ts; docs/design/sound-fonts.md §5): every event names a generic cue the
// default font voices, no two events share a cue, and the shell's four rows are SHELL_CUES byte for
// byte. The player over this table is the shared one (web/shared/edge/cuePlayer.test.ts `shellFx`);
// the boot wires it to the `backgammon_sound` key from shellConfig.ts.
import { describe, expect, test } from 'vitest';

import { SHELL_CUES, SOUND_CUES, type SoundCue } from '../../../../shared/lib/sound/cues.ts';
import { fontByName, resolveSound } from '../../../../shared/lib/sound/fonts.ts';
import { CUES, type Cue } from './sound.ts';

const EVENTS = Object.keys(CUES) as ReadonlyArray<Cue | 'tap'>;
describe('the table', () => {
  test('pins the design\'s mapping (backgammon-board.md §5.1 "Sound"; sound-fonts.md §5)', () => {
    const mapping: Readonly<Record<Cue | 'tap', SoundCue>> = {
      tap: 'tap',
      roll: 'roll',
      doubles: 'good',
      place: 'move',
      hit: 'capture',
      bearOff: 'score',
      yourTurn: 'turn',
      double: 'challenge',
      win: 'victory',
      lose: 'loss',
    };
    expect(Object.fromEntries(EVENTS.map((e) => [e, CUES[e].cue]))).toEqual(mapping);
  });

  test.each(EVENTS)('%s names a shared cue the default font voices, with a buzz', (event) => {
    const { cue, buzz } = CUES[event];
    expect(SOUND_CUES).toContain(cue);
    expect(resolveSound(fontByName('default'), cue).kind).toBe('synth');
    const pattern = typeof buzz === 'number' ? [buzz] : buzz;
    expect(pattern.length).toBeGreaterThan(0);
    pattern.forEach((ms) => {
      expect(ms).toBeGreaterThan(0);
    });
  });

  test('no two events share a cue, so a font re-voices each one apart', () => {
    expect(new Set(EVENTS.map((e) => CUES[e].cue)).size).toBe(EVENTS.length);
  });

  test("the shell's four rows are the shared SHELL_CUES, byte for byte (dry-round-2.md E9)", () => {
    // The frozen copy of what this table spelt before the rows moved to web/shared/lib.
    expect(SHELL_CUES).toStrictEqual({
      tap: { cue: 'tap', buzz: 12 },
      yourTurn: { cue: 'turn', buzz: [40, 60, 40] },
      win: { cue: 'victory', buzz: [80, 50, 80, 50, 200] },
      lose: { cue: 'loss', buzz: [200] },
    });
    (Object.keys(SHELL_CUES) as ReadonlyArray<keyof typeof SHELL_CUES>).forEach((event) => {
      expect(CUES[event]).toBe(SHELL_CUES[event]);
    });
  });
});
