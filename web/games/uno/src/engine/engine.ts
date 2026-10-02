// The UNO engine (docs/design/uno.md §3-§6): a pure game of two to ten players on one table. The
// state holds every hand, both piles, the active colour, whose turn and which way, the phase the
// turn is in and the running scores; `deal` starts a round from a shuffled deck, `apply` plays one
// intent (play a card, choose a colour for a wild, draw, pass on a drawn card, deal the next
// round) and returns the next state with a one-line note of what happened for the paint. The
// randomness (the shuffles) comes in as an `Rng` so a test scripts a whole round and the e2e
// seeds one. Not here (§8, the MVP's edges): the UNO call and its penalty, the Wild Draw Four
// challenge, stacking; a card played is final (the paint confirms nothing).
import type { Rng } from '../../../../shared/lib/rng.ts';
import { shuffle } from '../../../../shared/lib/shuffle.ts';
import {
  findCard,
  isWild,
  makeDeck,
  playableOn,
  pointsOfHand,
  without,
  type Card,
  type Cards,
  type Color,
} from './cards.ts';

export const MIN_PLAYERS = 2;
/** The owner, 2026-10-02: "uno caps out at 12"; 12 × 7 = 84 of the 108 cards leaves a stock of 23. */
export const MAX_PLAYERS = 12;
export const HAND_SIZE = 7;
/** §6: the first player to reach this many points wins the game. */
export const DEFAULT_TARGET = 500;

export type Direction = 1 | -1;

export type Phase =
  /** The current player plays a card or draws. */
  | Readonly<{ kind: 'turn' }>
  /** The current player drew a playable card: play that card, or keep it and pass. */
  | Readonly<{ kind: 'drawn'; card: Card }>
  /** A wild is on the discard pile (or opened the round): the current player names the colour. */
  | Readonly<{ kind: 'color'; card: Card }>
  /** One hand is empty; the round's points are added. */
  | Readonly<{ kind: 'roundOver'; winner: number; gained: number }>
  /** A score reached the target. */
  | Readonly<{ kind: 'gameOver'; winner: number }>;

export type Game = Readonly<{
  names: ReadonlyArray<string>;
  hands: ReadonlyArray<Cards>;
  /** The draw pile, top last. */
  draw: Cards;
  /** The discard pile, top last; never empty after `deal`. */
  discard: Cards;
  /** The colour in play: the top card's, or the one named for a wild. */
  color: Color;
  /** The seat whose turn it is (an index into `names`). */
  turn: number;
  direction: Direction;
  phase: Phase;
  scores: ReadonlyArray<number>;
  target: number;
  /** 1 for the first round. */
  round: number;
  /** What just happened, for the status line. */
  note: string;
}>;

export type Intent =
  | Readonly<{ type: 'play'; id: string }>
  | Readonly<{ type: 'color'; color: Color }>
  | Readonly<{ type: 'draw' }>
  | Readonly<{ type: 'pass' }>
  | Readonly<{ type: 'nextRound' }>;

/** A card that is never dealt: the fallback where a pile the engine keeps non-empty is read. */
export const NO_CARD: Card = { id: '', kind: 'number', color: 'red', value: 0 };

export const topOf = (game: Game): Card => game.discard[game.discard.length - 1] ?? NO_CARD;

export const nameOf = (game: Game, seat: number): string => game.names[seat] ?? '';

export const handOf = (game: Game, seat: number): Cards => game.hands[seat] ?? [];

export const currentHand = (game: Game): Cards => handOf(game, game.turn);

/** The seat `steps` seats on from `seat` in the direction of play. */
export const seatAfter = (game: Game, seat: number, steps = 1): number => {
  const n = game.names.length;
  return (((seat + steps * game.direction) % n) + n) % n;
};

export const nextSeat = (game: Game): number => seatAfter(game, game.turn);

/** §3: the cards of the current hand that may be played now (the drawn card alone in `drawn`). */
export const playableIds = (game: Game): ReadonlyArray<string> => {
  if (game.phase.kind === 'drawn') return [game.phase.card.id];
  if (game.phase.kind !== 'turn') return [];
  const top = topOf(game);
  return currentHand(game)
    .filter((card) => playableOn(card, top, game.color))
    .map((card) => card.id);
};

const colorName = (color: Color): string => color;

const kindName = (card: Card): string => {
  switch (card.kind) {
    case 'number':
      return `${colorName(card.color ?? 'red')} ${String(card.value ?? 0)}`;
    case 'skip':
      return `${colorName(card.color ?? 'red')} Skip`;
    case 'reverse':
      return `${colorName(card.color ?? 'red')} Reverse`;
    case 'draw2':
      return `${colorName(card.color ?? 'red')} Draw Two`;
    case 'wild':
      return 'Wild';
    case 'wild4':
      return 'Wild Draw Four';
    default: {
      const never: never = card.kind;
      return never;
    }
  }
};

export const cardName = kindName;

