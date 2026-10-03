# Building a game here

This file is the contract for anyone, human or agent, who adds or changes a game in this repo. It
holds the rules every game follows and why each exists; the long explanations live in
`docs/ARCHITECTURE.md` and `docs/design/*.md`, and this file links to them rather than repeating
them. Read it whole before the first edit. A rule here outranks a pattern you find in one game's
code: the games landed in order, and the oldest ones carry shapes the newer rules replaced.

## Rules

- **Understand what happened before proceeding.** Every consequential event (a bust, a capture, a
  knock, a penalty, a round's end, a game's end) is shown with the state that caused it and waits
  for the player's Continue. Nothing advances by itself. Online, each seat confirms its own.
  _Why:_ the owner, 2026-10-02, on Flip 7: "When you the player bust, you need to confirm before
  proceeding. That way it's not so instant and you can understand what happened before
  proceeding." The fun of a press-your-luck game is the anticipation; an instant cut to the next
  turn throws it away. The pause is state in the game's reducer (`pause: Pause | null`, with a
  `continue/click` intent that clears it), never a timer: Flip 7's `web/games/flip7/src/ui/state.ts`
  `pauseFor` is the model.
- **Every game is a shared-shell game.** The home, the host and join cards, the waiting rooms, the
  N-seat online sessions over PeerJS, the curtain for hidden hands, the Rules and About tabs, the
  sound toggle, resume and leave are the shell's (`web/shared/ui/shell.ts`, booted by
  `web/shared/edge/boot.ts`). A game writes a `shellConfig.ts`, a `page.ts`, an engine and a table.
  _Why:_ the owner, 2026-10-02: "Any multiplayer game must necessarily also have a multiplayer
  component via the shell." The shell is proven once by eight specs that drive every registered
  game; a game that builds its own home gets none of that proof. The one exception is a solo page
  for a one-phone toy with no seats (`tools/games.ts` `SOLO_PAGES`: the reaction game).
- **Rely on the shell for everything the game does not own.** Before writing a screen, a painter, a
  sheet or a form, look for it under `web/shared/ui/` (the module table is
  `web/shared/ui/README.md`) and `web/shared/markup/shell/`. _Why:_ the owner, 2026-10-02: "Rely on
  the shell as much as possible … Make it take minimal effort to produce a new game." UNO and Flip 7
  shipped first with their own menus and a `<select>` for players, and both were rebuilt the same
  week.
- **`page.ts` is the source; `index.html` is generated.** A game's page is `web/games/<g>/page.ts`
  (a `ShellPage`), composed into the committed `index.html` by
  `node --experimental-strip-types tools/shell-markup.ts --write`; `test/dist/shell-markup.test.ts`
  fails on a drift. Never hand-edit a shell game's `index.html`. _Why:_ the shell's markup is
  shared partials; a hand edit forks it.
- **The player count is the shared stepper, never a `<select>`.** The host card and the pass-and-play
  panel place `stepperHtml` (`web/shared/markup/stepper.ts`) and bind it with `bindStepper`
  (`web/shared/ui/stepper.ts`); the bounds are the game's `seats {min, max}` in its `shellConfig.ts`
  (briscola 2-4, UNO and Flip 7 2-12, fidice 1-6). _Why:_ the owner, 2026-10-02: "the player choice
  should not be a dropdown but a number with - and + buttons on the side".
- **The Rules tab fits one phone screen.** The items in `src/ui/rules.ts` (`RULES_ITEMS`, rendered
  through `rulesListHtml`) teach the game in the fewest lines that fit 390x844 with no scroll: the
  goal, the turn, then the special cases one line each. The long rules, with their sources, are
  `docs/design/<game>.md`. _Why:_ the owner, 2026-10-02: "the ruleset to teach players should be
  as short as possible, ideally fitting on 1 screen." UNO fits in seven lines, Flip 7 in eight.
