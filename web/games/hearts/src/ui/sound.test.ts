import { describe, expect, test } from 'vitest';

import { SHELL_CUES } from '../../../../shared/lib/sound/cues.ts';
import { CUES } from './sound.ts';

describe('the cue table', () => {
  test("spreads the shell's cues and adds the table's own", () => {
    expect(CUES).toMatchObject(SHELL_CUES);
    expect(CUES.pass).toEqual({ cue: 'move', buzz: 10 });
  });
});
