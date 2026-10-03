// A player's display name as a form or a seat accepts it (docs/design/dry-round-2.md H4): trimmed,
// cut to the game's maximum, the game's fallback when nothing is left. Fidice spelled
// `trim().slice(0, 16) || 'Player'` at four sites (the name form, the pass-the-phone list, a bot's
// rename, a seated human); its `NAME_RULE` in domain/types.ts is the one home of 16/'Player' now.
// Gin and backgammon keep their own `nameOr`, which applies the fallback before the cut, and the
// wire cut `guestNameFor`, which cuts before it trims: neither is this function byte for byte.

/** What a game accepts as a name: at most `max` characters, `fallback` for an empty one. */
export type NameRule = Readonly<{ max: number; fallback: string }>;

/** `raw.trim().slice(0, max) || fallback`: a blank or whitespace-only name takes the fallback. */
export const normaliseName = (raw: string, rule: NameRule): string =>
  raw.trim().slice(0, rule.max) || rule.fallback;

// The labels every shell game spelled (docs/design/shell-hoist.md §4 E): the list of names the
// curtain and the pause read, the resume box's players, the handoff's offer and the resume
// offer's line. Seven copies agreed byte for byte; the strings are pinned by the shell's e2e specs.

/** "Ann", "Ann and Bob", "Ann, Bob and Cara"; the empty string for no names. */
export const listNames = (names: ReadonlyArray<string>): string =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;

/** "Ann vs Bob" at two (the shell specs' shape), `listNames` past two: the resume box's players. */
export const versusOrList = (names: ReadonlyArray<string>): string =>
  names.length <= 2 ? names.join(' vs ') : listNames(names);

/** `#handoffBtn`'s tooltip and a handed-off room's resume offer: seat 0 keeps this device and hosts, seat 1 joins through the invite. */
export const handoffLabel = (names: ReadonlyArray<string>): string =>
  `Continue online: ${names[0] ?? ''} hosts, ${names[1] ?? ''} joins by invite`;

/** The three shell offers as the label reads them (`ShellResume` in web/shared/ui/shell.ts carries more fields; gin's Score Counter offer is its own). */
export type ResumeOffer<S> =
  | Readonly<{ kind: 'local'; game: S }>
  | Readonly<{ kind: 'host'; code: string; handoff: boolean; game: S | null }>
  | Readonly<{ kind: 'guest'; code: string }>;

/**
 * `#resumeBtn`'s label for a resume offer, the game's seat names read through `namesOf`:
 * "Resume pass & play: Ann vs Bob", the handoff's offer for a handed-off room, else
 * "Resume hosting room KQZM" (a room still waiting for its first guest has no game to hand off,
 * lobby-resume.md D3), "Rejoin room KQZM" for a guest.
 */
export const resumeLabel = <S>(
  resume: ResumeOffer<S>,
  namesOf: (game: S) => ReadonlyArray<string>,
): string =>
  resume.kind === 'local'
    ? `Resume pass & play: ${versusOrList(namesOf(resume.game))}`
    : resume.kind === 'guest'
      ? `Rejoin room ${resume.code}`
      : resume.handoff && resume.game !== null
        ? handoffLabel(namesOf(resume.game))
        : `Resume hosting room ${resume.code}`;
