// The Flip 7 engine (docs/design/flip7.md §3-§6): a pure press-your-luck game of two to eight
// seats around one deck. A round deals one card to every seat, then each active seat in turn hits
// (one card) or stays (banks). A number already in the line busts the seat (a Second Chance in
// the line saves it once); seven distinct numbers end the round at once with a bonus. Freeze,
// Flip Three and Second Chance are given away when drawn: to any active seat, the drawer
// included, or to the only one left; when more than one seat could take it the engine asks
// (`target` phase). The randomness (the shuffles) comes in as an `Rng` so a test scripts a whole
// round and the e2e seeds one. The deck persists across rounds; the discards reshuffle when it
// runs out.
import type { Rng } from '../../../../shared/lib/rng.ts';
import { shuffle } from '../../../../shared/lib/shuffle.ts';
import {
  cardName,
  isFlip7,
  makeDeck,
  numbersOf,
  scoreLine,
  type Card,
  type Cards,
} from './cards.ts';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
/** §6: the first player to reach this many points, alone at the top, wins the game. */
export const DEFAULT_TARGET = 200;
export const FLIP3_COUNT = 3;

/** A seat's standing in the round, in the order the table paints them. */
export const STATUSES = ['active', 'stayed', 'frozen', 'busted', 'flip7'] as const;
export type Status = (typeof STATUSES)[number];

export type Seat = Readonly<{
  name: string;
  /** The cards in front of the seat this round: numbers, modifiers and a held Second Chance. */
  line: Cards;
  status: Status;
}>;

/** An action card waiting to be given away: who drew it. */
export type Pending = Readonly<{ card: Card; from: number }>;

export type Phase =
  /** The current seat hits or stays (during the opening deal it can only hit). */
  | Readonly<{ kind: 'turn' }>
  /** An action card needs a taker: one of `choices`. */
  | Readonly<{ kind: 'target'; card: Card; from: number; choices: ReadonlyArray<number> }>
  | Readonly<{ kind: 'roundOver' }>
  | Readonly<{ kind: 'gameOver'; winner: number }>;

export type Game = Readonly<{
  seats: ReadonlyArray<Seat>;
  /** The draw pile, top last. */
  draw: Cards;
  discard: Cards;
  dealer: number;
  /** The seat acting now. */
  turn: number;
  /** Seats still owed their first card of the round (the opening deal). */
  opening: number;
  /** A Flip Three in progress: whose, and how many cards are still to come. */
  flip3: Readonly<{ seat: number; left: number }> | null;
  pending: ReadonlyArray<Pending>;
  phase: Phase;
  scores: ReadonlyArray<number>;
  target: number;
  round: number;
  /** What just happened, for the status line. */
  note: string;
}>;

export type Intent =
  | Readonly<{ type: 'hit' }>
  | Readonly<{ type: 'stay' }>
  | Readonly<{ type: 'give'; seat: number }>
  | Readonly<{ type: 'nextRound' }>;

/** A card that is never dealt: the fallback where a pile the engine keeps non-empty is read. */
export const NO_CARD: Card = { id: '', kind: 'number', value: 0 };

export const seatOf = (game: Game, seat: number): Seat =>
  game.seats[seat] ?? { name: '', line: [], status: 'busted' };

export const nameOf = (game: Game, seat: number): string => seatOf(game, seat).name;

export const isActive = (game: Game, seat: number): boolean =>
  seatOf(game, seat).status === 'active';

export const activeSeats = (game: Game): ReadonlyArray<number> =>
  game.seats.map((_, i) => i).filter((i) => isActive(game, i));

export const hasSecondChance = (seat: Seat): boolean =>
  seat.line.some((card) => card.kind === 'second');

/** The seat after `seat` around the table. */
export const seatAfter = (game: Game, seat: number): number => (seat + 1) % game.seats.length;

/** The next active seat after `seat`, or null when none is left. */
export const nextActive = (game: Game, seat: number): number | null => {
  const n = game.seats.length;
  const order = Array.from({ length: n }, (_, k) => (seat + 1 + k) % n);
  return order.find((s) => isActive(game, s)) ?? null;
};

