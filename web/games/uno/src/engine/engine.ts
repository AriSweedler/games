// The UNO engine (docs/design/uno.md §3-§6): a pure game of two to twelve players on one table,
// one round long (the owner, 2026-10-02: "UNO should only be single round games ... more like
// briscola"): the first player to empty a hand wins the game. The state holds every hand, both
// piles, the active colour, whose turn and which way, and the phase the turn is in; `deal` starts a
// game from a shuffled deck, `apply` plays one intent (play a card, choose a colour for a wild,
// draw, pass on a drawn card, deal again once the game is won) and returns the next state with a
// one-line note of what happened for the paint. The
// randomness (the shuffles) comes in as an `Rng` so a test scripts a whole game and the e2e
// seeds one. §7's UNO call is here too: a seat at two cards may call UNO before it plays, or
// right after its play leaves it one card; until another seat has played or drawn, any other
// seat may call it out (`callOut`), and a seat caught without the call draws two. Not here (§7's
// follow-ups): the Wild Draw Four challenge, stacking; a card played is final (the paint
// confirms nothing).
import type { Rng } from '../../../../shared/lib/rng.ts';
import { shuffle } from '../../../../shared/lib/shuffle.ts';
import {
  findCard,
  isWild,
  makeDeck,
  playableOn,
  without,
  type Card,
  type Cards,
  type Color,
} from './cards.ts';

export const MIN_PLAYERS = 2;
/** The owner, 2026-10-02: "uno caps out at 12"; 12 × 7 = 84 of the 108 cards leaves a stock of 23. */
export const MAX_PLAYERS = 12;
export const HAND_SIZE = 7;

export type Direction = 1 | -1;

export type Phase =
  /** The current player plays a card or draws. */
  | Readonly<{ kind: 'turn' }>
  /** The current player drew a playable card: play that card, or keep it and pass. */
  | Readonly<{ kind: 'drawn'; card: Card }>
  /** A wild is on the discard pile (or opened the game): the current player names the colour. */
  | Readonly<{ kind: 'color'; card: Card }>
  /** One hand is empty: its player has won the game. */
  | Readonly<{ kind: 'gameOver'; winner: number }>;

/**
 * §7: the UNO call. `seat` is the seat it concerns; `called` once it has said UNO (before its
 * play, at two cards, or after it); `open` from the play that left it one card until another seat
 * has played or drawn: while open and not called, any other seat may call it out for two cards.
 */
export type UnoCall = Readonly<{ seat: number; called: boolean; open: boolean }>;

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
  /** The UNO call in the air (§7), or null. */
  uno: UnoCall | null;
  /** What just happened, for the status line. */
  note: string;
}>;

export type Intent =
  | Readonly<{ type: 'play'; id: string }>
  | Readonly<{ type: 'color'; color: Color }>
  | Readonly<{ type: 'draw' }>
  | Readonly<{ type: 'pass' }>
  /** Play again: a fresh deal for the same seats, once the game is won. */
  | Readonly<{ type: 'again' }>
  /** §7: `seat` calls UNO, at two cards on its turn or while its window is open. */
  | Readonly<{ type: 'uno'; seat: number }>
  /** §7: `seat` calls out the seat whose window is open without the call; that seat draws two. */
  | Readonly<{ type: 'callOut'; seat: number }>;

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

/** §5: the game ends when a hand is empty; its player wins (no points: one round is the game). */
const win = (game: Game, winner: number): Game => ({
  ...game,
  phase: { kind: 'gameOver', winner },
  uno: null,
  note: `${nameOf(game, winner)} wins!`,
});

/** The UNO window shut (another seat acted, or the penalty landed); the same game when none was open. */
const closed = (game: Game): Game => (game.uno === null ? game : { ...game, uno: null });

/** §7: `seat` has called UNO for its current or coming one-card hand. */
const armed = (game: Game, seat: number): boolean =>
  game.uno !== null && game.uno.seat === seat && game.uno.called;

/** §7: may `seat` call UNO now: at two cards on its turn, or while its own window is open; not twice. */
export const mayCallUno = (game: Game, seat: number): boolean => {
  if (armed(game, seat)) return false;
  if (game.uno !== null && game.uno.open && game.uno.seat === seat) return true;
  const acting = game.phase.kind === 'turn' || game.phase.kind === 'drawn';
  return seat === game.turn && acting && handOf(game, seat).length === 2;
};

