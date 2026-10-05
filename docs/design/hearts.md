# Hearts

Hearts for three or four on the games site: the published rules, a pure engine that plays them,
and the shared shell's page (pass the phone or online seats). The owner's ask (2026-10-05): "read
the AGENT.md here … and then create a working doc to make Hearts … create and publish hearts".
Scaffolded by `npm run new-game -- --name hearts --title Hearts --seats 3-4 --hidden-hands yes`
(docs/design/new-game.md); the engine landed in row hearts-engine, the table and its pauses are
row hearts-table, the one-screen Rules items, the cues and the splash are row hearts-polish.

## 1. Sources

- pagat.com, "Hearts" (https://www.pagat.com/reverse/hearts.html): the standard American game
  the engine plays; the 2♦ out at three players; the pass rotation; the first-trick and
  broken-hearts rules; shooting the moon; the game to 100.
- Bicycle, "How to play Hearts" (https://bicyclecards.com/how-to-play/hearts): the same rules
  in the publisher's words; the deal, the pass, the 2♣ lead, the scoring.
- Wikipedia, "Hearts (card game)": the variants the engine does not play (the Jack of
  Diamonds, no-pass games, 50- and 75-point targets), listed in §8 so a follow-up can name one.

The three agree on every rule below. Where pagat lists a choice (whether the Q♠ breaks hearts;
whether the moon may be taken as −26 by the shooter) the engine plays the plainer reading: only
a heart breaks hearts; the moon gives 26 to every other seat.

## 2. The deck and the deal

The 52-card French deck (`web/shared/lib/cards/decks.ts` `french52`, gin's ids: `2C`, `10H`,
`QS`, `AH`). The ace is high. At four seats every card is dealt, 13 each; at three the 2♦ is
removed and 51 are dealt, 17 each (`engine/cards.ts` `deckFor`). The shuffle is the shared
Fisher-Yates over the injected `Rng`, so a seeded game replays byte for byte. A hand is held
clubs, diamonds, spades, hearts, low to high (`sortHand`).

## 3. The pass

Before the hand each seat chooses three cards and passes them, every seat at once; the cards
move once the last seat has chosen. The direction rotates by hand number: at four seats left
(to the next seat), right (to the seat before), across (two on), then a hold hand with no pass;
at three seats left, right, hold (`directionFor`). The pass is the one moment every seat acts
in the same phase: the engine's `pass` intent carries its seat, and the wire's `pass` action is
seated by the host from the channel it came on (`view.ts` `intentOf`). Any three distinct cards
of the hand are legal (`isLegalPass`); `legalIntents` lists one, the three highest, which is the
bot's plain pass.

## 4. The play

The holder of the 2♣ leads it. Play goes clockwise; each seat follows suit when it can, else
plays any card. The highest card of the suit led takes the trick and leads the next.

Two restrictions (`legalPlays`):

- No points on the first trick: a seat that cannot follow clubs may not play a heart or the Q♠,
  unless its hand holds nothing else.
- Hearts are not led until broken: a heart may not lead until a heart has been played to a
  trick, unless the leader's hand is all hearts. The Q♠ may be led at any time and does not
  break hearts.

A refusal names the rule in the player's words: "The 2♣ leads the first trick.", "Follow
suit.", "No points on the first trick.", "Hearts have not been broken.".

## 5. Scoring a hand

Each heart taken is 1 point and the Q♠ 13: 26 in a hand. A seat that takes all 26 shot the
moon: it scores 0 and every other seat scores 26. The hand's points are added to the totals
(`Game.handScores`, `Game.scores`); `Game.moon` names the shooter.

## 6. The game

A game is hands until one leaves a seat at 100 or more; the lowest total then wins, and a tie
is shared (`winnersOf`). Between hands any seat deals on (`nextHand`); after the game any seat
starts over (`playAgain`), the same seats with every score 0.

## 7. The engine and the page

`web/games/hearts/src/engine/`:

- `cards.ts`: the deck, `rankOf`, `suitOf`, `pointsOf`, `deckFor`, `sortHand`, `highest`.
- `engine.ts`: `Game` (`phase` passing | playing | handOver | gameOver, `round`, `direction`,
  `hands`, `passes`, `trick`, `lastTrick`, `taken`, `heartsBroken`, `turn`, `scores`,
  `handScores`, `moon`, `note`), `Intent` (`pass` seat + three ids, `play` one id, `nextHand`,
  `playAgain`), `apply(game, intent, rng)` as a `Result`, `legalIntents(game, seat)`,
  `legalPlays`, `isLegalPass`, `actorOf`, `deal`, `newGame`, `takerOf`, `winnersOf`,
  `SEAT_COUNTS`, `MIN_SEATS`, `MAX_SEATS`, `GAME_END`.
- `view.ts`: `State` (the game and its clock), `Action` (the intents with the pass unseated),
  `View`, `createState(names, rng, now)`, `applyAction(state, seat, action, rng, now)`,
  `viewFor(state, seat)`, `turnSeat`, `legalActions`, `intentOf`, `actionOf`, the decoders
  (`decodeAction`, `decodeView`, `decodeState`).

A seat's `View` is its own hand and everyone's public state, never another hand (AGENT.md
"Hidden hands"): `hand`, `counts`, `passed`, `myPass`, `trick`, `lastTrick` (who took it and
its points), `heartsBroken`, `turn` (null between hands), `scores`, `handScores`, `moon`,
`winners`, `legal`, `note`, `round`, `direction`, `phase`, `startedAt`.

The consequential events, for the table row's pauses (AGENT.md "Understand what happened before
proceeding"), each readable off the view that raises it:

| Event                     | What the pause shows                                              | Where it is in the view            |
| ------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| A trick that carried points | the four (or three) cards, who took them and how many points     | `lastTrick` with `points > 0`      |
| A hand's end              | every seat's points this hand and total; the moon when shot       | `phase === 'handOver'`, `handScores`, `moon` |
| The game's end            | the totals, the winner or the shared win                           | `phase === 'gameOver'`, `winners`  |

On the shared shell: `shellConfig.ts` seats 3-4 (`seats {min: 3, max: 4, fixed: true}`, the
shell's `seatCountOpts`), `protocol.ts` the seated protocol, `storage.ts` the seated store under
`hearts_`, `net/sessions.ts` the seated sessions, `ui/state.ts` the reducer (the curtain rises
for every change of actor; the game's end is its pause; the trick and hand pauses are the table
row's). The page is the scaffold's placeholder until the table row lands; the stepper and the
seat names for the range are the declared `stepper` and `seat-names` gaps (Flip 7's shape,
docs/design/flip7.md §8).

## 8. Not played (follow-ups, each a row if wanted)

The Jack of Diamonds (−10); the shooter's choice of −26; a target other than 100; the Q♠
breaking hearts; no-pass games; the Black Maria variants.

## 9. The Rules tab (one screen)

The items for `src/ui/rules.ts` (`RULES_ITEMS`), the goal first, then the turn, then one line per
special case, fitting 390x844 with no scroll (the polish row writes them):

- Goal: take the fewest points. Each heart is 1, the queen of spades 13. Lowest score wins when
  someone reaches 100.
- Pass: before each hand pass three cards: left, right, across, then hold (left, right, hold with three).
- The 2♣ leads. Follow suit if you can; the highest card of the suit led takes the trick.
- No hearts or the queen on the first trick (unless you hold nothing else).
- No leading a heart until one has been played (unless you hold only hearts).
- Take all 26 and you shoot the moon: the others score 26, you score 0.

## 10. Tests and the suite

`npm run test:hearts`: the cards (52 and 51, the points add to 26); the deal (13 or 17, sorted);
the rotation; a hold hand; the pass (three of the hand, once, the cards land, the 2♣ leads); the
2♣ opener; no points on the first trick, and the dump when nothing else is held; follow suit;
hearts not led until broken, and the all-hearts lead; the taker; a trick with points; the hand's
scoring; the moon; the 100-point end and the shared win; Next hand and Play again; and bot games
at three and four seats, two seeds each, with every card accounted for at every step and the
same game for the same seed. `view.test.ts` pins the hidden hands, the seated pass, the refused
play out of turn, the decoders; `shellConfig.test.ts` and `state.test.ts` the adapters and the
reducer (a full pass-and-play game of three to its end's pause). The conformance suite is
`npm run test:harness`; `e2e/hearts.spec.ts` is the scaffold's until the table row.