/** Deal `count` cards off the draw pile to `seat`, reshuffling the discards under the top card when the pile runs dry (§3). */
const give = (game: Game, seat: number, count: number, rng: Rng): Game => {
  if (count <= 0) return game;
  const refilled: Game =
    game.draw.length === 0 && game.discard.length > 1
      ? {
          ...game,
          draw: shuffle(game.discard.slice(0, -1), rng),
          discard: game.discard.slice(-1),
        }
      : game;
  const card = refilled.draw[refilled.draw.length - 1];
  if (card === undefined) return refilled;
  const next: Game = {
    ...refilled,
    draw: refilled.draw.slice(0, -1),
    hands: refilled.hands.map((hand, i) => (i === seat ? [...hand, card] : hand)),
  };
  return give(next, seat, count - 1, rng);
};

const withTurn = (game: Game, turn: number, note: string): Game => ({
  ...game,
  turn,
  phase: { kind: 'turn' },
  note,
});

/**
 * §4: what the card just put on the pile does. A number passes the turn; Skip passes it over the
 * next seat; Reverse turns the direction (and skips at two players); Draw Two hands the next seat
 * two cards and skips it; a wild waits for its colour (`color` phase) and Wild Draw Four's four
 * cards land when the colour is named. `by` is the seat that played it.
 */
const resolve = (game: Game, card: Card, by: string, rng: Rng): Game => {
  const next = nextSeat(game);
  switch (card.kind) {
    case 'number':
      return withTurn(game, next, `${by} played ${kindName(card)}.`);
    case 'skip':
      return withTurn(
        game,
        seatAfter(game, game.turn, 2),
        `${by} played ${kindName(card)}: ${nameOf(game, next)} is skipped.`,
      );
    case 'reverse': {
      if (game.names.length === 2) {
        return withTurn(game, game.turn, `${by} played ${kindName(card)}: ${by} goes again.`);
      }
      const reversed: Game = { ...game, direction: game.direction === 1 ? -1 : 1 };
      return withTurn(
        reversed,
        nextSeat(reversed),
        `${by} played ${kindName(card)}: play turns around.`,
      );
    }
    case 'draw2': {
      const dealt = give(game, next, 2, rng);
      return withTurn(
        dealt,
        seatAfter(dealt, dealt.turn, 2),
        `${by} played ${kindName(card)}: ${nameOf(game, next)} draws two and is skipped.`,
      );
    }
    case 'wild':
    case 'wild4':
      return {
        ...game,
        phase: { kind: 'color', card },
        note: `${by} played ${kindName(card)}: name a colour.`,
      };
    default: {
      const never: never = card.kind;
      return never;
    }
  }
};

/** §5: the round ends when a hand is empty; the winner takes everyone else's points. */
const settleRound = (game: Game, winner: number): Game => {
  const gained = game.hands.reduce(
    (sum, hand, i) => (i === winner ? sum : sum + pointsOfHand(hand)),
    0,
  );
  const scores = game.scores.map((score, i) => (i === winner ? score + gained : score));
  const name = nameOf(game, winner);
  const won = (scores[winner] ?? 0) >= game.target;
  return {
    ...game,
    scores,
    phase: won ? { kind: 'gameOver', winner } : { kind: 'roundOver', winner, gained },
    note: won
      ? `${name} wins the game with ${String(scores[winner] ?? 0)} points.`
      : `${name} goes out and takes ${String(gained)} points.`,
  };
};

/**
 * §3: a fresh round. Seven cards each from a shuffled deck; the first card of the rest opens the
 * discard pile, unless it is a Wild Draw Four, which goes back for another (the first other card
 * opens, the pile keeps its order). The opener's action applies to the first player: a Skip skips
 * them, a Reverse makes the dealer (the last seat) first, a Draw Two deals them two and skips
 * them, a Wild asks them for the colour.
 */
const open = (base: Game, rng: Rng): Game => {
  const n = base.names.length;
  const deck = shuffle(makeDeck(), rng);
  const hands = Array.from({ length: n }, (_, seat) =>
    deck.slice(seat * HAND_SIZE, (seat + 1) * HAND_SIZE),
  );
  const rest = deck.slice(n * HAND_SIZE);
  const starter = rest.find((card) => card.kind !== 'wild4') ?? NO_CARD;
  const draw = rest
    .filter((card) => card.id !== starter.id)
    .slice()
    .reverse();
  const first = 0;
  const dealer = n - 1;
  const game: Game = {
    ...base,
    hands,
    draw,
    discard: [starter],
    color: starter.color ?? 'red',
    turn: first,
    direction: 1,
    phase: { kind: 'turn' },
    note: `Round ${String(base.round)}: ${nameOf(base, first)} starts.`,
  };
  switch (starter.kind) {
    case 'number':
      return game;
    case 'skip':
      return withTurn(game, 1 % n, `The first card is a Skip: ${nameOf(game, first)} is skipped.`);
    case 'reverse': {
      if (n === 2)
        return withTurn(game, 1, `The first card is a Reverse: ${nameOf(game, 1)} starts.`);
      const reversed: Game = { ...game, direction: -1 };
      return withTurn(
        reversed,
        dealer,
        `The first card is a Reverse: ${nameOf(game, dealer)} starts and play runs the other way.`,
      );
    }
    case 'draw2': {
      const dealt = give(game, first, 2, rng);
      return withTurn(
        dealt,
        1 % n,
        `The first card is a Draw Two: ${nameOf(game, first)} draws two and is skipped.`,
      );
    }
    case 'wild':
    case 'wild4':
      return {
        ...game,
        phase: { kind: 'color', card: starter },
        note: `The first card is a Wild: ${nameOf(game, first)} names the colour.`,
      };
    default: {
      const never: never = starter.kind;
      return never;
    }
  }
};

