# Flip 7

A clone of Flip 7 (The Op Games, 2024) for the games site: the rules as published, an engine that
plays them, and a pass-and-play page on one phone as the MVP. The owner's ask (2026-10-02): "a
clone of flip7 … Look up the rules, use the shell, and don't worry about card art being accurate
for the base packs. Just make it as simple as possible."

## 1. Sources

- The Op's rulebook (as mirrored at bghub.org/r/flip7.pdf): the deck, the deal, Hit and Stay,
  busting, the Flip 7 bonus, the three action cards, the modifiers, scoring to 200.
- officialgamerules.org "How to Play Flip 7" and asmodee.co.uk "How to play Flip 7": the same
  rules in prose; the deck's number distribution; the reshuffle.
- happypiranha.com's rules page: the action card edge cases quoted ("If you're the only player
  left, you MUST play it on yourself"; a Flip Three that flips an action card or a bust "continue[s]
  until all 3 cards have been flipped, then resolve any actions"; after a Flip 7 "everyone who
  hasn't bust banks the points in front of them").

The card counts not spelled in those pages (three of each action card, one each of +2, +4, +6,
+8, +10 and x2) are the rulebook's and reconcile with its "94 cards": 79 numbers + 9 actions + 6
modifiers.

## 2. The deck

94 cards. Number cards 0-12: as many copies of each as its value (one 1, two 2s, … twelve 12s)
plus one 0, 79 in all. Action cards: three Freeze, three Flip Three, three Second Chance. Score
modifiers: +2, +4, +6, +8, +10 and x2, one each. `makeDeck` (web/games/flip7/src/engine/cards.ts)
spells it; ids are `n<value>-<copy>`, `<action>-<copy>`, `plus<n>` and `times2`.

## 3. A round

The dealer deals one card to each player, starting on their left, resolving any action card as it
lands. Then, in the same order, each active player either **hits** (takes one card) or **stays**
(banks what is in front of them and is out for the round). The round ends when every player is
out, or at once when a player holds seven different numbers. The deck is shared across rounds;
when it runs out the discards are shuffled into a new one.

## 4. The cards

- **A number** joins your line. A number you already have **busts** you: you are out and score
  nothing this round. A **Second Chance** in your line saves you once: it and the duplicate are
  discarded and you play on.
- **Seven different numbers** is a Flip 7: the round ends immediately, you add 15 to your score,
  and every other player who has not busted banks their line.
- **Freeze** and **Flip Three** are given by the player who draws them to any active player, the
  drawer included; the only active player must take it. Freeze banks the taker's line and ends
  their round. Flip Three deals the taker three cards one at a time; a bust or a Flip 7 stops it;
  an action card among the three is resolved after the three are flipped.
- **Second Chance** is kept by the drawer if they have none, otherwise given to an active player
  who has none; if nobody can take it, it is discarded.
- **+2 … +10** and **x2** join your line and count at scoring; they are lost with a bust.

## 5. Players

Two to eight seats on one phone here (the box says 3+; two works fine).

## 6. Scoring

A line not busted scores the sum of its numbers, doubled by x2 if held, plus the + modifiers, plus
15 for a Flip 7. A busted line scores nothing. After a round in which a player reaches 200 or more
the game ends; the highest score wins, and a shared top score plays another round.

## 7. The MVP: pass-and-play on one phone

A solo page (tools/games.ts `SOLO_PAGES`, like the reaction game) at `/flip7/`: no network, no
room code, no shell seats yet. Every card is face up, so there is no curtain: two screens
(web/games/flip7/src/ui/state.ts), the setup (two to eight seats, names) and the table (every
seat's line as tiles with its status and what it would bank, the current seat lit, Hit and Stay,
a "give it to…" picker when an action card has more than one possible taker, the scores with Next
round when the round ends). During the opening deal the one button reads "Deal to <name>".

The base pack is plain by design: a tile is its text on a colour per kind (blue numbers, yellow
modifiers, pink actions, green Second Chance). Packs with real art are a follow-up.

Not in the MVP (follow-ups, each a row): sound beyond the shell's; the card-flip animation (§8
leaves the hooks).

## 8. On the shared shell: pass the phone or online, two to twelve

The owner (2026-10-02): "Any multiplayer game must necessarily also have a multiplayer component via
the shell", "the ruleset to teach players should be as short as possible, ideally fitting on 1
screen", "flip7 caps out at 12", "In the multiplayer lobby you must have your hand closer and all
the other players hands kinda more in the background", "as people bust, grey out their deals, but
don't move on. When you the player bust, you need to confirm before proceeding."

- **The shell.** Flip 7 is a shell game (tools/games.ts `SHELL.flip7`, `REGISTRY.flip7`; the page
  composed from `page.ts`): the shell's home with Online and Pass the phone, the host and join
  cards, the shared players stepper (two to twelve), the Rules and About tabs; the shell's waiting
  rooms, curtain, resume and leave. The look is the shell's with Flip 7's accent alone.
- **Online.** Every card is face up, so nothing is hidden: the host deals and holds the game, every
  seat is sent its view (the whole table, the draw pile cut to its count), and each seat's Hit,
  Stay or give goes to the host as an action frame that `engine/index.ts` `applyAction` checks
  against the seat that sent it (the turn's seat hits or stays, the seat that flipped an action card
  gives it, the host deals the next round). The welcome and lobby frames carry the table's seats.
- **One phone.** The curtain rises once, for the first player; after it the table follows whoever
  must act.
- **The table.** This phone's seat in the foreground (its cards large, at the bottom), every other
  seat a smaller row in a background grid above (up to four across at phone width: eleven
  opponents are three rows, the cards shrinking with the count), each seat's name, status, total
  and this round's score always shown, the seat to play lit. Each card carries `data-card` so the
  flip row can find a dealt card in place. A busted seat greys out and keeps its line (the bust
  card included) until the next deal: the engine leaves every line on the table at the round's end
  and discards them when the next round is dealt.
- **The pause.** When a seat busts, is frozen or flips 7, the table shows what happened (the card
  and the points lost, the points banked, the bonus) and waits for Continue; nothing moves on that
  phone until then. Online the pause is the phone's own seat's; on one phone, any seat's. The
  round's end is the scores with Next round (the host's, or the phone's).
- **Rules.** The Rules tab is eight one-line items (the goal, the turn, the bust, Flip 7 and the
  four special kinds), one phone screen at 390x844; this document is the long form.

## 9. Tests

`npm run test:flip7`: the deck's composition and the scoring rule, the opening deal and a Freeze
inside it, hitting, busting and the Second Chance save, staying, the round's end by every route,
the Flip 7 bonus, each action card's taker rules including the only-active-seat case and an action
drawn inside a Flip Three, the reshuffle, the dealer rotation, the target and the shared-top rule,
and a careful bot that plays whole games of two, three and six seats to 200 with the card count
checked at every step. The shell adapter's turn authority and decoders are pinned in
`engine/index.test.ts`, the wire in `protocol.test.ts`, the reducer (the curtain once, the pause and
its Continue, the host's and the guest's moves) in `ui/state.test.ts`; `e2e/flip7-local.spec.ts`
plays a seeded game, a twelve-seat table and a bust with its Continue through the page, and the
shell specs' `@flip7` describes play the shell's flows.