- **Every key moment has a sound cue, once.** A game writes one table, `src/ui/sound.ts`, that maps
  its own events onto the shared cue vocabulary (`web/shared/lib/sound/cues.ts`: `move`, `bad`,
  `good`, `great`, `victory`, …), spreading `SHELL_CUES` for tap, your turn, win and loss. The cue
  plays through the shared player (`web/shared/edge/cuePlayer.ts`) from the reducer's `rendered`
  hook, keyed on the change between two views (`CueMemory`, or `eventEffects` over an event
  stream), so a repaint or a re-sent frame plays nothing. The shell's `#soundBtn` and the game's
  `<g>_sound` preference govern every cue; a phone starts muted. _Why:_ "sound font" means the
  game's sound cues and nothing else (the owner, 2026-10-02); a sound that fires on paint doubles,
  and a sound that ignores the toggle is a bug on a quiet train. `docs/design/sound-fonts.md` §5 is
  the mechanism; a new asset is CC0 with its licence line beside it.
- **The table shows every seat.** Every opponent's name and public state (cards remaining, line,
  score) is on the table, and the seat to play is highlighted. Online, this phone's seat is in the
  foreground and the others smaller behind it. _Why:_ the owner, 2026-10-02: "like briscola when
  there are multiple players you should be able to see the number of cards they have remaining";
  and on Flip 7, "you must have your hand closer and all the other players hands kinda more in the
  background."
- **The engine is pure.** `src/engine/` is a reducer over `Game` and `Intent` with an injected `Rng`
  and clock, returning a new state as a `Result`; no DOM, no loops, no `let`, no throw, no
  `Math.random`, no `Date.now`. The host runs it; every seat's frame is checked against the seat
  that sent it (`applyAction` refuses a play out of turn). _Why:_ a pure engine plays whole bot games
  in a unit test and replays a recorded game byte for byte; the trust boundary is the host.
- **Functional style everywhere else, DOM through one edge.** No raw loops outside `*.algorithms.ts`
  (a reason comment and full coverage), DOM writes only through `web/shared/edge/dom.ts`, storage
  only through `web/shared/edge/storage.ts` with a decoder on every read. _Why:_ `eslint.config.js`
  and `tsconfig.pure.json` enforce it by path, and `docs/ARCHITECTURE.md` "Module boundaries"
  explains the zones.
- **Tests beside modules, and the guards stay green.** Every module has its `*.test.ts` next to it;
  the engine has a bot that plays whole games with the card or piece count checked at every step;
  every class the TypeScript toggles has a CSS rule or a row in `web/shared/styles/CONTRACT.md`;
  the computed-style goldens (`test/fixtures/styles/<g>.*.json`) are re-recorded only when a pinned
  selector changed; the story baselines are recorded on darwin locally and on linux by the
  `stories-baselines` workflow. _Why:_ `npm run check` is what main proves; CI runs only the suites a
  change touches (`tools/ci/affected.ts`), so a game's suite row is how its tests run at all.
- **Start buttons are green.** Every call to action that opens, joins or starts a game, hand or
  round wears `.btn-go`; in-game actions keep the accent. _Why:_ the owner, 2026-09-24: "As a design
  principle all the 'start game' buttons should be green and should stand out well."
- **Themes are subtle.** One accent, the shell's tokens, plain pieces; recognisable at a glance and
  otherwise quiet. _Why:_ the owner on Sheshbesh, 2026-09-23. A game that fights the shell's look is
  the first thing a player notices and the last thing a test catches.
- **Keep this file short.** One sentence per rule, its why beside it, and a link instead of an
  explanation. When a rule changes, rewrite its bullet; never append a second bullet about the same
  thing.

## Understand what happened before proceeding

The headline rule, applied. Flip 7's bust confirm (2026-10-02) is the first instance; the rule
reaches every game, and the planned conformance suite will pin each game's declared pauses against
its state machine. The events that pause, so a new game can find its own on the list:

