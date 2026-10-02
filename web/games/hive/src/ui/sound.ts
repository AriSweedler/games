// Hive's cues (docs/design/hive.md §7): the shell's two (a tap, my turn) and the table's own, each a
// cue of the active font with its buzz (web/shared/lib/sound/cues.ts). The reducer picks them from
// the change between two views (ui/state.ts `cuesBetween`), once per view (`CueMemory`).
import { SHELL_CUES, type CueSpec } from '../../../../shared/lib/sound/cues.ts';
import type { CueMemory } from '../../../../shared/ui/shell.ts';

export type Cue = 'yourTurn' | 'place' | 'move' | 'win' | 'lose';

export const CUES: Readonly<Record<Cue | 'tap', CueSpec>> = {
  ...SHELL_CUES,
  place: { cue: 'move', buzz: 15 },
  move: { cue: 'move', buzz: 10 },
};

export type CueState = CueMemory;
export const INITIAL_CUES: CueState = { key: null };
