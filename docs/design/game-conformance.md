# Game conformance

The audit of every registered shell game against the rules `AGENT.md` states, and the suite that
holds each game to them. The owner, 2026-10-02: "audit the incorrect behavior of the new games and
guard against these failures to the best of your ability via nice tests, that way even dumb agents
will be able to do the right thing", and, on UNO's old menu staying live for hours: "Make it
impossible to have a bad menu like this."

## 1. The rules

One id per rule, as the suite names it in a failure (`<game>: <rule>: <what to fix>`); each is an
`AGENT.md` bullet.

| Rule             | AGENT.md                                               | What is checked                                                                                                              |
| ---------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `shell-home`     | Every game is a shared-shell game; page.ts is the source | `page.ts`, `shellConfig.ts` and the composed `index.html` exist; the served page has the shell's host and join cards, mode switch and Rules tab |
| `online-mode`    | Every game is a shared-shell game                      | `Online` is one of the modes                                                                                                 |
| `stepper`        | The player count is the shared stepper                 | `shellConfig.ts` `seats` equals the declared range; the stepper is placed twice at that range; no `<select>` picks a player count |
| `seat-names`     | The player count is the shared stepper                 | Pass and play shows one name input per seat at the stepper's minimum and at its maximum                                     |
| `rules-fit`      | The Rules tab fits one phone screen                    | `RULES_ITEMS` exported; at 390x844 the Rules tab neither scrolls the document nor an ancestor of `#rulesList`                |
| `seats-on-table` | The table shows every seat                             | Two seats by name: `e2e/shell-local.spec.ts`; N seats: the game's own spec (briscola-online, flip7-local)                   |
| `pauses`         | Understand what happened before proceeding             | The declared pauses (the statuses or events) are raised in `ui/state.ts` through the shell's `table.pause` adapter; the shell's `pause/continue` clears them |
| `cues`           | Every key moment has a sound cue, once                 | `src/ui/sound.ts` spreads `SHELL_CUES` and has a row per declared cue                                                       |
| `landing`        | The menu                                               | The landing card, the README "Play" row, `assets/splash.svg` and its PNG; no alias shadows the game                         |
| `tables`         | A new game, step 7                                     | A row in `REGISTRY`, `SHELL`, `ROOM_CODE` and `ids.ts SHELL_GAMES`; `randomCode` and `sanitiseCode` total                   |
| `curtain`        | Hidden hands                                           | On a game that hides a hand (`hides`), with the pass-and-play curtain up the overlay's scrim is opaque or the table is hidden under it |
| `home-felt`      | Every game is a shared-shell game (the shell paints no body) | The home's body is painted (not white or transparent) with the declared `felt` token's paint; the title reads at 4.5:1 or better against every opaque colour under it |

## 2. The suite

Three halves, every one parametrised over `tools/games.ts` `SHELL_GAMES` (the one list) and reading
each game's `CONFORMANCE` row (its seat range, its pause kinds, its cues, its CSS floor and its
declared gaps). A rule a game is known to miss is a declared gap with a follow-up; the suite reports
it as a skip or a `fixme` that names the game, the rule and the follow-up, never as green. Closing
a gap is deleting its row: the case then runs.

| Half    | File                                | Suite      | Needs                      |
| ------- | ----------------------------------- | ---------- | -------------------------- |
| Source  | `test/game-conformance.test.ts`     | `harness`  | nothing: the sources and the tables |
| Built   | `test/dist/game-conformance.test.ts` | `site`    | the build (`npm run test:site`) |
| Browser | `e2e/shell-conformance.spec.ts`     | `e2e-<g>`  | a page, 390x844, page-only |

The built half is the "impossible to have a bad menu" guard: a registered game whose served home is
not the shell's fails the build, and a solo page (`SOLO_PAGES`) that serves the shell's home or a
player count fails too (a game with seats registered as a solo page is the same mistake). The
source half also fails on a folder under `web/games/` no table names, and on a folder with a
`shellConfig.ts` that is not in `SHELL_GAMES`.

The class-contract guard's CSS floor is per game (`cssFloor`): the one shared floor sat under the
smallest game and was lowered twice in a day (100 → 80 → 75) as smaller games registered.

## 3. The audit (2026-10-02)

Found broken: ✗. Meets the rule: ✓. A declared gap is a ✗ with its follow-up in the row's
`gaps`; the guard column names the half that holds the rule.

