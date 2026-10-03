# The game scaffolder

One command writes a new shell game's skeleton and registers it everywhere the harness enumerates
games, so the game passes the gates before a rule is written and the agent that takes it on
writes rules, not wiring. The owner, 2026-10-02: "Rely on the shell as much as possible in the
subagents. Make it take minimal effort to produce a new game."

```
npm run new-game -- --name <slug> --title <Title> --seats <min>-<max> --hidden-hands yes|no
node --experimental-strip-types tools/new-game.ts --name tally --title "Tally" --seats 2-2 --hidden-hands no
```

## 1. Why

Before it, a new game was a twelve-file list carried in a memory note and copied from the closest
game (AGENT.md "A new game", steps 2 to 11). UNO and Flip 7 were copied from each other and both
shipped with a home of their own, a `<select>` for players and no Rules tab, then were rebuilt the
same week on the shell. `AGENT.md` states the rules and `test/game-conformance.test.ts` guards them
(docs/design/game-conformance.md); the scaffolder is the third piece: a skeleton that already
satisfies them, so the first PR of a game is the engine, not the plumbing.

## 2. The four answers

`tools/new-game/spec.ts` parses them into a `NewGameSpec`:

| Flag             | Values                              | What it decides                                                                                                 |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `--name`         | `[a-z][a-z0-9]*`                    | The folder `web/games/<slug>/`, the URL, the room-code prefix `<slug>-`, the storage prefix `<slug>_`, the hook `window.__<slug>`, the suite `<slug>` |
| `--title`        | any text                            | The `<title>`, the shell heading, the share title, the landing card, the README row                            |
| `--seats`        | `<min>-<max>`, 2 ≤ min ≤ max ≤ 12   | The CONFORMANCE seat range; a range declares the `stepper` and `seat-names` gaps (§4)                          |
| `--hidden-hands` | `yes` or `no`                       | Whether the pass-and-play curtain rises on every turn (`viewer`), `firstCurtain`, `curtainButtons`, `hides`    |

A slug with a hyphen is refused: it would need quoting as an object key and in every constant
(`gin-rummy` predates the rule).

## 3. The skeleton

`tools/new-game/templates.ts` writes Hive's shape (web/games/hive, the newest two-seat shell game,
docs/design/hive.md §7) with the game cut out. The placeholder engine is deliberately small and
deliberately real: two seats, Pass and Resign, a seeded draw of the winner after `MAX_TURNS`
passes, so the `Rng` seam, the seat check (`NOT_YOUR_TURN_MSG`) and the bot game that plays whole
games with the counts checked at every step are in place before the rules are.

