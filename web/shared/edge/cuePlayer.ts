// The cue player every shell game plays through (docs/design/shared-shell.md §5 A4): gin's legacy `fx`
// object (legacy/gin-rummy/index.html: sound + haptics, docs/MIGRATION.md step 12) moved here
// verbatim from web/games/gin-rummy/src/fx.ts, with the two things a game owns injected: its cue
// table (ui/sound.ts, event -> generic cue + buzz) and the persist of its sound preference
// (storage.ts `writeSoundState` under the game's own key). Since docs/design/sound-fonts.md §5 an
// event names a cue, not notes: `play` resolves the row in the font the caller passes (the App's
// `soundFont`, so the reducer stays the source of truth) and hands the sounds to the edge player.
// Since the phrases (§2.2) a row is a `Phrase`: a `CueSpec` row is the one-step phrase and plays
// exactly as before (one sound at 0, its buzz); a longer row schedules its steps and voices, and
// `playPhrases` plays a run of them PHRASE_GAP_MS apart with one vibrate (the shell's `phrases`
// effect, from `eventEffects`). `enabled` lives in the audio cues; a buzz is skipped when disabled,
// as the legacy `buzz` checked `this.enabled`. `toggle` flips and persists the preference, warms
// the context and taps when turning on, then tells the page to repaint `#soundBtn` (`onToggle`, a
// paint). `warm(font)` also fetches the table's samples in that font, so a phrase's later step is
// decoded by its slot. `shellFx` is the wiring every game's fx.ts once spelled (shell-hoist.md
// §4 A): the player over a config's cue table and its `sound` preference; the boot constructs the
// real deps and calls it. cuePlayer.test.ts records fakes over a table of its own and pins the
// wiring; each game's ui/sound.test.ts pins its table.
import type { Buzz } from '../lib/sound/cues.ts';
import { fontByName, type SoundFontName } from '../lib/sound/fonts.ts';
import {
  PHRASE_GAP_MS,
  joinBuzz,
  place,
  schedule,
  sequenceOf,
  type Phrase,
} from '../lib/sound/phrase.ts';
import type { AudioCues } from './fx.ts';
import { playSlots, warmSamples, type SoundDeps } from './sound.ts';

// `CueSpec` (one row of a game's table) lives in web/shared/lib/sound/cues.ts since DRY round 2
// (dry-round-2.md E9); re-exported so this module's import path holds.
export type { CueSpec } from '../lib/sound/cues.ts';

/** The sound preference as every game's storage.ts spells it (`SOUND_STATES`). */
export type SoundState = 'on' | 'off';

export type CuePlayerDeps<E extends string> = Readonly<{
  audio: AudioCues;
  /** The sample seam of the shared player (nothing in the shipped fonts uses it yet). */
  sound: SoundDeps;
  vibrate: (pattern: Buzz) => void;
  /** The game's table: every event it raises, and the tap, onto a phrase (a `CueSpec` row is one). */
  cues: Readonly<Record<E | 'tap', Phrase>>;
  /** `writeSoundState(store, state)`: the preference under the game's key. */
  persist: (state: SoundState) => void;
  /** `paintSound(document, enabled)`: the sound button reflects the new state. */
  onToggle: (enabled: boolean) => void;
}>;

export type CuePlayer<E extends string> = Readonly<{
  /** An event of the table in the given font, with its buzz. */
  play: (event: E | 'tap', font: SoundFontName) => void;
  /** Phrases already chosen (`eventEffects`), back to back in the font, one vibrate for the run. */
  playPhrases: (phrases: ReadonlyArray<Phrase>, font: SoundFontName) => void;
  /** Flip the preference; turning on taps in the given font. */
  toggle: (font: SoundFontName) => void;
  enabled: () => boolean;
  /**
   * `audio.warm()` on the first gesture: browsers only start audio after one. With a font, the
   * table's samples in it are fetched and decoded too, so no step of a phrase waits on the wire.
   */
  warm: (font?: SoundFontName) => void;
}>;

export const createCuePlayer = <E extends string>(deps: CuePlayerDeps<E>): CuePlayer<E> => {
  const buzz = (pattern: Buzz): void => {
    if (deps.audio.enabled()) deps.vibrate(pattern);
  };
  const playPhrases = (phrases: ReadonlyArray<Phrase>, font: SoundFontName): void => {
    const [first, ...rest] = phrases;
    if (first === undefined) return;
    const placed = place(fontByName(font), phrases, PHRASE_GAP_MS);
    playSlots(
      deps.audio,
      placed.flatMap((p) => p.slots),
      deps.sound,
    );
    // One row keeps its pattern byte for byte (the games' ui/sound.test.ts pin); a run is joined.
    buzz(rest.length === 0 ? sequenceOf(first).buzz : joinBuzz(placed));
  };
  const play = (event: E | 'tap', font: SoundFontName): void => {
    playPhrases([deps.cues[event]], font);
  };
  const warm = (font?: SoundFontName): void => {
    if (!deps.audio.enabled()) return;
    deps.audio.warm();
    if (font === undefined) return;
    const chosen = fontByName(font);
    const rows: ReadonlyArray<Phrase> = Object.values(deps.cues);
    warmSamples(
      deps.audio,
      rows.flatMap((row) => schedule(chosen, row)),
      deps.sound,
    );
  };
  const toggle = (font: SoundFontName): void => {
    const enabled = !deps.audio.enabled();
    deps.audio.setEnabled(enabled);
    deps.persist(enabled ? 'on' : 'off');
    if (enabled) {
      warm(font);
      play('tap', font);
    }
    deps.onToggle(enabled);
  };
  return {
    play,
    playPhrases,
    toggle,
    enabled: () => deps.audio.enabled(),
    warm,
  };
};

/** What `shellFx` takes from the boot: the player's deps less the table and the persist it supplies, plus the store to persist to. */
export type ShellFxDeps<E extends string, St> = Omit<CuePlayerDeps<E>, 'cues' | 'persist'> &
  Readonly<{ store: St }>;

/**
 * The one wiring every game's `src/fx.ts` spelled (shell-hoist.md §4 A): the shared player over
 * the config's cue table (`ShellConfig.cues.table`) and its `sound` preference (`ShellPrefs.sound`,
 * prefs.ts `soundPref` under the game's own key). The boot calls the result with the real deps.
 */
export const shellFx =
  <E extends string, St>(
    cues: Readonly<Record<E | 'tap', Phrase>>,
    pref: Readonly<{ write: (store: St, state: SoundState) => unknown }>,
  ) =>
  ({ store, ...deps }: ShellFxDeps<E, St>): CuePlayer<E> =>
    createCuePlayer({
      ...deps,
      cues,
      persist: (state) => {
        pref.write(store, state);
      },
    });
