// The game's sound and haptics: the shared cue player (web/shared/edge/cuePlayer.ts) over the
// shell's four rows (tap, your turn, the win and the loss) and the `flip7_sound` preference.
import {
  createCuePlayer,
  type CuePlayer,
  type CuePlayerDeps,
} from '../../../shared/edge/cuePlayer.ts';
import { SHELL_CUES } from '../../../shared/lib/sound/cues.ts';
import { SHELL_STORE, type Store } from './storage.ts';

export type Cue = keyof typeof SHELL_CUES;
export type FxDeps = Omit<CuePlayerDeps<Cue>, 'cues' | 'persist'> & Readonly<{ store: Store }>;
export type Fx = CuePlayer<Cue>;

export const createFx = ({ store, ...deps }: FxDeps): Fx =>
  createCuePlayer({ ...deps, cues: SHELL_CUES, persist: (s) => SHELL_STORE.sound.write(store, s) });