| File                                    | What the skeleton holds                                                                                     | Rule it already meets                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `page.ts`, `index.html`                 | The `ShellPage` (the shell's home, the table with the names strip, a `#board` slot, the status line, the controls, the result sheet), composed by `tools/shell-markup.ts` | `shell-home`, `online-mode`                |
| `src/shellConfig.ts` (+ test)           | The `ShellGameData`: the id, the names, the modes, the copy, the two-seat option, the engine adapters       | `tables`                                   |
| `src/engine/engine.ts` (+ test)         | `Game`, `Intent`, `apply(game, intent, rng)`, `legalIntents`; the bot game                                  | AGENT.md step 2                            |
| `src/engine/view.ts` (+ test)           | `State`, `View`, `Action`, `applyAction`, `viewFor`, `legalActions`, the decoders                           | the trust boundary                         |
| `src/ui/state.ts` (+ test)              | The reducer over the shell: `pause: Pause \| null` raised by the end, cleared by `continue/click`; `viewer` with or without the curtain | `pauses`, `curtain`                        |
| `src/ui/sound.ts` (+ test)              | `CUES` over `...SHELL_CUES` with the game's `pass`                                                          | `cues`                                     |
| `src/ui/rules.ts` (+ test)              | Three `RULES_ITEMS` (the goal, the turn, the end) and the About copy, with one glossary link                | `rules-fit`                                |
| `src/ui/render.ts`, `src/ui/home.ts`    | The paint through `web/shared/edge/dom.ts`, the shell's painters, the curtain, every button bound           | `seats-on-table`                           |
| `src/protocol.ts`, `src/net/*`, `src/storage.ts`, `src/fx.ts` | The two-seat protocol, the sessions under the game's name, the shell store under its prefix, the cue player | `tables`                                   |
| `theme.css`, `assets/splash.svg`        | One accent over the shared tokens; the Open Graph card (the PNG is Hive's until `tools/splash.ts` runs)     | `landing`                                  |
| `e2e/fixtures/<g>.ts`, `e2e/<g>.spec.ts` | The hook readers and a pass-and-play spec at a phone (pass, resign, Continue)                              | AGENT.md step 9                            |
| `docs/design/<g>.md`                    | The rules row, every section a TODO                                                                         | AGENT.md step 1                            |

## 4. The registry

`tools/new-game/registry.ts` applies anchored text edits, each anchored on Hive's row (the newest
game), so a row that moved fails loudly (`<file>: anchor found 0 times`) rather than landing
somewhere else:

- `web/shared/lib/roomCode.ts`: the `Game` union, the four constants, the `ROOM_CODE` and
  `TYPED_CODE` rows; `web/shared/ui/ids.ts`: `SHELL_GAMES`.
- `tools/games.ts`: `GameSuite`, `ShellGame`, `SHELL_GAMES`, the `SHELL`, `REGISTRY` and
  `CONFORMANCE` rows (`pauses: ['over']`, `cues: ['pass']`, `cssFloor: 30`, `hides`; a seat range
  declares the `stepper` and `seat-names` gaps with Flip 7 as the follow-up).
- `tools/ci/suites.ts`: the suite row (its unit glob, its coverage include, one engine threshold
  row, `gameE2e`), the shell specs' job list, `gameRules`; `package.json`: `test:<g>` and
  `test:e2e:<g>`; `tsconfig.node.json`: the `src/**` include.
- `tools/shell-markup.ts`: the `PAGES` row; `e2e/fixtures/two-players.ts`: the driver;
  `e2e/fixtures/online-games.ts`: the `ShellDriver` row; `e2e/fixtures/site.ts`: the page-only
  spec; `e2e/shell-result.spec.ts`: the route to Leave; `tools/parity/computed-styles.ts`: the
  selectors, the drive, the `DRIVERS` row.
- `web/index.html`: the landing card (a generic glyph, to be chosen); `README.md`: the Play row.
- The pins of step 8, so they pass rather than fail on the new name: `tools/games.test.ts`,
  `tools/ci/suites.test.ts`, `tools/ci/affected.test.ts`, `web/shared/lib/roomCode.test.ts`,
  `web/shared/ui/ids.test.ts`, `test/dist/classes.test.ts`.

Not touched: `eslint.config.js` `GAMES` (the four games with cross-import zones), the class
contract (the skeleton toggles only classes the extraction sees), the computed-style goldens
(recorded once the table exists), the splash PNG (Hive's stands in).

## 5. The proof

`tools/new-game.test.ts` copies the checkout to a temp dir (node_modules linked, one commit),
scaffolds a throwaway game there and runs every gate that needs no build and no browser: `tsc -b`,
eslint and `prettier --check` over the game and the edited files, the game's suite, the harness
pins with the conformance suite, the shared pins and `test/dist/classes.test.ts`. Both shapes are
proved: two seats with nothing hidden, and a hidden hand with a seat range. Nothing scaffolded is
committed: the proof is the test.

## 6. What the scaffolder prints as left

The rules in `docs/design/<g>.md` and the engine; the one-screen Rules items, a cue per key
moment, a pause per consequential event; the table's markup and paint, then
`tools/shell-markup.ts --write`; the splash SVG and `tools/splash.ts`; `cssFloor` and
`contractFloors` measured after the first build, the coverage rows raised; the landing glyph and
the computed-style selectors, then the two goldens; for a seat range, the stepper (Flip 7's shape)
and the two gaps deleted.
