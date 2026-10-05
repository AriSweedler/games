// Hearts's cards (docs/design/hearts.md §2): the shared 52-card French deck (gin's ids, `AS`,
// `10H`, `QS`) read for the one game's needs: a rank where the ace is high, the suit, the points
// a card carries (each heart 1, the queen of spades 13, 26 in all), the deck for the table (the
// 2♦ out at three seats, so 51 deals as 17 each) and the order a hand is shown in.
import { cardIds, splitId } from '../../../../shared/lib/cards/decks.ts';

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Cards = ReadonlyArray<string>;

export const DECK: Cards = cardIds('french52');

export const TWO_OF_CLUBS = '2C';
export const QUEEN_OF_SPADES = 'QS';
export const TWO_OF_DIAMONDS = '2D';
/** Every point in a hand: thirteen hearts and the queen; a seat that takes them all shot the moon. */
export const TOTAL_POINTS = 26;

export const suitOf = (id: string): Suit => id.slice(-1) as Suit;

const FACE_RANKS: Readonly<Record<string, number>> = { J: 11, Q: 12, K: 13, A: 14 };

/** 2 to 14: the ace is high in Hearts. */
export const rankOf = (id: string): number => {
  const rank = id.slice(0, -1);
  return FACE_RANKS[rank] ?? Number(rank);
};

export const isHeart = (id: string): boolean => suitOf(id) === 'H';

export const pointsOf = (id: string): number => (id === QUEEN_OF_SPADES ? 13 : isHeart(id) ? 1 : 0);

export const pointsIn = (cards: Cards): number =>
  cards.reduce((sum, card) => sum + pointsOf(card), 0);

export const isCard = (id: string): boolean => splitId('french52', id) !== null;

/** The deck the table deals: 52 at four seats; 51 at three, the 2♦ out (pagat.com). */
export const deckFor = (seats: number): Cards =>
  seats === 3 ? DECK.filter((id) => id !== TWO_OF_DIAMONDS) : DECK;

const SUIT_ORDER: ReadonlyArray<Suit> = ['C', 'D', 'S', 'H'];

const suitIndex = (id: string): number => SUIT_ORDER.indexOf(suitOf(id));

/** Clubs, diamonds, spades, hearts, each low to high: the order a hand is held in. */
export const sortHand = (cards: Cards): Cards =>
  [...cards].sort((a, b) => suitIndex(a) - suitIndex(b) || rankOf(a) - rankOf(b));

/** The three highest cards of a hand, the plain pass a bot makes. */
export const highest = (cards: Cards, count: number): Cards =>
  [...cards].sort((a, b) => rankOf(b) - rankOf(a)).slice(0, count);
