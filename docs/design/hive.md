# Hive

Hive (John Yianni, Gen42 Games, 2001) for the games site: the rules as published and a pure engine
that plays them. The owner's ask (2026-10-02): "start working on the hexagonal board game hive
next", under the standing asks for the new games: "Look up the rules, use the shell … Just make it
as simple as possible", "the ruleset to teach players should be as short as possible, ideally
fitting on 1 screen" and "Any multiplayer game must necessarily also have a multiplayer component
via the shell". This document is the rules row: the sources, the scope, the grid, the rules the
engine plays and the one-screen Rules tab. The page and its online seats are rows of their own (§7).

Hive has no board, no dice and nothing hidden: two players add hexagonal tiles to one growing
group, the hive, and move them around it. On one phone, pass-and-play is alternating turns on one
screen, with no curtain between them.

## 1. Sources

- Gen42 Games, the official rules: <https://www.gen42.com/wp-content/uploads/Hive-rules.pdf>,
  linked as "English Rules" from <https://www.gen42.com/product/hive/>. The PDF is a scanned
  booklet with no text layer; the wording below comes from the two summaries that follow, which
  agree on every rule this engine plays.
- Wikipedia, "Hive (game)": <https://en.wikipedia.org/wiki/Hive_(game)>. The tiles per side, the
  placement rules, the One Hive rule ("a piece may never be moved such that during or after its
  movement, there are two separate groups of pieces in play"), Freedom of Movement, each bug, the
  end and the two draws, the tournament opening rule.
- World Hive Tournaments, the rules FAQ: <https://www.worldhivetournaments.com/rules-of-hive/>.
  The pass ("you cannot pass if you have any moves available, even if there are only bad ones"),
  the Spider (three spaces around the hive "without moving through a space it has already occupied
  during the movement"), a draw by repetition or by agreement.
- BoardGameGeek, the Hive FAQ: <https://boardgamegeek.com/wiki/page/Hive_FAQ>. Freedom to Move
  above the ground: a Beetle cannot pass between two stacks that are both higher than the hex it
  leaves (without it) and the hex it enters (the "beetle gate").

## 2. Scope of the MVP

The base game for two players. Each side has eleven tiles (web/games/hive/src/engine/pieces.ts):

| bug | count | letter | glyph |
| --- | --- | --- | --- |
| Queen Bee | 1 | Q | 🐝 |
| Beetle | 2 | B | 🪲 |
| Grasshopper | 3 | G | 🦗 |
| Spider | 2 | S | 🕷️ |
| Soldier Ant | 3 | A | 🐜 |

The letters are the usual notation (`wQ` is the white Queen). The glyphs are the plain base pack:
a tile is its colour and its bug, nothing drawn.

Not in the MVP: the Mosquito, Ladybug and Pillbug expansions; the tournament opening rule (no
Queen on a side's first tile: the base rules allow her there); a draw by repetition, which the
page offers as a button instead of detecting (§7).

## 3. The grid

Axial coordinates `(q, r)` on a grid with no edges (web/games/hive/src/engine/hex.ts). The six
neighbour offsets, in turning order:

```
(+1, 0)  (+1, -1)  (0, -1)  (-1, 0)  (-1, +1)  (0, +1)
```

Each offset touches the one before it and the one after it, so the two hexes that touch both ends
of a step along offset `i` are the neighbours along `i - 1` and `i + 1`: the gap a sliding tile
passes through. The distance between two hexes is `(|dq| + |dr| + |dq + dr|) / 2`. `ring(c, r)`
walks the `6r` hexes `r` steps from `c`, each touching the next.

The board is a record from a hex's key (`"q,r"`) to its stack: an array of tiles, bottom first.
An empty hex has no entry. A stack's height is its length, and its colour is its top tile's. The
first tile goes at the origin, since every first hex is the same on a grid with no edges.

## 4. The rules as the engine plays them

web/games/hive/src/engine/engine.ts: `newGame(names)`, `legalPlacements(game)`,
`legalMoves(game, from)`, `legalTurns(game)` (both lists as intents) and `apply(game, intent)`,
where an intent is `place` (a bug, a hex), `move` (from a hex, to a hex), `pass` or `resign` (by
the side to move). The state holds the board, both hands (how many of each bug are left), the side
to move, the turns each side has taken and the result. An intent that does not apply leaves the
state as it was and sets the note to the reason.

### 4.1 Placing

On a turn a player places a tile from the hand or moves one of their tiles on the board. White's
first tile goes anywhere (the origin); Black's first tile touches it. After that, a new tile goes
on an empty hex that touches at least one stack of the player's colour and no stack of the other
colour. A tile is always placed on the ground: a Beetle reaches the top of the hive only by moving.

### 4.2 The Queen by the fourth tile

A player's Queen Bee must be among their first four tiles: a player who has placed three tiles
without her may place only her. Until a player's Queen is down, none of their tiles may move. The
sources say "by the fourth turn"; the engine counts tiles, which is the same thing unless a player
had to pass before placing her.

### 4.3 One Hive

The tiles must always form one group. A tile may not move if lifting it would split the hive, even
when the hex it moves to would join the parts again: the hive may not split during a move either.
A Beetle lifted off a stack leaves the stack behind, so it never splits the hive.

### 4.4 Freedom to Move

Tiles slide. Stepping between two neighbouring hexes, a tile passes between the two hexes that
touch both; it cannot squeeze through when both are occupied. A sliding tile must also stay in
touch with the hive, so exactly one of the two may be occupied. Above the ground the same rule is
read in heights: the tile travels at the level of the taller of the stack it leaves (without it)
and the stack it enters, and it is blocked only when both hexes beside the gap are taller than
that level. On the ground this is the plain rule; it lets a Beetle climb onto the hive and drop
into a hex that a sliding tile cannot reach. The Grasshopper jumps, so the rule does not apply to it.

### 4.5 Queen Bee and Beetle

- **Queen Bee:** slides one hex.
- **Beetle:** moves one hex in any direction, onto the hive too. A tile with a Beetle on top cannot
  move, and the stack takes the Beetle's colour for placing. Beetles may stack on Beetles.

### 4.6 Grasshopper, Spider and Soldier Ant

- **Grasshopper:** jumps in a straight line over one or more tiles in a row and lands on the first
  empty hex. It cannot jump a gap or move without jumping.
- **Spider:** slides exactly three hexes around the hive, never entering a hex twice in the move.
  The engine also names each walk: `spiderPaths(game, from)` keys the three hexes stepped on, in
  order, by the destination (the first walk found where several reach one hex), behind the same
  gate as `legalMoves`; the page shows them as 1-2-3 while a Spider is picked and hops her along
  them as she moves (the owner: "the spider's moves must show the '1-2-3' when it moves, as a
  special case").
- **Soldier Ant:** slides any number of hexes around the hive.

### 4.7 Passing

A player with no legal placement and no legal move passes. A pass is refused while any placement
or move exists.

### 4.8 The end

The game ends when a Queen Bee is surrounded on all six sides, by tiles of either colour; her
owner loses. If one turn surrounds both Queens, the game is a draw. A player may resign on their
turn. The sources also call a game drawn by repetition or by agreement; the engine does not detect
repetition (§7).

## 5. The Rules tab (one screen)

**Goal:** surround the other Queen on all six sides. Both at once: a draw.

**Place** a tile touching only your colour (the first two just touch). Queen down by your fourth
tile; no moves before her.

**Or move a tile:**

- 🐝 Queen: 1 step.
- 🪲 Beetle: 1 step, may climb on; a covered tile is stuck.
- 🦗 Grasshopper: jumps a straight line of tiles.
- 🕷️ Spider: exactly 3 steps around the hive.
- 🐜 Ant: any distance around the hive.

**The hive never splits**, even mid-move; tiles slide, never squeezing through a gap. No play?
Pass.

## 6. Tests and the suite

`npm run test:hive`, beside the modules: the grid (keys, the turning order, rings, the gap of a
step, Freedom to Move on the ground and above it, the flood fill, connectivity, the exact-length
walks); the tiles; and the rules from hand-built positions: the first two placements and the colour
rule (a stack counts as its top tile's colour), the Queen by the fourth tile and no move before
her, each bug's moves (the Queen's one step, the Beetle's climb and pin, the beetle gate, the
Grasshopper's line, the Spider's exactly three and her paths (`spiderPaths`: over every Spider
move of the bot games the paths end exactly where `legalMoves` does, each a chain of single steps
with no hex twice, every hex stepped on empty and touching the hive left behind), the Ant
everywhere it can slide), the cup a tile
cannot slide into or out of, One Hive mid-move, the pass, a surrounded Queen, both Queens at once
and resigning. Three seeded random bot games of up to 200 turns check every turn: the intent came
off the legal lists, every tile is kept, the hive is one group, the Queen is down by the fourth
tile and only Beetles stand above the ground.

The page's own tests sit beside its modules too: the reducer (ui/state.test.ts: pass and play
starts on White's table with no curtain and the view changes hands as the turn does, the picks, a
refusal, the result sheet, the aim a picked Spider's path is numbered to and the hop her move
lands as), the board's fit (ui/board.test.ts: the fit of a hive equals the fit
of the same hive plus its ring, and through three seeded games every legal destination lies inside
it, so a pick never changes the viewBox) and the bugs on the tiles (ui/bugs.test.ts: a file
becomes a `<symbol>` with its stroke-width stripped, the sprite carries every bug once with the
tiles' gradients and filters, each fit keeps the art inside the hex, and a drawn bug is four layers
of the one symbol at the set's one line weight), the paint (ui/render.test.ts: 1-2-3 along the picked
Spider's path to the aimed hex, the way drawn as trail cells under the hive, the hop's path numbered
as the move lands and nothing once it has) and the hop's stops and offsets (ui/motion.test.ts: three
legs of one hex each, two ends under reduced motion). e2e/hive.spec.ts reads the same facts off the page
(the curtain hidden throughout, the viewBox the same string before and after a pick), the tray's
tiles as hexagons of at least 44px with the bug's `<use>` inside and the sprite in the body, and
finds the Queen on the board by her `data-bug`, not a letter; with the mouse over a lit hex it reads
the Spider's 1-2-3 and watches her land at the end of the hop. The computed-style goldens
(test/fixtures/styles/hive.*.json) pin the engraved look: the rim, the shade and the gleam on each
side, and the ink's colour for every bug on both trays. The drag (§7) has a pointer-sequence test beside its module
(ui/dragger.test.ts over the page fake: the intents in order, the ghost's place and its following,
the snap to the nearest lit hex once per change, the glide back, a press that never moves staying a
tap) and the reducer's half in ui/state.test.ts (`drag/start` picks, `drag/over` holds a reachable
hex once, `drag/end` plays or drops, the release's click ignored while the drag stands);
e2e/hive.spec.ts drags with `page.mouse`: a tray tile onto the lit hex (the snap from beside it, the
`drop` light), one released off every hex snapping back, and a board tile across the hive.

Hive was the first engine-only game in tools/ci/suites.ts (`ENGINE_ONLY`) until its page row
(§7) registered it in tools/games.ts as a shell game: its suite now has both halves (the unit tests
under coverage, e2e/hive.spec.ts and its `@hive` describes of the shell specs), a landing card and
the smoke.

## 7. The page

web/games/hive/, a shell game (docs/design/shared-shell.md) from the start, as the owner asked of
every multiplayer game: page.ts composed by tools/shell-markup.ts into index.html, two modes
(Online and Pass the phone), the tabs Play, Rules (§5) and About, two seats and no option (White is
seat 0, the host or the first name; Black seat 1). The table (ui/render.ts) is the names strip, an
SVG board that fits itself to the hive and its ring (ui/board.ts: pointy-top axial hexes, a `g.hex`
per occupied hex plus the hexes the picked tile may reach, the origin alone on an empty board), the
two hands as trays of hexagonal tiles with their counts, Pass when the seat must, Resign while the game is on, and the
status line. A tap on a hand tile lights its placements, a tap on a tile already down lights its
moves, a tap on a lit hex plays (ui/state.ts `tap/hex`); the engine's refusal is a toast.

The tiles drag too (the owner, 2026-10-02: "The tiles must be click-and-draggable instead of just
click-and-click to move"): ui/dragger.ts tells the shared pointer-drag kernel (web/shared/edge/drag.ts,
dry-round-2.md E1) what a press on the trays or the board picks up (a playable tray tile, one of my
`movable` board tiles), and past the kernel's threshold `drag/start` picks the tile as a tap would (the
same hexes light; the source dims as `dragging`) while the kernel's ghost, the tile's clone, follows the
pointer: a tray tile clones as it is; a board tile is a `g` in the SVG, which would not render on the
body, so the paint lays a nested `svg.lift` over the picked cell (render.ts `liftHtml`, hidden by its
own rule) for the kernel to clone. Every move snaps to the lit hex nearest the pointer within 0.9 of a
hex's width (`nearestLit`; a thumb covers the hex it is over) and `drag/over` marks it `drop`; a release
on it plays the tile through the same `act` as a tap, a release anywhere else glides the ghost back
(180ms, a millisecond under reduced motion) and drops the pick. The board and the playable tiles take
`touch-action: none`, so a finger drags the tile, never the page; the tap-tap path stays as the
fallback for keyboards and assistive tech, and the click a release fires is nothing while the drag
stands.

