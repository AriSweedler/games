// Hearts's rules engine (docs/design/hearts.md §2-§6): a pure game of three or four seats. A hand
// is dealt (13 each, or 17 at three seats without the 2♦), three cards are passed (left, right,
// across, hold in rotation at four; left, right, hold at three), the 2♣ leads, every seat follows
// suit when it can, the highest card of the suit led takes the trick and leads the next; no point
// may be dumped on the first trick (unless the hand holds nothing else) and no heart may be led
// until a heart has been played (unless the hand is all hearts). Each heart taken is 1 and the
// Q♠ 13; a seat that takes all 26 shot the moon and gives 26 to every other seat instead. The
// game ends when a hand leaves a seat at 100 or more; the lowest score wins, a tie shared.
// Pure: the shuffle's randomness comes in as an `Rng`, no clock, no DOM; `apply` returns a
// `Result` whose error is the refusal in a player's words. The completed trick, the hand's scores
// and the moon stay in the state (`lastTrick`, `handScores`, `moon`) so the table can pause on
// them (AGENT.md "Understand what happened before proceeding").
import type { Rng } from '../../../../shared/lib/rng.ts';
import { err, ok, type Result } from '../../../../shared/lib/result.ts';
import { shuffle } from '../../../../shared/lib/shuffle.ts';
import {
  TOTAL_POINTS,
  TWO_OF_CLUBS,
  deckFor,
  highest,
  isHeart,
  pointsIn,
  pointsOf,
  rankOf,
  sortHand,
  suitOf,
  type Cards,
} from './cards.ts';

export const SEAT_COUNTS = [3, 4] as const;
export type SeatCount = (typeof SEAT_COUNTS)[number];
export const MIN_SEATS: SeatCount = 3;
export const MAX_SEATS: SeatCount = 4;
/** The cards each seat passes before a hand (§3). */
export const PASS_COUNT = 3;
/** A hand that leaves a seat here or past ends the game (§6). */
export const GAME_END = 100;

export type PassDirection = 'left' | 'right' | 'across' | 'hold';
export type Phase = 'passing' | 'playing' | 'handOver' | 'gameOver';
export type Names = ReadonlyArray<string>;

export type Play = Readonly<{ seat: number; card: string }>;
/** The trick on the table: who led, and the cards so far in play order. */
export type Trick = Readonly<{ leader: number; plays: ReadonlyArray<Play> }>;
/** A trick taken: its cards, who took it and the points it carried (0 for most). */
export type TrickResult = Readonly<{
  leader: number;
  plays: ReadonlyArray<Play>;
  taker: number;
  points: number;
}>;

export type Game = Readonly<{
  names: Names;
  phase: Phase;
  /** The hand number, from 1; it picks the pass direction. */
  round: number;
  direction: PassDirection;
  /** Each seat's cards, in `sortHand` order. */
  hands: ReadonlyArray<Cards>;
  /** During the pass: each seat's three once it has chosen them, null until then. */
  passes: ReadonlyArray<Cards | null>;
  trick: Trick;
  /** The trick just taken (the pause's), null before the first of a hand. */
  lastTrick: TrickResult | null;
  /** The cards each seat has taken this hand. */
  taken: ReadonlyArray<Cards>;
  heartsBroken: boolean;
  /** The seat to play while `playing`. */
  turn: number;
  /** Every seat's total through the last finished hand. */
  scores: ReadonlyArray<number>;
  /** The hand just finished, the moon applied (`handOver`, `gameOver`); null while a hand is on. */
  handScores: ReadonlyArray<number> | null;
  /** The seat that shot the moon in the hand just finished, or null. */
  moon: number | null;
  /** What just happened, for the status line. */
  note: string;
}>;

export type Intent =
  /** `seat` passes these three before the hand (every seat passes; the order is free). */
  | Readonly<{ type: 'pass'; seat: number; ids: Cards }>
  /** The seat to play plays one card. */
  | Readonly<{ type: 'play'; id: string }>
  /** Deal the next hand once this one is scored. */
  | Readonly<{ type: 'nextHand' }>
  /** A fresh game for the same seats once the game is over. */
  | Readonly<{ type: 'playAgain' }>;

