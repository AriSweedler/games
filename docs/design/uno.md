# UNO

A clone of UNO for the games site: the rules as published, an engine that plays them, and a
pass-and-play page on one phone as the MVP. The owner's ask (2026-10-02): "I want to create a clone
of UNO … Look up the rules, use the shell, and don't worry about card art being accurate for the
base packs. Just make it as simple as possible."

## 1. Sources

- Mattel's UNO instruction sheet (service.mattel.com/instruction_sheets/42001pr.pdf): the official
  rules; the 108-card deck, the deal, the action cards, scoring to 500.
- unorules.com "UNO rules": the same rules in prose, with the two-player variations and the UNO
  call's penalty.
- Wikipedia, "Uno (card game)": the exact deck composition and the Wild Draw Four challenge.

Where the sources differ (the 2022 rules make the 500-point game optional), this engine plays the
classic 500-point game.

## 2. The deck

108 cards. Per colour (red, yellow, green, blue): one 0, two each of 1-9, two Skip, two Reverse,
two Draw Two (25 cards). Colourless: four Wild, four Wild Draw Four. `makeDeck`
(web/games/uno/src/engine/cards.ts) spells it; ids are `<colour letter><face><copy>` (`r0`, `g7b`,
`bSa`) and `W1`-`W4`, `F1`-`F4` for the wilds.

## 3. Setup and a turn

Each player gets seven cards. The next card opens the discard pile; a Wild Draw Four there goes back
(the engine opens with the first other card and keeps the rest in order). The opener's action
applies to the first player: a Skip skips them; a Reverse makes the dealer (the last seat) first and
turns the direction (at two players the other player simply starts); a Draw Two deals them two and
skips them; a Wild has them name the colour, then play.

On a turn the player plays one card that matches the top card by colour, by number or by symbol (a
wild always matches), or draws one card. A drawn card that matches may be played at once; otherwise
(or by choice) the player keeps it and the turn passes. A player may draw even with a playable
card in hand. When the draw pile runs out, the discards under the top card are shuffled into a new
pile.

## 4. Action cards

| card | effect |
| --- | --- |
| Skip | the next player misses a turn |
| Reverse | the direction of play turns; at two players it acts as a Skip |
| Draw Two | the next player draws two and misses a turn |
| Wild | the player names the colour in play |
| Wild Draw Four | the player names the colour; the next player draws four and misses a turn |

Two-player consequences fall out of the rules above: after a Draw Two or a Wild Draw Four the
turn comes straight back.

## 5. Going out

The game ends the moment a hand is empty: its player wins. Going out on an action card or a wild
wins before the card acts (no colour is named, nobody draws).

## 6. One round is the game

The owner, 2026-10-02: "UNO should only be single round games. NOT like ginrummy. But more like
briscola". There are no points and no target: the first empty hand wins, the result sheet names
the winner and the cards every other seat still held, and Play again (the engine's `again`)
deals a fresh game for the same seats. The printed rules' scoring (number cards their face, actions
20, wilds 50, first to 500) is not played.

## 7. The MVP: pass-and-play on one phone

A solo page (tools/games.ts `SOLO_PAGES`, like the reaction game) at `/uno/`: no network, no room
code, no shell seats yet. Three screens (web/games/uno/src/ui/state.ts): the setup (two to six
seats, names), the curtain ("pass the phone to …", which also repeats what just happened so the
next player knows what hit them) and the table (the current hand as tiles, the top card and the
colour in play, the direction, every seat's card count, Draw, Keep-and-pass after a drawn card,
the colour picker for a wild, the scores with Next round when a hand empties). The curtain drops
whenever the turn lands on another seat.

The base pack is plain by design: a tile is its colour and a glyph (the digit, ⊘ for Skip, ⇄ for
Reverse, +2, W on a four-colour tile, +4). Packs with real art are a follow-up, as briscola's
card-style packs were.

Not in the MVP (follow-ups, each a row): the Wild Draw Four challenge (four cards to the bluffer,
six to a wrong challenger); house rules (stacking, 7-0, jump-in). The shared shell with online
seats, sound and a saved game came with §9; the UNO call came with row uno-rules-extras:

**The UNO call** (the owner, 2026-10-02: "after you play a card and you have 1 left you should be
able to hit an 'UNO' button and if you DON'T hit it then the opponent can hit the 'call out UNO'
... button which will force you to draw cards"). The engine keeps the call as state (`Game.uno`:
the seat it concerns, whether it has called, whether a catch may still land). A play down to one
card opens the window for that seat; the seat may call UNO (`uno`) at two cards before its play,
or while its window is open after it; until another seat has played or drawn, any other seat may
call it out (`callOut`), and a seat caught without the call draws two (the standard penalty); a
call made in time, or the next seat's play or draw, shuts the window. The last card wins outright.
A wild played down to one card keeps the window open through its colour. On the wire the two
intents carry no seat (n-seat-sessions.md D1): `applyAction` seats them from the sender's channel
and lets them in off the turn. Every seat's view carries the window and its own two flags; the
table shows "UNO!" to a seat that may call and "Call out UNO" to every other seat while a window is
open without the call, online and pass the phone (where the call is made before the play, since
the curtain drops as soon as the turn moves). An older save without `uno` reads as no call in the
air.

## 8. Tests

`npm run test:uno`: the deck's composition and points, the matching rule, every action card from
hand-built positions, the opener's four special cases found by seed, drawing with and without a
playable card, the reshuffle, the UNO call (the window's open and close, the catch and its two
cards, the call in time, the refusals), the game's end and Play again, and a bot that plays whole games of
two, three, five and twelve seats to the first empty hand with the card count checked at every
step. The shell adapter, the wire and the reducer are pinned in `view.test.ts`, `protocol.test.ts`,
`shellConfig.test.ts` and `state.test.ts`; `e2e/uno.spec.ts` plays a seeded game through the page
and the shell specs (`@uno`) drive its home, curtain, handoff and online seats; `e2e/uno.spec.ts`
also seats a hand-made position and catches a seat without the call, then sees the call in time
leave nothing to catch.

## 9. On the shared shell: pass the phone or play online

Since uno-shell UNO is a shell game (tools/games.ts `SHELL_GAMES`, `REGISTRY.uno`, `SHELL.uno`),
no longer a solo page, at the same `/uno/`: page.ts composed by tools/shell-markup.ts, the shell's
home (Online or Pass the phone, the host and join cards, the Rules tab), the shell's curtain, and
N-seat online sessions (n-seat-sessions.md) for 2 to 12 players (the owner, 2026-10-02: "uno caps
out at 12"; 12 × 7 = 84 of 108 cards leaves a stock of 23). The player count is the shell's shared
stepper (web/shared/markup/stepper.ts, web/shared/ui/stepper.ts), not a select. The host is the
dealer: it holds the whole state (src/engine/view.ts `State`), applies every seat's action
(`applyAction`, which refuses a play out of turn) and sends each seat its own `View`: its own hand,
everyone's card count, never another hand. A Wild's colour is named by the player who played it.
The Rules tab is eight one-line rules (ui/rules.ts) and fits one phone screen at 390 × 844. The UNO
call is §7's; the Wild Draw Four challenge stays out (row uno-rules-extras, second priority).