Pass the phone raises no curtain (the owner, 2026-10-02: "hive is like backgammon, where you don't
need to pass the phone for turns. It's just a game."): nothing is hidden, so both players share the
one screen, the table is on show from Start (White's view) and the view changes hands as the turn
does, the status line carrying the last move; the shell composes its curtain as on every shell page
but ui/state.ts `viewer` never raises it (tools/games.ts SHELL `firstCurtain` null, which the shell
specs read). Until then the curtain was the pause between turns with the last move written on it.
The end is a sheet over the final board (the winner or the draw, the engine's note) whose Continue
leaves the board on show with Play again beside it.

The hands are trays of hexagonal tiles (the owner, 2026-10-02: "they are squares in your hand. They
should be hexagonal in the hand"): each a bare button around an SVG of the board's own hexagon
(ui/board.ts `cornersOf`, the same inset) in the side's colour with the bug engraved at its centre
(ui/bugs.ts: the five assets/bugs/ files inlined once as symbols, each fitted to the same hexagonal
frame at one line weight, in the official palette with a shade for each tile colour, a hairline
grey rim and an up-left shadow and down-right gleam so it reads as cut into the tile; the face has a
sheen, a bevelled edge and a shadow on the felt, and a stack's top tile is raised) and the count
left as a badge on its upper-right edge, at least 44px wide to tap; a playable tile
has an amber edge, the picked one a thicker edge and a lift. Any tile may be picked at any time
(Hive has no hand order), the Queen alone when she must come down. The board's viewBox fits the hive
and the ring of hexes around it (ui/board.ts `fitCells`; the owner: "preshrink the board so there is
no jarring visual movement when you select or deselect stuff"): every placement and every move lands
in that ring, so lighting a pick's hexes never rescales or pans the board, and only a tile that
extends the ring moves the fit, once, after it is played.
Online, the host holds the state (engine/view.ts `State`) and both seats get the same view, the
whole game, over the two-seat protocol (protocol.ts: the room's one term is `seatCount: 2`).

Not yet: a draw button (§4.8: by agreement or repetition; the engine has no draw intent), pan and
zoom by gesture (the board fits itself instead).