/** A new game of `names` (MIN_PLAYERS to MAX_PLAYERS seats; the page's setup keeps the bounds), round 1 dealt. */
export const deal = (names: ReadonlyArray<string>, rng: Rng, target = DEFAULT_TARGET): Game =>
  open(
    {
      names,
      hands: [],
      draw: [],
      discard: [],
      color: 'red',
      turn: 0,
      direction: 1,
      phase: { kind: 'turn' },
      scores: names.map(() => 0),
      target,
      round: 1,
      note: '',
    },
    rng,
  );

const refuse = (game: Game, note: string): Game => ({ ...game, note });

const play = (game: Game, id: string, rng: Rng): Game => {
  if (game.phase.kind !== 'turn' && game.phase.kind !== 'drawn') return refuse(game, 'Not now.');
  const hand = currentHand(game);
  const card = findCard(hand, id);
  if (card === undefined) return refuse(game, 'That card is not in your hand.');
  if (game.phase.kind === 'drawn' && game.phase.card.id !== id) {
    return refuse(game, 'Play the card you drew, or pass.');
  }
  if (!playableOn(card, topOf(game), game.color))
    return refuse(game, `${kindName(card)} does not match.`);
  const by = nameOf(game, game.turn);
  const played: Game = {
    ...game,
    hands: game.hands.map((h, i) => (i === game.turn ? without(h, id) : h)),
    discard: [...game.discard, card],
    color: isWild(card) ? game.color : (card.color ?? game.color),
  };
  if ((played.hands[game.turn] ?? []).length === 0) return settleRound(played, game.turn);
  return resolve(played, card, by, rng);
};

const chooseColor = (game: Game, color: Color, rng: Rng): Game => {
  if (game.phase.kind !== 'color') return refuse(game, 'No colour to name.');
  const by = nameOf(game, game.turn);
  const coloured: Game = { ...game, color };
  const next = nextSeat(coloured);
  if (game.phase.card.kind === 'wild4') {
    const dealt = give(coloured, next, 4, rng);
    return withTurn(
      dealt,
      seatAfter(dealt, dealt.turn, 2),
      `${by} named ${color}: ${nameOf(game, next)} draws four and is skipped.`,
    );
  }
  // A Wild that opened the round was nobody's play: the namer keeps the turn.
  const opened = game.discard.length === 1 && currentHand(game).length === HAND_SIZE;
  return opened
    ? withTurn(coloured, game.turn, `${by} named ${color}.`)
    : withTurn(coloured, next, `${by} named ${color}.`);
};

const drawOne = (game: Game, rng: Rng): Game => {
  if (game.phase.kind !== 'turn') return refuse(game, 'Not now.');
  const by = nameOf(game, game.turn);
  const before = currentHand(game).length;
  const dealt = give(game, game.turn, 1, rng);
  const hand = currentHand(dealt);
  const card = hand[hand.length - 1];
  if (hand.length === before || card === undefined) {
    return withTurn(dealt, nextSeat(dealt), `No cards left to draw: ${by} passes.`);
  }
  return playableOn(card, topOf(dealt), dealt.color)
    ? { ...dealt, phase: { kind: 'drawn', card }, note: `${by} drew a card that plays.` }
    : withTurn(dealt, nextSeat(dealt), `${by} drew and passes.`);
};

const pass = (game: Game): Game => {
  if (game.phase.kind !== 'drawn') return refuse(game, 'Draw first.');
  const by = nameOf(game, game.turn);
  return withTurn(game, nextSeat(game), `${by} keeps the card and passes.`);
};

const nextRound = (game: Game, rng: Rng): Game => {
  if (game.phase.kind !== 'roundOver') return refuse(game, 'The round is not over.');
  return open({ ...game, round: game.round + 1, hands: [], draw: [], discard: [] }, rng);
};

/** One intent against the game; an intent that does not apply leaves the state and sets the note. */
export const apply = (game: Game, intent: Intent, rng: Rng): Game => {
  switch (intent.type) {
    case 'play':
      return play(game, intent.id, rng);
    case 'color':
      return chooseColor(game, intent.color, rng);
    case 'draw':
      return drawOne(game, rng);
    case 'pass':
      return pass(game);
    case 'nextRound':
      return nextRound(game, rng);
    default: {
      const never: never = intent;
      return never;
    }
  }
};

/** Every card in play: the hands, both piles; 108 whenever the engine is consistent. */
export const cardCount = (game: Game): number =>
  game.hands.reduce((sum, hand) => sum + hand.length, 0) + game.draw.length + game.discard.length;
