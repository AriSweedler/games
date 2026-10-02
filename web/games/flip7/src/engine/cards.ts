// The Flip 7 deck (docs/design/flip7.md §2): 94 cards. Number cards 0-12, as many copies of each
// as its value (one 1, two 2s … twelve 12s) plus one 0: 79 in all. Three each of the action cards
// Freeze, Flip Three and Second Chance. Six score modifiers: +2, +4, +6, +8, +10 and x2, one each.
// `scoreLine` is the one scoring rule (the numbers, doubled by x2, plus the bonuses; 15 more for
// seven unique numbers). Nothing here reads a game: these are the selectors the engine, the paint
// and the tests share. The base pack is plain tiles (§7).

export type Kind = 'number' | 'freeze' | 'flip3' | 'second' | 'plus' | 'times2';

export type Card = Readonly<{
  /** Stable across a game: the paint keys on it and the intents name it. */
  id: string;
  kind: Kind;
  /** 0-12 for a number card, the bonus for a `plus`, else null. */
  value: number | null;
}>;
export type Cards = ReadonlyArray<Card>;

export const NUMBER_MAX = 12;
export const FLIP7_COUNT = 7;
export const FLIP7_BONUS = 15;
export const PLUS_VALUES: ReadonlyArray<number> = [2, 4, 6, 8, 10];
export const ACTION_COPIES = 3;

const numberCard = (value: number, copy: number): Card => ({
  id: `n${String(value)}-${String(copy)}`,
  kind: 'number',
  value,
});

const actionCard = (kind: 'freeze' | 'flip3' | 'second', copy: number): Card => ({
  id: `${kind}-${String(copy)}`,
  kind,
  value: null,
});

/** §2: the 94 cards, numbers first (0, then 1 … 12 by copies), the nine actions, the six modifiers. */
export const makeDeck = (): Cards => [
  numberCard(0, 1),
  ...Array.from({ length: NUMBER_MAX }, (_, i) => i + 1).flatMap((value) =>
    Array.from({ length: value }, (__, copy) => numberCard(value, copy + 1)),
  ),
  ...(['freeze', 'flip3', 'second'] as const).flatMap((kind) =>
    Array.from({ length: ACTION_COPIES }, (_, copy) => actionCard(kind, copy + 1)),
  ),
  ...PLUS_VALUES.map((value): Card => ({ id: `plus${String(value)}`, kind: 'plus', value })),
  { id: 'times2', kind: 'times2', value: null },
];

export const isAction = (card: Card): boolean =>
  card.kind === 'freeze' || card.kind === 'flip3' || card.kind === 'second';

export const isModifier = (card: Card): boolean => card.kind === 'plus' || card.kind === 'times2';

/** The number values in a line, in the order drawn. */
export const numbersOf = (cards: Cards): ReadonlyArray<number> =>
  cards.filter((card) => card.kind === 'number').map((card) => card.value ?? 0);

/** §4: seven distinct numbers end the round with the bonus. */
export const isFlip7 = (cards: Cards): boolean => new Set(numbersOf(cards)).size >= FLIP7_COUNT;

/**
 * §6: a line's score when it was not busted: the numbers' sum, doubled by x2, then the + bonuses,
 * then 15 for a Flip 7. A busted line scores nothing (the engine never asks).
 */
export const scoreLine = (cards: Cards): number => {
  const numbers = numbersOf(cards).reduce((sum, value) => sum + value, 0);
  const doubled = cards.some((card) => card.kind === 'times2') ? numbers * 2 : numbers;
  const plus = cards
    .filter((card) => card.kind === 'plus')
    .reduce((sum, card) => sum + (card.value ?? 0), 0);
  return doubled + plus + (isFlip7(cards) ? FLIP7_BONUS : 0);
};

export const idsOf = (cards: Cards): ReadonlyArray<string> => cards.map((card) => card.id);

export const cardName = (card: Card): string => {
  switch (card.kind) {
    case 'number':
      return String(card.value ?? 0);
    case 'freeze':
      return 'Freeze';
    case 'flip3':
      return 'Flip Three';
    case 'second':
      return 'Second Chance';
    case 'plus':
      return `+${String(card.value ?? 0)}`;
    case 'times2':
      return 'x2';
    default: {
      const never: never = card.kind;
      return never;
    }
  }
};