/** §3: whether the current seat may stay (not during the opening deal). */
export const canStay = (game: Game): boolean =>
  game.phase.kind === 'turn' && game.opening === 0 && isActive(game, game.turn);

export const canHit = (game: Game): boolean =>
  game.phase.kind === 'turn' && isActive(game, game.turn);

const withNote = (game: Game, note: string): Game => ({ ...game, note });

/** One card off the draw pile, the discards reshuffled under it when it is empty. */
const drawCard = (game: Game, rng: Rng): Readonly<{ game: Game; card: Card | null }> => {
  const refilled: Game =
    game.draw.length === 0 && game.discard.length > 0
      ? { ...game, draw: shuffle(game.discard, rng), discard: [] }
      : game;
  const card = refilled.draw[refilled.draw.length - 1];
  if (card === undefined) return { game: refilled, card: null };
  return { game: { ...refilled, draw: refilled.draw.slice(0, -1) }, card };
};

const setSeat = (game: Game, seat: number, patch: Partial<Seat>): Game => ({
  ...game,
  seats: game.seats.map((s, i) => (i === seat ? { ...s, ...patch } : s)),
});

const toDiscard = (game: Game, cards: Cards): Game => ({
  ...game,
  discard: [...game.discard, ...cards],
});

/**
 * §6: the round ends. Every seat not busted banks its line (seven distinct numbers carry the
 * bonus); the lines stay on the table, every bust still showing, until the next round is dealt
 * (`startRound` sends them to the discards); a score at or over the target wins the game when it
 * stands alone at the top, otherwise another round is played.
 */
const settle = (game: Game, note: string): Game => {
  const gained = game.seats.map((seat) => (seat.status === 'busted' ? 0 : scoreLine(seat.line)));
  const scores = game.scores.map((score, i) => score + (gained[i] ?? 0));
  const cleared: Game = {
    ...game,
    scores,
    discard: [...game.discard, ...game.pending.map((pending) => pending.card)],
    pending: [],
    flip3: null,
    opening: 0,
  };
  const best = Math.max(...scores);
  const leaders = scores.map((score, i) => (score === best ? i : -1)).filter((i) => i >= 0);
  const winner = leaders[0];
  if (best >= game.target && leaders.length === 1 && winner !== undefined) {
    return {
      ...cleared,
      phase: { kind: 'gameOver', winner },
      note: `${note} ${nameOf(game, winner)} wins the game with ${String(best)} points.`,
    };
  }
  const gains = game.seats
    .map(
      (seat, i) =>
        `${seat.name} ${seat.status === 'busted' ? 'busts' : `+${String(gained[i] ?? 0)}`}`,
    )
    .join(', ');
  return { ...cleared, phase: { kind: 'roundOver' }, note: `${note} ${gains}.` };
};

/** The taker choices for an action card drawn by `from` (§4): active seats; for a Second Chance, those without one. */
const choicesFor = (game: Game, pending: Pending): ReadonlyArray<number> => {
  const active = activeSeats(game);
  if (pending.card.kind === 'second')
    return active.filter((s) => !hasSecondChance(seatOf(game, s)));
  return active;
};

/** A card lands in a seat's line (§4): a number may bust or complete a Flip 7; an action card goes to `pending`. */
const receive = (game: Game, seat: number, card: Card): Game => {
  const who = seatOf(game, seat);
  switch (card.kind) {
    case 'number': {
      const value = card.value ?? 0;
      if (numbersOf(who.line).includes(value)) {
        if (hasSecondChance(who)) {
          const second = who.line.find((c) => c.kind === 'second') ?? NO_CARD;
          const kept = setSeat(game, seat, { line: who.line.filter((c) => c.id !== second.id) });
          return withNote(
            toDiscard(kept, [card, second]),
            `${who.name} drew another ${String(value)}: the Second Chance takes it.`,
          );
        }
        const busted = setSeat(game, seat, { line: [...who.line, card], status: 'busted' });
        return withNote(busted, `${who.name} drew another ${String(value)} and busts.`);
      }
      const line = [...who.line, card];
      const added = setSeat(game, seat, { line });
      return isFlip7(line)
        ? setSeat(withNote(added, `${who.name} flipped seven: the round ends.`), seat, {
            status: 'flip7',
          })
        : withNote(added, `${who.name} drew a ${String(value)}.`);
    }
    case 'plus':
    case 'times2':
      return withNote(
        setSeat(game, seat, { line: [...who.line, card] }),
        `${who.name} drew ${cardName(card)}.`,
      );
    case 'second':
      return hasSecondChance(who)
        ? withNote(
            { ...game, pending: [...game.pending, { card, from: seat }] },
            `${who.name} drew a second Second Chance: it goes to another seat.`,
          )
        : withNote(
            setSeat(game, seat, { line: [...who.line, card] }),
            `${who.name} drew a Second Chance.`,
          );
    case 'freeze':
    case 'flip3':
      return withNote(
        { ...game, pending: [...game.pending, { card, from: seat }] },
        `${who.name} drew ${cardName(card)}.`,
      );
    default: {
      const never: never = card.kind;
      return never;
    }
  }
};