export const NOT_YOUR_TURN_MSG = 'Not your turn.';
export const GAME_OVER_MSG = 'The game is over.';

export const nameOf = (game: Game, seat: number): string => game.names[seat] ?? '';
export const handOf = (game: Game, seat: number): Cards => game.hands[seat] ?? [];
export const seatCount = (game: Game): number => game.names.length;

const seatAt = (game: Game, seat: number): number => {
  const n = seatCount(game);
  return ((seat % n) + n) % n;
};

export const nextSeat = (game: Game, seat: number): number => seatAt(game, seat + 1);

/** §3: the rotation; at four seats left, right, across, hold; at three left, right, hold. */
export const directionFor = (seats: number, round: number): PassDirection => {
  const cycle: ReadonlyArray<PassDirection> =
    seats === 3 ? ['left', 'right', 'hold'] : ['left', 'right', 'across', 'hold'];
  return cycle[(round - 1) % cycle.length] ?? 'hold';
};

/** The seat whose pass `seat` receives: left means the seat before it passes to it. */
export const passSourceOf = (game: Game, seat: number): number => {
  switch (game.direction) {
    case 'left':
      return seatAt(game, seat - 1);
    case 'right':
      return seatAt(game, seat + 1);
    case 'across':
      return seatAt(game, seat + 2);
    case 'hold':
      return seat;
  }
};

/** The seat `seat` passes to. */
export const passTargetOf = (game: Game, seat: number): number => {
  switch (game.direction) {
    case 'left':
      return seatAt(game, seat + 1);
    case 'right':
      return seatAt(game, seat - 1);
    case 'across':
      return seatAt(game, seat + 2);
    case 'hold':
      return seat;
  }
};

/** No trick taken yet this hand: the 2♣ leads and no point may fall. */
export const isFirstTrick = (game: Game): boolean => game.taken.every((t) => t.length === 0);

const holderOf = (game: Game, card: string): number =>
  game.hands.findIndex((hand) => hand.includes(card));

/** The hand begins: the 2♣'s holder leads. */
const startPlay = (game: Game): Game => {
  const leader = Math.max(0, holderOf(game, TWO_OF_CLUBS));
  return {
    ...game,
    phase: 'playing',
    passes: game.names.map(() => null),
    trick: { leader, plays: [] },
    turn: leader,
    note: `${nameOf(game, leader)} leads the 2♣.`,
  };
};

/** Hand `round` dealt to the seats with their `scores` so far: the pass first, or the play on a hold hand. */
export const deal = (
  names: Names,
  rng: Rng,
  round: number,
  scores: ReadonlyArray<number>,
): Game => {
  const n = names.length;
  const shuffled = shuffle(deckFor(n), rng);
  const hands = names.map((_, seat) => sortHand(shuffled.filter((__, k) => k % n === seat)));
  const direction = directionFor(n, round);
  const base: Game = {
    names,
    phase: 'passing',
    round,
    direction,
    hands,
    passes: names.map(() => null),
    trick: { leader: 0, plays: [] },
    lastTrick: null,
    taken: names.map(() => []),
    heartsBroken: false,
    turn: 0,
    scores,
    handScores: null,
    moon: null,
    note: `Hand ${String(round)}: pass three cards ${direction}.`,
  };
  return direction === 'hold' ? startPlay(base) : base;
};

/** A fresh game: hand 1, every score 0. */
export const newGame = (names: Names, rng: Rng): Game =>
  deal(
    names,
    rng,
    1,
    names.map(() => 0),
  );

