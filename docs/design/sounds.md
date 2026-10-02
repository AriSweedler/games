# Sounds: every game's moments and the cue each plays

The owner, 2026-10-02: "make sure the sounds are integrated well with uno and with flip7 and all
other games." This is the audit: game × moment × cue, with the gaps marked, and what closed them.

## 1. How a cue reaches the speaker (the same in every game)

1. A game's `ui/sound.ts` is its one table: each event the game raises, onto a cue of the shared
   vocabulary (web/shared/lib/sound/cues.ts, twenty base cues; a qualified id like `bad.bust` is
   still a `bad`) with its vibration pattern. The first four rows are the shell's (`SHELL_CUES`:
   tap, yourTurn, win, lose).
2. The reducer derives the events from the change between two views (`cuesBetween(prev, next)` or
   briscola's `phraseOf(event)`) inside `rendered`, and plays them only when the position's key is
   new (`CueMemory`/`fresh`): once per state change, never on a repaint, never on a re-sent frame.
3. Each event is an `fx` effect; the edge (web/shared/edge/boot.ts) hands it to the game's
   `fx.ts`, the shared cue player (web/shared/edge/cuePlayer.ts) over the table and the game's
   `<game>_sound` key.
4. The player resolves the row in the App's font (fonts.ts: `default`, `felt`, `arcade`; the
   default font voices every base cue with a synth, so no audio file is needed) and gates
   everything on `audio.enabled()`: the shell's `#soundBtn` toggle flips it and persists it, and a
   muted player plays no sound and skips the buzz. One toggle governs every cue of every game.

So "integrated" means: the table has a row per moment, `cuesBetween` fires it once, and nothing
names a sound outside `ui/sound.ts`.

## 2. The audit (2026-10-02, at `0f0f3b5f` on main)

Legend: **cue** is the id the row spells (its base is what the default font plays). _Gap_ marks a
moment with no row before this audit; _by design_ a moment the owner's design leaves silent.

### UNO (`web/games/uno/src/ui/sound.ts`)

Shipped with two rows beyond the shell's (`play`, `draw`), both on `move`.