const someoneFlipped7 = (game: Game): boolean => game.seats.some((seat) => seat.status === 'flip7');

/** After the current seat's card(s): the next seat, the opening deal's count, or the round's end. */
const endTurn = (game: Game): Game => {
  if (someoneFlipped7(game)) return settle(game, game.note);
  if (game.opening > 0) {
    const left = game.opening - 1;
    const after = nextActive(game, game.turn);
    if (after === null) return settle(game, game.note);
    if (left === 0) {
      const first = isActive(game, seatAfter(game, game.dealer))
        ? seatAfter(game, game.dealer)
        : (nextActive(game, game.dealer) ?? after);
      return {
        ...game,
        opening: 0,
        turn: first,
        phase: { kind: 'turn' },
        note: `${game.note} ${nameOf(game, first)} to play.`,
      };
    }
    return { ...game, opening: left, turn: after, phase: { kind: 'turn' } };
  }
  const after = nextActive(game, game.turn);
  if (after === null) return settle(game, game.note);
  return { ...game, turn: after, phase: { kind: 'turn' } };
};

/** Give the head of `pending` to `seat` (§4) and carry on. */
const applyGift = (game: Game, seat: number, rng: Rng): Game => {
  const head = game.pending[0];
  if (head === undefined) return game;
  const rest: Game = { ...game, pending: game.pending.slice(1), phase: { kind: 'turn' } };
  const taker = nameOf(game, seat);
  switch (head.card.kind) {
    case 'freeze': {
      const frozen = setSeat(toDiscard(rest, [head.card]), seat, { status: 'frozen' });
      return withNote(
        frozen,
        `${taker} is frozen and banks ${String(scoreLine(seatOf(frozen, seat).line))}.`,
      );
    }
    case 'flip3':
      return flipThree(
        withNote(
          toDiscard({ ...rest, flip3: { seat, left: FLIP3_COUNT } }, [head.card]),
          `${taker} must flip three.`,
        ),
        rng,
      );
    case 'second':
      return withNote(
        setSeat(rest, seat, { line: [...seatOf(rest, seat).line, head.card] }),
        `${taker} takes the Second Chance.`,
      );
    case 'number':
    case 'plus':
    case 'times2':
      return rest;
    default: {
      const never: never = head.card.kind;
      return never;
    }
  }
};

/** The Flip Three cards, one at a time; a bust or a Flip 7 stops it, an action drawn waits its turn (§4). */
const flipThree = (game: Game, rng: Rng): Game => {
  const flip = game.flip3;
  if (flip === null) return game;
  if (flip.left === 0 || !isActive(game, flip.seat) || someoneFlipped7(game))
    return { ...game, flip3: null };
  const drawn = drawCard(game, rng);
  if (drawn.card === null) return { ...drawn.game, flip3: null };
  const next = receive(
    { ...drawn.game, flip3: { seat: flip.seat, left: flip.left - 1 } },
    flip.seat,
    drawn.card,
  );
  return flipThree(next, rng);
};