/** §4: the cards `seat` may play now; empty off its turn or outside the play. */
export const legalPlays = (game: Game, seat: number): Cards => {
  if (game.phase !== 'playing' || seat !== game.turn) return [];
  const hand = handOf(game, seat);
  const first = isFirstTrick(game);
  const led = game.trick.plays[0];
  if (led === undefined) {
    if (first) return hand.filter((id) => id === TWO_OF_CLUBS);
    const safe = hand.filter((id) => !isHeart(id));
    return game.heartsBroken || safe.length === 0 ? hand : safe;
  }
  const suit = suitOf(led.card);
  const same = hand.filter((id) => suitOf(id) === suit);
  if (same.length > 0) return same;
  if (!first) return hand;
  const clean = hand.filter((id) => pointsOf(id) === 0);
  return clean.length === 0 ? hand : clean;
};

/** Whether `seat` may pass `ids` now: three distinct cards of its hand, not yet passed. */
export const isLegalPass = (game: Game, seat: number, ids: Cards): boolean => {
  const hand = handOf(game, seat);
  return (
    game.phase === 'passing' &&
    game.passes[seat] === null &&
    ids.length === PASS_COUNT &&
    new Set(ids).size === PASS_COUNT &&
    ids.every((id) => hand.includes(id))
  );
};

/** The seat that must act now, or null when any seat may (the hand's or the game's end). */
export const actorOf = (game: Game): number | null => {
  switch (game.phase) {
    case 'passing': {
      const waiting = game.passes.findIndex((p) => p === null);
      return waiting < 0 ? null : waiting;
    }
    case 'playing':
      return game.turn;
    case 'handOver':
    case 'gameOver':
      return null;
  }
};

/**
 * What `seat` may do now. During the pass any three cards are legal (`isLegalPass`); the one
 * intent listed is the three highest, the plain pass a bot makes. Between hands and after the
 * game every seat may deal on.
 */
export const legalIntents = (game: Game, seat: number): ReadonlyArray<Intent> => {
  switch (game.phase) {
    case 'passing':
      return game.passes[seat] === null
        ? [{ type: 'pass', seat, ids: highest(handOf(game, seat), PASS_COUNT) }]
        : [];
    case 'playing':
      return legalPlays(game, seat).map((id): Intent => ({ type: 'play', id }));
    case 'handOver':
      return [{ type: 'nextHand' }];
    case 'gameOver':
      return [{ type: 'playAgain' }];
  }
};

/** Every seat has chosen: the cards move, the 2♣'s holder leads. */
const resolvePasses = (game: Game): Game => {
  const hands = game.names.map((_, seat) => {
    const out = game.passes[seat] ?? [];
    const incoming = game.passes[passSourceOf(game, seat)] ?? [];
    return sortHand([...handOf(game, seat).filter((id) => !out.includes(id)), ...incoming]);
  });
  return startPlay({ ...game, hands });
};

const applyPass = (game: Game, seat: number, ids: Cards): Result<Game, string> => {
  if (game.phase !== 'passing') return err('No cards are passed now.');
  if (game.passes[seat] === undefined) return err('No such seat.');
  if (game.passes[seat] !== null) return err('You have passed already.');
  if (!isLegalPass(game, seat, ids)) return err('Pass three cards of your hand.');
  const passes = game.passes.map((p, i) => (i === seat ? ids : p));
  const next: Game = {
    ...game,
    passes,
    note: `${nameOf(game, seat)} passed.`,
  };
  return ok(passes.every((p) => p !== null) ? resolvePasses(next) : next);
};

/** The play that takes the trick: the highest card of the suit led. */
export const takerOf = (plays: ReadonlyArray<Play>): number => {
  const led = plays[0];
  if (led === undefined) return 0;
  const suit = suitOf(led.card);
  return plays
    .filter((p) => suitOf(p.card) === suit)
    .reduce((best, p) => (rankOf(p.card) > rankOf(best.card) ? p : best), led).seat;
};

/** The winners of a finished game: every seat on the lowest score (a tie is shared). */
export const winnersOf = (scores: ReadonlyArray<number>): ReadonlyArray<number> => {
  const low = Math.min(...scores);
  return scores.flatMap((s, i) => (s === low ? [i] : []));
};