| Game       | shell-home | online-mode | stepper                 | seat-names                 | rules-fit        | pauses                     | cues                          | landing | tables | curtain                      |
| ---------- | ---------- | ----------- | ----------------------- | -------------------------- | ---------------- | -------------------------- | ----------------------------- | ------- | ------ | ---------------------------- |
| gin-rummy  | ✓          | ✓           | ✓ (two seats)           | ✓                          | ✗ 1099px         | ✗ knock/gin opens the sheet | ✓                            | ✓       | ✓      | ✓                            |
| fidice     | ✓          | ✓           | ✗ `#seatsSel` select    | ✓                          | ✗ 2130px         | ✗ no pause                 | ✗ SHELL_CUES alone (M9)       | ✓       | ✓      | ✗ no scrim (0)               |
| backgammon | ✓          | ✓           | ✓ (two seats)           | ✓                          | ✗ 1146px         | ✗ turn gate only           | ✓                             | ✓       | ✓      | — (hides nothing; 0.78)      |
| briscola   | ✓          | ✓           | ✓ 2-4                   | ✓ 4 inputs                 | ✗ 1109px         | ✗ no pause on a trick      | ✓                             | ✓       | ✓      | ✗ 0.78 by design, hand face down |
| uno        | ✓ (since the shell page) | ✓ | ✓ 2-12                 | ✓ 12 inputs (since #32)    | ✓                | ✗ no pause on a penalty    | ✓                             | ✓       | ✓      | ✗ hand shows through         |
| flip7      | ✓          | ✓           | ✓ 2-12                  | ✓ 12 inputs                | ✓                | ✓ bust, frozen, flip7      | ✓ (since #29)                 | ✓       | ✓      | — (hides nothing; 0)         |
| hive       | ✓          | ✓           | ✓ (two seats)           | ✓                          | ✓                | ✗ no pause at the end      | ✓                             | ✓       | ✓      | — (no curtain)               |

Guarded by: `shell-home`, `online-mode`, `landing`, `tables`, `cues`, `pauses`: the source half;
`shell-home`, `stepper` (markup): the built half; `stepper`, `seat-names`, `rules-fit`, `curtain`,
`home-felt`: the browser half.

What the audit of UNO and Flip 7 found beyond the table, before the shell turn (the lanes fixed
them; the rules above keep them fixed): a home of their own instead of the shell's, a `<select>`
for players, no Rules tab, no opponents' counts, no pause after a bust, no sounds, a 10-player cap.
Found the same evening, after the shell turn: Flip 7's home white (its theme painted no body, so
the shell's chrome sat on the browser's default; the `home-felt` rule, 2026-10-02).

## 4. Follow-ups

Each is a `gaps` row in `tools/games.ts`; closing one is the fix plus deleting the row.

- UNO and fidice `curtain` (0 opaque, the hand and the cups show through): the scrim lane paints
  `.overlay.curtain` opaque in `shell.css`; delete both rows when it lands. Briscola's is 78%
  terracotta by design (theme.css, design §5.4) with the hand face down: the guard needs a
  face-down check, or the scrim goes opaque. Gin's is opaque. Sheshbesh (0.78) and Flip 7 (0)
  hide nothing (`hides: false`), so the rule does not reach them.
- `rules-fit` on gin, fidice, backgammon, briscola: cut each `RULES_ITEMS` to the goal, the turn
  and one line per special case (UNO fits in seven, Flip 7 in eight).
- `pauses` on gin, fidice, backgammon, briscola, UNO, hive: a `table.pause` adapter in `ui/state.ts`
  after Flip 7's `pauseFor` (the shell holds and paints it, dry-review-2026-10.md §7 row 13), for
  the events in AGENT.md's table.
- `cues` on fidice: rows of its own in `src/ui/sound.ts` (M9). Flip 7's table landed in #29 while
  this audit ran; its row declares five of its cues.
- `home-felt` on UNO (the wordmark's red, 1.85:1 on the felt) and Hive (the amber title, 3.62:1):
  a lighter ink for the h1 alone, or a plate behind it; the guard measures the title against every
  opaque stop of the body's paint. Flip 7's white home (no body rule in its theme) was the finding
  that made the rule; its theme paints the felt since 2026-10-02.
- UNO is a single-round game (the owner: "more like briscola"): a rule for the suite once the
  engines declare their round shape.