| Moment | Cue | Before this audit |
| --- | --- | --- |
| A tap acknowledged | `tap` | shell |
| My turn (online) | `turn` | shell |
| A number card laid (every seat hears it) | `move` | `play` |
| A card drawn from the stock, by any seat | `draw` | `draw` was on `move`: fixed (the stock is face down) |
| Skip | `neutral.skip` | _gap_ |
| Reverse | `neutral.reverse` | _gap_ |
| Draw Two laid (the table) | `challenge.draw2` | _gap_ |
| Wild or Wild Draw Four laid (a colour to name) | `move.wild` | _gap_ |
| The colour named after a Wild Draw Four (its four cards land) | `challenge.wild4` | _gap_ |
| The two or four cards landed in MY hand | `bad.penalty` (instead of the table's sting) | _gap_ |
| Play again: a new deal | `start.deal` | _gap_ |
| The game won / lost (one round is the game) | `victory` / `loss` | shell |
| "UNO!" called | — | _gap, needs the engine_: the call and its penalty are UNO's §8 follow-up (not in `Intent`); the row is `good.uno` when it lands |
| A call-out penalty | — | _gap, needs the engine_: `bad.penalty` fits once the engine has it |
| The stock reshuffled from the pile | — | _by design_ (no visible moment) |

Who hears: every card is seen by every seat, so a play sounds at every device; the penalty is the
one listener-dependent row (`View.seat`'s hand grew by two or more).

### Flip 7 (`web/games/flip7/src/ui/sound.ts`, new)

Shipped with the shell's four rows only (`fx.ts` over `SHELL_CUES`), and the win/loss fired from
`rendered` online.

| Moment | Cue | Before this audit |
| --- | --- | --- |
| A tap acknowledged | `tap` | shell |
| My turn (online) | `turn` | shell (not yet fired: see follow-ups) |
| A number flipped into a line | `draw` | _gap_ |
| A modifier (+2…+10, ×2) flipped | `score.modifier` | _gap_ |
| A Second Chance taken (flipped or given) | `good.second` | _gap_ |
| A duplicate taken by the Second Chance (the save) | `good.save` | _gap_ |
| A duplicate with no Second Chance: the bust | `bad.bust` | _gap_ |
| A Freeze given: its taker banks and sits out | `neutral.freeze` | _gap_ |
| A Flip Three given: two or three cards land in one step | `challenge.flip3`, then each card | _gap_ |
| A stay: the line banked | `score.stay` | _gap_ |
| Seven distinct numbers: the bonus | `great.flip7` | _gap_ |
| The round settled | `neutral.round` | _gap_ |
| The next round dealt (and a new game) | `start.deal` | _gap_ |
| The game won / lost (the shared phone hears the win) | `victory` / `loss` | shell (online only) |
| An action card drawn, waiting for a taker | — | _by design_: the gift sounds when given |

Who hears: everyone watches the same lines, so the table's sounds are the same at every device
(a bust is a bust, whoever's), as backgammon's hit is heard by both seats; only the end is mine.

### Gin rummy (`web/games/gin-rummy/src/ui/sound.ts`, `ui/cues.ts`)

| Moment | Cue | Note |
| --- | --- | --- |
| A tap (select, menus) | `tap` | |
| My turn | `turn` | |
| The opponent drew from the stock / took the discard | `draw` / `pickup` | |
| A knock that scored / gin | `good` / `great` | |
| The hand lost / void | `bad` / `neutral` | |
| The game won / lost | `victory` / `loss` | |
| My own draw, my discard, the deal | — | _by design_: the legacy `playCuesFor` never fired here and `test/parity/gin.ui.test.ts` pins the machine; the player holds the card they moved |

### Backgammon (`web/games/backgammon/src/ui/sound.ts`)

| Moment | Cue | Note |
| --- | --- | --- |
| A tap | `tap` | |
| The roll / a double rolled | `roll` / `good` | |
| A checker placed / a blot hit / a checker borne off | `move` / `capture` / `score` | |
| The cube offered | `challenge` | |
| My turn; the game won / lost | `turn`; `victory` / `loss` | |
| The cube taken or dropped | — | _gap_: `good.take` / `bad.drop` from `phase` leaving `cubeOffered`; needs `cuesBetween` in `ui/state.ts` to read the cube's owner |
| The opening roll | — | _gap_ (minor): `start` when `prev.phase` is the opening |

### Briscola (`web/games/briscola/src/ui/sound.ts`)

Fifty-three ids: the deal, each card laid, the draw, the trump taken, the whole trick-outcome
grid (`briscola-sound-history.md` §4), the exchange, the game's and the match's ends, a refused
tap. Complete; nothing to add.

### Fidice (`web/games/fidice/src/ui/sound.ts`)

| Moment | Cue | Note |
| --- | --- | --- |
| A tap; my turn; the game won / lost | shell's four | |
| The roll, the bid, the call, the reveal, a refused action | — | _gap_: the M9 rows of `fidice-shell-adoption.md` §7 D11; `cuesBetween(prev, next, app)` already keys `round.rolled`/`round.bid`/`reveal`, so the rows are `roll`, `challenge.bid`, `neutral.call`, `good.reveal`/`bad.reveal`, `bad.refused` once that function returns them |

### Hive (`web/games/hive/src/ui/sound.ts`)

| Moment | Cue | Note |
| --- | --- | --- |
| A tap; my turn | `tap`; `turn` | |
| A tile placed / a tile moved | `move` (two rows, `place` and `move`) | both on the base `move`; a font cannot voice them apart: qualify as `move.place` / `move.slide` when touched next |
| The game won / lost | `victory` / `loss` | |
| A draw (both queens surrounded) | — | _gap_: `neutral.draw` from `result.kind === 'draw'` (the branch returns `[]` today) |
| A forced pass | — | _gap_ (minor): `neutral.pass` |

### RPS (`web/games/rps/src/ui/sound.ts`)

The resolve (`start`, with the owner's 30 ms buzz that also fires muted), the four verdicts
(`good`/`neutral`/`bad`/`bad.timeout`), Tech up (`great`), Reset (`undo`). Complete per
`rps-island.md` §3.

## 3. What this audit changed

- `web/games/uno/src/ui/sound.ts`: the table above and `cuesBetween(prev, next)`, the pure
  classifier (a deal, the win or loss, a card laid by its kind with the penalty for the taker, the
  Wild Draw Four's colour, a draw). `web/games/uno/src/ui/sound.test.ts` pins the mapping, that
  every id resolves in the default font, and one cue per moment over hand-built positions.
- `web/games/flip7/src/ui/sound.ts` (new): the table above, `cuesBetween(prev, next, local)` and
  `cueKey(view)`. `sound.test.ts` pins the same, including a Flip Three, a save, a bust, the Flip 7
  and the deal.

## 4. Follow-ups (the wiring this lane did not own)

The lane owned each game's `ui/sound*.ts` only (the uno and flip7 reducers were other lanes'), so
the classifiers are written and tested but not yet called. Each is a few lines:

1. **UNO** `ui/state.ts`: delete its three-row `cuesBetween` and import the one from `./sound.ts`
   (same signature; the existing `state.test.ts` expectations for `play`/`draw`/`win`/`lose`
   still hold). `cueKey` there already keys `drawCount`, `top.id`, `turn` and `phase`, so the
   colour named and the penalty are fresh positions.
2. **Flip 7** `fx.ts`: `cues: CUES` from `./ui/sound.ts` in place of `SHELL_CUES`, and `Cue` from
   there. `ui/state.ts`: `Cue: Cue` and `Cues: CueState` in the `Flip7` types, `cues: { initial:
   INITIAL_CUES }` in `shellConfig.ts`, and `rendered` plays `cuesBetween(prev, view, role ===
   'local')` when `cueKey(view)` is fresh against `app.shell.cues.key` (as uno's and hive's
   `rendered` do), plus `yourTurn` when `isMyTurn` turns on online. Its win/loss edge detection
   then goes, since the classifier covers it.
3. **UNO's call** needs the engine (`uno.md` §8): a `View` flag or event for "UNO called" and the
   penalty; the rows are named above.
4. The minor gaps in backgammon, fidice and hive are listed in their tables with the flag each
   needs.