/** Resolve what is pending: give away each action card, asking when there is a choice; then end the turn. */
const resolve = (game: Game, rng: Rng): Game => {
  if (someoneFlipped7(game)) return settle(game, game.note);
  if (game.flip3 !== null) return resolve(flipThree(game, rng), rng);
  const head = game.pending[0];
  if (head === undefined) return endTurn(game);
  const choices = choicesFor(game, head);
  if (choices.length === 0) {
    return resolve(
      withNote(
        toDiscard({ ...game, pending: game.pending.slice(1) }, [head.card]),
        `${game.note} Nobody can take the ${cardName(head.card)}: it is discarded.`,
      ),
      rng,
    );
  }
  const only = choices[0];
  if (choices.length === 1 && only !== undefined) return resolve(applyGift(game, only, rng), rng);
  return { ...game, phase: { kind: 'target', card: head.card, from: head.from, choices } };
};

/** §3: a fresh round: every seat active with an empty line, the opening deal starting left of the dealer. */
const startRound = (game: Game): Game => {
  const first = seatAfter(game, game.dealer);
  return {
    ...game,
    discard: [...game.discard, ...game.seats.flatMap((seat) => seat.line)],
    seats: game.seats.map((seat) => ({ ...seat, line: [], status: 'active' })),
    turn: first,
    opening: game.seats.length,
    flip3: null,
    pending: [],
    phase: { kind: 'turn' },
    note: `Round ${String(game.round)}: one card each, starting with ${nameOf(game, first)}.`,
  };
};

/** A new game of `names` (MIN_PLAYERS to MAX_PLAYERS seats; the page keeps the bounds), round 1 ready to deal. */
export const deal = (names: ReadonlyArray<string>, rng: Rng, target = DEFAULT_TARGET): Game =>
  startRound({
    seats: names.map((name) => ({ name, line: [], status: 'active' })),
    draw: shuffle(makeDeck(), rng),
    discard: [],
    dealer: names.length - 1,
    turn: 0,
    opening: 0,
    flip3: null,
    pending: [],
    phase: { kind: 'turn' },
    scores: names.map(() => 0),
    target,
    round: 1,
    note: '',
  });

const refuse = (game: Game, note: string): Game => withNote(game, note);

const hit = (game: Game, rng: Rng): Game => {
  if (!canHit(game)) return refuse(game, 'Not now.');
  const drawn = drawCard(game, rng);
  if (drawn.card === null)
    return settle(withNote(drawn.game, 'The deck is empty.'), 'The deck is empty.');
  return resolve(receive(drawn.game, game.turn, drawn.card), rng);
};

const stay = (game: Game, rng: Rng): Game => {
  if (!canStay(game)) return refuse(game, game.opening > 0 ? 'The deal comes first.' : 'Not now.');
  const seat = seatOf(game, game.turn);
  const stayed = setSeat(game, game.turn, { status: 'stayed' });
  return resolve(
    withNote(stayed, `${seat.name} stays and banks ${String(scoreLine(seat.line))}.`),
    rng,
  );
};

const give = (game: Game, seat: number, rng: Rng): Game => {
  if (game.phase.kind !== 'target') return refuse(game, 'Nothing to give.');
  if (!game.phase.choices.includes(seat))
    return refuse(game, `${nameOf(game, seat)} cannot take it.`);
  return resolve(applyGift(game, seat, rng), rng);
};

const nextRound = (game: Game): Game => {
  if (game.phase.kind !== 'roundOver') return refuse(game, 'The round is not over.');
  return startRound({ ...game, dealer: seatAfter(game, game.dealer), round: game.round + 1 });
};

/** One intent against the game; an intent that does not apply leaves the state and sets the note. */
export const apply = (game: Game, intent: Intent, rng: Rng): Game => {
  switch (intent.type) {
    case 'hit':
      return hit(game, rng);
    case 'stay':
      return stay(game, rng);
    case 'give':
      return give(game, intent.seat, rng);
    case 'nextRound':
      return nextRound(game);
    default: {
      const never: never = intent;
      return never;
    }
  }
};

/** Every card in play: the lines, both piles and the actions waiting for a taker; 94 whenever the engine is consistent. */
export const cardCount = (game: Game): number =>
  game.seats.reduce((sum, seat) => sum + seat.line.length, 0) +
  game.draw.length +
  game.discard.length +
  game.pending.length;

/** What a seat would bank now (§6), for the paint. */
export const lineScore = (seat: Seat): number =>
  seat.status === 'busted' ? 0 : scoreLine(seat.line);
