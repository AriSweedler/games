// The game's sound and haptics: the shared cue player (web/shared/edge/cuePlayer.ts) over this
// game's cue table (ui/sound.ts: the shell's four rows and the table's own) and the `flip7_sound`
// preference.
import {
  createCuePlayer,
  type CuePlayer,
  type CuePlayerDeps,
} from '../../../shared/edge/cuePlayer.ts';
import { SHELL_STORE, type Store } from './storage.ts';
import { CUES, type Cue } from './ui/sound.ts';

export type { Cue };
export type FxDeps = Omit<CuePlayerDeps<Cue>, 'cues' | 'persist'> & Readonly<{ store: Store }>;
export type Fx = CuePlayer<Cue>;

export const createFx = ({ store, ...deps }: FxDeps): Fx =>
  createCuePlayer({ ...deps, cues: CUES, persist: (s) => SHELL_STORE.sound.write(store, s) });