/** §5-§6: the hand's points, the moon turned round, the totals, and the end at 100. */
const endHand = (game: Game, taken: ReadonlyArray<Cards>, note: string): Game => {
  const raw = taken.map(pointsIn);
  const moon = raw.findIndex((p) => p === TOTAL_POINTS);
  const handScores = moon < 0 ? raw : raw.map((_, i) => (i === moon ? 0 : TOTAL_POINTS));
  const scores = game.scores.map((s, i) => s + (handScores[i] ?? 0));
  const over = scores.some((s) => s >= GAME_END);
  const moonNote = moon < 0 ? '' : ` ${nameOf(game, moon)} shot the moon!`;
  const endNote = over
    ? ` ${winnersOf(scores)
        .map((w) => nameOf(game, w))
        .join(' and ')} wins the game.`
    : '';
  return {
    ...game,
    phase: over ? 'gameOver' : 'handOver',
    taken,
    handScores,
    moon: moon < 0 ? null : moon,
    scores,
    note: `${note}${moonNote}${endNote}`.trim(),
  };
};

/** The trick is full: the taker gathers it and leads, or the hand ends when the cards are out. */
const closeTrick = (game: Game, plays: ReadonlyArray<Play>, hands: ReadonlyArray<Cards>): Game => {
  const taker = takerOf(plays);
  const cards = plays.map((p) => p.card);
  const points = pointsIn(cards);
  const taken = game.taken.map((t, i) => (i === taker ? [...t, ...cards] : t));
  const lastTrick: TrickResult = { leader: game.trick.leader, plays, taker, points };
  const note =
    points === 0
      ? `${nameOf(game, taker)} takes the trick.`
      : `${nameOf(game, taker)} takes the trick: ${String(points)} point${points === 1 ? '' : 's'}.`;
  const next: Game = {
    ...game,
    hands,
    lastTrick,
    trick: { leader: taker, plays: [] },
    turn: taker,
    note,
  };
  return hands.every((h) => h.length === 0) ? endHand(next, taken, note) : { ...next, taken };
};

/** Why the card may not be played now, in the player's words. */
const refusalFor = (game: Game): string => {
  const led = game.trick.plays[0];
  if (led === undefined) {
    if (isFirstTrick(game)) return 'The 2♣ leads the first trick.';
    return 'Hearts have not been broken.';
  }
  const hand = handOf(game, game.turn);
  if (hand.some((c) => suitOf(c) === suitOf(led.card))) return 'Follow suit.';
  return 'No points on the first trick.';
};

const applyPlay = (game: Game, id: string): Result<Game, string> => {
  if (game.phase !== 'playing') return err('No card is played now.');
  const seat = game.turn;
  const hand = handOf(game, seat);
  if (!hand.includes(id)) return err('That card is not in your hand.');
  const legal = legalPlays(game, seat);
  if (!legal.includes(id)) return err(refusalFor(game));
  const plays = [...game.trick.plays, { seat, card: id }];
  const hands = game.hands.map((h, i) => (i === seat ? h.filter((c) => c !== id) : h));
  const broken = game.heartsBroken || isHeart(id);
  const played: Game = { ...game, heartsBroken: broken };
  if (plays.length === seatCount(game)) return ok(closeTrick(played, plays, hands));
  const next = nextSeat(game, seat);
  return ok({
    ...played,
    hands,
    trick: { ...game.trick, plays },
    turn: next,
    note: `${nameOf(game, seat)} played ${id}.`,
  });
};

/** One intent; a refusal is the reason. */
export const apply = (game: Game, intent: Intent, rng: Rng): Result<Game, string> => {
  switch (intent.type) {
    case 'pass':
      return applyPass(game, intent.seat, intent.ids);
    case 'play':
      return applyPlay(game, intent.id);
    case 'nextHand':
      if (game.phase !== 'handOver') return err('The hand is still on.');
      return ok(deal(game.names, rng, game.round + 1, game.scores));
    case 'playAgain':
      if (game.phase !== 'gameOver') return err('The game is still on.');
      return ok(newGame(game.names, rng));
  }
};
