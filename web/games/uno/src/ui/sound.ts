// UNO's cues (docs/design/uno.md §9): the shell's two (a tap, my turn) and the table's own, each a
// cue of the active font with its buzz (web/shared/lib/sound/cues.ts). The reducer picks them from
// the change between two views (ui/state.ts `cuesBetween`), once per view (`CueMemory`).
import { SHELL_CUES, type CueSpec } from '../../../../shared/lib/sound/cues.ts';
import type { CueMemory } from '../../../../shared/ui/shell.ts';

export type Cue = 'yourTurn' | 'play' | 'draw' | 'win' | 'lose';

export const CUES: Readonly<Record<Cue | 'tap', CueSpec>> = {
  ...SHELL_CUES,
  play: { cue: 'move', buzz: 15 },
  draw: { cue: 'move', buzz: 10 },
};

export type CueState = CueMemory;
export const INITIAL_CUES: CueState = { key: null };