/** §7: may `seat` call out the seat at one card: a window open, the call not made, and not its own. */
export const mayCallOut = (game: Game, seat: number): boolean =>
  game.uno !== null && game.uno.open && !game.uno.called && game.uno.seat !== seat;

/**
 * §3: a fresh game. Seven cards each from a shuffled deck; the first card of the rest opens the
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
    note: `${nameOf(base, first)} starts.`,
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

/** A new game of `names` (MIN_PLAYERS to MAX_PLAYERS seats; the page's setup keeps the bounds), dealt. */
export const deal = (names: ReadonlyArray<string>, rng: Rng): Game =>
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
      uno: null,
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
  const left = hand.length - 1;
  // §7: a play down to one card opens the window (the call made before it counts); any other
  // play, this seat's or another's, closes whatever was open.
  const uno: UnoCall | null =
    left === 1 ? { seat: game.turn, called: armed(game, game.turn), open: true } : null;
  const played: Game = {
    ...game,
    hands: game.hands.map((h, i) => (i === game.turn ? without(h, id) : h)),
    discard: [...game.discard, card],
    color: isWild(card) ? game.color : (card.color ?? game.color),
    uno,
  };
  if (left === 0) return win(played, game.turn);
  const resolved = resolve(played, card, by, rng);
  if (uno === null) return resolved;
  const tail = uno.called ? `${by} calls UNO!` : `${by} is down to one card.`;
  return { ...resolved, note: `${resolved.note} ${tail}` };
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
  // A Wild that opened the game was nobody's play: the namer keeps the turn.
  const opened = game.discard.length === 1 && currentHand(game).length === HAND_SIZE;
  return opened
    ? withTurn(coloured, game.turn, `${by} named ${color}.`)
    : withTurn(coloured, next, `${by} named ${color}.`);
};

const drawOne = (game: Game, rng: Rng): Game => {
  if (game.phase.kind !== 'turn') return refuse(game, 'Not now.');
  const by = nameOf(game, game.turn);
  const before = currentHand(game).length;
  const dealt = give(closed(game), game.turn, 1, rng);
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
  return withTurn(closed(game), nextSeat(game), `${by} keeps the card and passes.`);
};

/** §7: `seat` calls UNO: armed for its coming play at two cards, or its open window answered. */
const callUno = (game: Game, seat: number): Game => {
  if (!mayCallUno(game, seat)) {
    return refuse(game, armed(game, seat) ? 'You already called UNO.' : 'Not at one card yet.');
  }
  const open = game.uno?.seat === seat && game.uno.open;
  return { ...game, uno: { seat, called: true, open }, note: `${nameOf(game, seat)} calls UNO!` };
};

/** §7: `seat` catches the seat at one card without the call: two cards to it, the window shut. */
const callOut = (game: Game, seat: number, rng: Rng): Game => {
  const call = game.uno;
  if (!call?.open) return refuse(game, 'Nobody is down to one card.');
  if (call.seat === seat) return refuse(game, 'You cannot call yourself out.');
  if (call.called) return refuse(game, `${nameOf(game, call.seat)} called UNO in time.`);
  const caught = nameOf(game, call.seat);
  const dealt = give(game, call.seat, 2, rng);
  return {
    ...dealt,
    uno: null,
    note: `${nameOf(game, seat)} caught ${caught} without UNO: ${caught} draws two.`,
  };
};

const again = (game: Game, rng: Rng): Game => {
  if (game.phase.kind !== 'gameOver') return refuse(game, 'The game is not over.');
  return deal(game.names, rng);
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
    case 'again':
      return again(game, rng);
    case 'uno':
      return callUno(game, intent.seat);
    case 'callOut':
      return callOut(game, intent.seat, rng);
    default: {
      const never: never = intent;
      return never;
    }
  }
};

/** Every card in play: the hands, both piles; 108 whenever the engine is consistent. */
export const cardCount = (game: Game): number =>
  game.hands.reduce((sum, hand) => sum + hand.length, 0) + game.draw.length + game.discard.length;