| Event                                  | What the pause shows                           |
| -------------------------------------- | ---------------------------------------------- |
| A bust, a freeze, a Flip 7 (Flip 7)    | the card, the points lost or banked, the bonus |
| A hit, a checker borne off (Sheshbesh) | the roll and the move that did it              |
| A trick taken (Briscola)               | the cards of the trick and who took the points |
| A knock or gin (Gin Rummy)             | both hands, the layoffs, the deadwood          |
| A penalty drawn (UNO)                  | the card that caused it and the cards drawn    |
| A round's end                          | every seat's score, then Next round            |
| A game's end                           | the result sheet, then Play again or Leave     |

How it is built (Flip 7 today; the shape for every game):

- The pause is a value in the table slice of the game's reducer (`pause`), raised when a new view
  arrives (`pauseFor(local, prev, view)`) and cleared by one intent (`continue/click`). While it is
  set, every other table intent is a no-op (`if (app.table.pause !== null) return pure(app)`).
- The pause carries what to show; the painter paints it from the pause, not from the live view, so
  the player reads the state that caused the event even after the host has moved on.
- Online, the pause is this phone's seat's alone; on one phone it is any seat's.
- An e2e case pins it: "a bust waits for Continue: the card and the points lost, the seat greyed
  and kept, then the next seat" (`e2e/flip7-local.spec.ts`) is the shape.
- A busted or finished seat is greyed and kept on the table until the next deal; it is never
  removed mid-round.

## The shell

What a game supplies, and where to copy it from. Briscola is the N-seat model
(`web/games/briscola/src/`), UNO the hidden-hand one (`web/games/uno/src/`), Flip 7 the all-public
one with the pause (`web/games/flip7/src/`). The shell's design is `docs/design/shared-shell.md`
(§4.3 is the config object, §6.1 the registry row) and `docs/design/n-seat-sessions.md`.

- `page.ts`: the `ShellPage`. The copy the pages spell differently and the game's own blocks: the
  table, the endgame, its sheets, its options (the stepper in the host card and the pass-and-play
  panel). Run `tools/shell-markup.ts --write` after every edit.
- `shellConfig.ts`: the `ShellGameData`. The id, `seats {min, max, fixed}`, the default and local
  names, the tabs, the modes (`Online`, `Pass the phone`), the copy the shared flows paint
  (`hostRoomMsg`, `waitingMsg`, `joinedText`, …), the option codec, the engine adapters
  (`createState`, `applyAction`, `viewFor`, `decodeState`), the frame builders, the store.
