// Hearts's cues (docs/design/hearts.md §3): the shell's four (a tap, my turn, win, lose) and the
// table's own, each a cue of the active font with its buzz (web/shared/lib/sound/cues.ts). The
// reducer picks them from the change between two views (ui/state.ts `cuesBetween`), once per view
// (`CueMemory`). TODO: one row per key moment of the real game.
import { SHELL_CUES, type CueSpec } from '../../../../shared/lib/sound/cues.ts';

export type Cue = 'yourTurn' | 'pass' | 'win' | 'lose';

export const CUES: Readonly<Record<Cue | 'tap', CueSpec>> = {
  ...SHELL_CUES,
  pass: { cue: 'move', buzz: 10 },
};
