// The table (sound.ts; plan §7 D11): the four rows are the shared SHELL_CUES byte for byte and
// nothing else yet (M9 adds fidice's). The player over this table is the shared one
// (web/shared/edge/cuePlayer.test.ts `shellFx`); the boot wires it to the `fidice_sound` key from
// shellConfig.ts.
import { describe, expect, test } from 'vitest';

import { SHELL_CUES, isCueId } from '../../../../shared/lib/sound/cues.ts';
import { fontByName, resolveSound } from '../../../../shared/lib/sound/fonts.ts';
import { CUES } from './sound.ts';

describe('the table', () => {
  test('the four rows are the shared SHELL_CUES, byte for byte, and nothing else yet (D11)', () => {
    expect(Object.keys(CUES)).toEqual(['tap', 'yourTurn', 'win', 'lose']);
    expect(CUES).toStrictEqual({
      tap: { cue: 'tap', buzz: 12 },
      yourTurn: { cue: 'turn', buzz: [40, 60, 40] },
      win: { cue: 'victory', buzz: [80, 50, 80, 50, 200] },
      lose: { cue: 'loss', buzz: [200] },
    });
    (Object.keys(SHELL_CUES) as ReadonlyArray<keyof typeof SHELL_CUES>).forEach((event) => {
      expect(CUES[event]).toBe(SHELL_CUES[event]);
      expect(isCueId(CUES[event].cue)).toBe(true);
      expect(resolveSound(fontByName('default'), CUES[event].cue).kind).toBe('synth');
    });
  });
});
