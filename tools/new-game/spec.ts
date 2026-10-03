// What `tools/new-game.ts` scaffolds from (docs/design/new-game.md §2): the four answers the
// command line gives (the slug, the title, the seat range, whether a hand is hidden) and the names
// every template spells from them. Pure: the CLI parses argv into one of these and the templates
// and the registry edits read it; the test builds one by hand.
import { err, ok, type Result } from '../../web/shared/lib/result.ts';

export type NewGameSpec = Readonly<{
  /** The folder and URL name, `web/games/<slug>/`: lower-case letters and digits, a letter first. */
  slug: string;
  /** The page's `<title>`, the landing card's name and the shell's heading. */
  title: string;
  /** The seat range the stepper steps over (AGENT.md "The player count is the shared stepper"). */
  seats: Readonly<{ min: number; max: number }>;
  /** Whether a seat holds something the other must not see, so the pass-and-play curtain rises on every turn (AGENT.md "Hidden hands"). */
  hidden: boolean;
}>;

/** The names the templates spell: `tally` -> `Tally`, `TALLY`, `window.__tally`. */
export type Names = Readonly<{
  slug: string;
  pascal: string;
  upper: string;
  hook: string;
  title: string;
}>;

export const namesOf = (spec: NewGameSpec): Names => ({
  slug: spec.slug,
  pascal: spec.slug.charAt(0).toUpperCase() + spec.slug.slice(1),
  upper: spec.slug.toUpperCase(),
  hook: `__${spec.slug}`,
  title: spec.title,
});

export const SLUG_PATTERN = /^[a-z][a-z0-9]*$/;

/** The one-line usage the CLI prints on a bad call. */
export const USAGE =
  'node --experimental-strip-types tools/new-game.ts --name <slug> --title <Title> --seats <min>-<max> --hidden-hands yes|no [--root <dir>]';

/** `--flag value` pairs off argv; a flag without a value or a stray word is an error. */
export const parseFlags = (
  argv: ReadonlyArray<string>,
): Result<Readonly<Record<string, string>>, string> =>
  argv.reduce<Result<Readonly<Record<string, string>>, string>>((acc, word, i) => {
    if (!acc.ok) return acc;
    if (i % 2 === 0) {
      if (!word.startsWith('--')) return err(`expected a --flag, got "${word}"`);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) return err(`${word} needs a value`);
      return ok({ ...acc.value, [word.slice(2)]: value });
    }
    return acc;
  }, ok({}));

/** The spec off the flags, each checked: the slug's shape, a non-empty title, `2-2` to `2-12`, yes or no. */
export const specFromFlags = (
  flags: Readonly<Record<string, string>>,
): Result<NewGameSpec, string> => {
  const slug = flags['name'];
  if (slug === undefined || !SLUG_PATTERN.test(slug))
    return err(`--name must match ${SLUG_PATTERN.source} (lower-case letters and digits)`);
  const title = flags['title']?.trim();
  if (title === undefined || title === '') return err('--title must not be empty');
  const seatsRaw = flags['seats'] ?? '2-2';
  const seatsMatch = /^(\d+)-(\d+)$/.exec(seatsRaw);
  if (seatsMatch === null) return err(`--seats must be <min>-<max>, got "${seatsRaw}"`);
  const min = Number(seatsMatch[1]);
  const max = Number(seatsMatch[2]);
  if (min < 2 || max < min || max > 12)
    return err(`--seats must be 2 <= min <= max <= 12, got ${seatsRaw}`);
  const hiddenRaw = flags['hidden-hands'] ?? 'no';
  if (hiddenRaw !== 'yes' && hiddenRaw !== 'no') return err('--hidden-hands must be yes or no');
  return ok({ slug, title, seats: { min, max }, hidden: hiddenRaw === 'yes' });
};

export const parseArgs = (argv: ReadonlyArray<string>): Result<NewGameSpec, string> => {
  const flags = parseFlags(argv);
  return flags.ok ? specFromFlags(flags.value) : flags;
};
