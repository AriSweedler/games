// The page's sound and haptics: the shared cue player (web/shared/edge/cuePlayer.ts `shellFx`)
// over this page's table (ui/sound.ts) and its `rps_sound` preference (storage.ts), as every shell
// game's boot wires it. main.ts constructs the real deps; fx.test.ts pins the table and this wiring.
import { shellFx } from '../../../shared/edge/cuePlayer.ts';
import { writeSoundState } from './storage.ts';
import { CUES } from './ui/sound.ts';

export const createFx = shellFx(CUES, { write: writeSoundState });
