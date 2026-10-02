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

The round ends the moment a hand is empty. The winner scores every card left in the other hands.

## 6. Scoring

Number cards their face value; Skip, Reverse and Draw Two 20 each; Wild and Wild Draw Four 50
each. The first player to 500 points wins the game (`DEFAULT_TARGET`). A whole deck is worth
1,240 points: 360 in numbers, 480 in actions, 400 in wilds.

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

Not in the MVP (follow-ups, each a row): the UNO call and its two-card penalty when caught; the
Wild Draw Four challenge (four cards to the bluffer, six to a wrong challenger); house rules
(stacking, 7-0, jump-in); the shared shell with online seats; sound; persistence of a game in
progress across a reload.

## 8. Tests

`npm run test:uno`: the deck's composition and points, the matching rule, every action card from
hand-built positions, the opener's four special cases found by seed, drawing with and without a
playable card, the reshuffle, the round and game ends, and a bot that plays whole games of two,
three and five seats to 200 points with the card count checked at every step. The page reducer's
screens are pinned in `state.test.ts`; `e2e/uno.spec.ts` plays a seeded game through the page.
