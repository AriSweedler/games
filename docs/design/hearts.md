# Hearts

TODO: the published rules for the games site. Scaffolded by `npm run new-game` (docs/design/new-game.md)
with 3 to 4 seats and a hidden hand (the pass-and-play curtain rises on every turn).
Every section below is a TODO row until the rules land; the placeholder engine (Pass, Resign, a
seeded draw after ten passes) is what the scaffold plays until then.

## 1. Sources

- TODO: the official rules, with the link.
- TODO: a second source that agrees on every rule the engine plays.

## 2. The rules as the engine plays them

TODO: the deck or pieces, a turn, the special cases, scoring, the end. The engine is
`web/games/hearts/src/engine/engine.ts`: `Game`, `Intent`, `apply(game, intent, rng)`; its test
plays whole bot games at every seat count with the counts checked at every step.

## 3. The page

On the shared shell (AGENT.md "Every game is a shared-shell game"): `page.ts` composes the home,
`shellConfig.ts` is the `ShellGameData`, `src/ui/state.ts` the reducer with the `table.pause` adapter every
consequential event is raised through (the shell holds it until its `pause/continue`), `src/ui/sound.ts`
the cue table over `SHELL_CUES`, `src/ui/render.ts` the table's paint. Seats: 3-4.
TODO: the scaffold seats two; the stepper, the seat names and the N-seat engine are Flip 7's shape (docs/design/flip7.md §8): `stepperHtml` in `page.ts`, `bindStepper` in `ui/home.ts`, `seats {min, max}` in `shellConfig.ts`. The CONFORMANCE row declares the `stepper` and `seat-names` gaps until then.

## 4. The Rules tab (one screen)

The items in `src/ui/rules.ts` (`RULES_ITEMS`), the goal first, then the turn, then one line per
special case, fitting 390x844 with no scroll:

- Goal: TODO
- A turn: TODO
- TODO: one line per special case

## 5. Tests and the suite

`npm run test:hearts` (the engine, the view adapters, the reducer, the shell config, the rules, the
cues), the conformance suite (`npm run test:harness`), `e2e/hearts.spec.ts` at a phone. TODO: raise
the coverage thresholds in `tools/ci/suites.ts` as the engine lands.