- `protocol.ts`: pure, the trust boundary. Every inbound frame through a `Result` decoder.
- `net/{host,guest}.ts`: edges over a `Transport`; never import `peerjs`.
- `storage.ts`: the only localStorage reader, keys prefixed `<g>_`, the save under `<g>MP_v1`.
- `ui/state.ts`: the table slice and its reducer (the curtain, the pause, the game's intents);
  `ui/render.ts` paints it through `edge/dom.ts`; `ui/home.ts` the home's game-specific inputs;
  `ui/rules.ts`, `ui/glossary.ts`, `ui/about.ts` the two tabs; `ui/sound.ts` the cue table.
- `fx.ts`: `createFx` over the shared cue player and the game's `sound` preference.
- `main.ts`: the boot and no logic; the adapters constructed and injected; `window.__<g>` exposed.
- `theme.css`: the game's rules over the shell's tokens; one accent.

Hidden hands: each seat is sent its own `View` (its hand, everyone's counts), never another seat's
hand, and the curtain hands the phone over in pass-and-play (`firstCurtain` in the registry). A game
with nothing to hide raises the curtain once (Flip 7, Sheshbesh) or never (Hive: a null
`firstCurtain`).

## The menu

A game appears on the landing page and at its short URL through data, not code:

- The card: one `<a class="card" href="games/<g>/">` in `web/index.html`, in `REGISTRY` order, with
  one glyph and the name. The landing's search reads the cards.
- The short URL: `games.sweedler.com/<g>/` is the Worker's generic mapping of `games/<g>/`; nothing
  in `infra/` changes for a game. A second name is an alias row (`tools/games.ts` `ALIASES` and the
  Worker's copy), not a game.
- The README's "Play" table gets a row with both URLs and the source folder.
- The link preview: `web/games/<g>/assets/splash.svg`, rendered to `web/public/games/<g>/splash.png`
  by `tools/splash.ts`; the dist guards expect it for every shell game.

## Layout

Phones first, upright and sideways, then tablets and desktop. The shell measures the screen into
one of seven buckets (`docs/design/layout-buckets.md`; `web/shared/lib/layout.ts`) and a theme
reads `body[data-layout]` to lay the table out per bucket; the screen frame
(`docs/design/screen-frame.md`) is an opt-in that only Sheshbesh takes. Every table fits its
bucket without a page scroll; `npm run audit:space` (`docs/design/space-audit.md`) measures every
page on every catalogued phone and reports the six rules. Targets are 44px. The stepper's CSS is
the shell's (`web/shared/styles/shell.css`); a game's seat chips and pause sheet are its theme's.

## Repo identity

- Commits are authored `ari@sweedler.com`; the pre-push hook refuses any other address. Check with
  `git log origin/main.. --format='%ae %ce'` before pushing.
- The GitHub account is the personal one (`AriSweedler/games`); every `gh` call uses its token.
- A PR title reads in a player's words: what a player gets, not what a module does. PR #11 is the
  shape: `feat(flip7): Flip 7 online for 2 to 12: open a table, send the link; …`. Squash merges;
  the squash's subject is the PR title.
- A PR that flips a golden or a baseline says so in its body and touches only that golden.
- `package-lock.json` is committed as npm writes it behind the Socket Firewall registry; never
  rewrite it (README "Develop").

## A new game

The checklist is the shell's contract. A planned conformance suite enumerates `SHELL_GAMES` and
fails with the game and the rule in one line when a step is missed; until it lands, the pins in
step 8 and the dist guards are the guards. `README.md` "Add a game" is the long form with every
file it names.

1. Read the published rules and write `docs/design/<g>.md`: the sources, the deck or pieces, a turn,
   the special cases, scoring, the seat range, and the one-screen Rules items as a list.
2. `web/games/<g>/src/engine/`: the pure engine (`Game`, `Intent`, an injected `Rng`), its tests,
   and a bot that plays whole games at every seat count with the counts checked at every step.
3. `src/ui/rules.ts`, `glossary.ts`, `about.ts`: the Rules items that fit 390x844, the glossary
   terms the items link, the About copy.
4. `src/ui/state.ts`: the table slice with the curtain, the pause for every consequential event,
   and the game's intents; its test pins the pause and its Continue.
5. `src/ui/sound.ts` and `fx.ts`: the cue table over `SHELL_CUES` and the game's events; a test
   pins the cue per intent.
6. `shellConfig.ts`, `protocol.ts`, `net/`, `storage.ts`, `ui/render.ts`, `ui/home.ts`, `main.ts`,
   `theme.css`, `page.ts`: copy the closest game and keep its tests; then
   `node --experimental-strip-types tools/shell-markup.ts --write`.
7. Register it: the `Game` union and its room-code row in `web/shared/lib/roomCode.ts`; `GameSuite`,
   `ShellGame`, `SHELL_GAMES`, `SHELL.<g>` and `REGISTRY.<g>` in `tools/games.ts`; `SHELL_GAMES` in
   `web/shared/ui/ids.ts`; `GAMES` in `eslint.config.js`; the `src/**` include in
   `tsconfig.node.json`; the suite row in `tools/ci/suites.ts` (its unit globs, coverage rows,
   `gameE2e('<g>')` and `gameRules('<g>')`, both read off the registry row); `test:<g>` and
   `test:e2e:<g>` in `package.json`.
8. Pin it: the lists in `tools/games.test.ts`, `tools/ci/suites.test.ts`, `tools/ci/affected.test.ts`,
   `web/shared/lib/roomCode.test.ts`, `web/shared/ui/ids.test.ts`, `test/dist/classes.test.ts`.
9. Drive it: a `DRIVERS` row in `e2e/fixtures/two-players.ts`, a `ShellDriver` row in
   `e2e/fixtures/online-games.ts`, one page-only spec `e2e/<g>-local.spec.ts` listed in
   `e2e/fixtures/site.ts` `PAGE_ONLY_SPECS`; the shell specs' `@<g>` describes come from the row.
10. Style it: a `CONTRACT.md` row for every class the TypeScript toggles that the extraction cannot
    see; the game's selectors and drive in `tools/parity/computed-styles.ts`, then record the two
    goldens and run the check.
11. List it: the landing card in `web/index.html`, the splash, the README "Play" row.
12. Gate it: `npm run typecheck`, eslint and prettier on the touched files, `npm run test:<g>`,
    `npm run test:harness`, `npm run test:site` (the build and the dist guards), the shell specs
    with `--grep @<g>` and the game's own spec at your port offset.

Steps 2 to 11 start from the scaffolder, never from a copy of another game:
`npm run new-game -- --name <slug> --title <Title> --seats <min>-<max> --hidden-hands yes|no`
(`tools/new-game.ts`, docs/design/new-game.md) writes the skeleton (Hive's shape with the game cut
out: a placeholder engine with its bot game, the reducer with the end's pause, the cue table over
`SHELL_CUES`, the one-screen Rules items, `page.ts` and the composed `index.html`, `theme.css`, the
e2e fixture and spec, `docs/design/<g>.md` with its TODO rows) and every registry row and pin of
steps 7 to 11, so `npm run typecheck`, `npm run test:<g>`, `npm run test:harness` and the
conformance suite pass before a rule is written; it then prints what is left (the rules, the
table, the splash, the floors). The two things it leaves as declared gaps: the stepper and the
seat names when `--seats` is a range (Flip 7's shape, docs/design/flip7.md §8).

## Review

Before opening the PR, read the game as a player and as a fresh agent:

- Does the home look like the others at a glance (the shell's cards, the stepper, the green start)?
- Can every consequential event be read before the game moves on, on one phone and on two?
- Does every seat on the table show its name and public state, with the seat to play lit?
- Does the Rules tab fit one 390x844 screen with no scroll?
- Does every key moment sound once, and fall silent with the toggle?
- Would a fresh agent with only this file, the closest game's folder and `README.md` "Add a game"
  build a game that passes `npm run check` and looks like the others? If a step needed a hint that
  is not written here, write it here.

## Design docs

- `docs/ARCHITECTURE.md`: the layout, the module boundaries, the enforcement toolchain, the testing
  pyramid, the conventions for small diffs.
- `docs/design/shared-shell.md`, `n-seat-sessions.md`, `lobby-resume.md`: the shell, the sessions,
  resume.
- `docs/design/sound-fonts.md`, `briscola-sound-history.md`: cues, fonts, phrases, the event stream.
- `docs/design/layout-buckets.md`, `screen-frame.md`, `space-audit.md`, `devices.md`: the screen.
- `docs/design/glossary-links.md`: the Rules items and their jargon links.
- `docs/design/card-packs.md`, `language-packs.md`: card art and names, chosen like sound fonts.
- `docs/design/test-partition.md`: which change runs which suite.
- `docs/design/<game>.md` and its companions: each game's rules, board and decisions. Flip 7's §8
  and UNO's §9 are the two newest shell adoptions; `fidice-shell-adoption.md` is the largest.
