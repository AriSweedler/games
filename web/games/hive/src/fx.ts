// Hive's cue player: the shared one (web/shared/edge/cuePlayer.ts) over this game's cue table and
// its sound key.
import {
  createCuePlayer,
  type CuePlayer,
  type CuePlayerDeps,
} from '../../../shared/edge/cuePlayer.ts';
import { writeSoundState, type Store } from './storage.ts';
import { CUES, type Cue } from './ui/sound.ts';

export type FxDeps = Omit<CuePlayerDeps<Cue>, 'cues' | 'persist'> & Readonly<{ store: Store }>;
export type Fx = CuePlayer<Cue>;

export const createFx = ({ store, ...deps }: FxDeps): Fx =>
  createCuePlayer({ ...deps, cues: CUES, persist: (state) => writeSoundState(store, state) });
