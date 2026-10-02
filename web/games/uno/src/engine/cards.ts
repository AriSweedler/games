// The UNO deck (docs/design/uno.md §2): 108 cards, four colours of one 0, two each of 1-9, two
// Skip, two Reverse, two Draw Two, plus four Wild and four Wild Draw Four. `playableOn` is the one
// matching rule (colour, number or symbol; a wild always), `pointsOf` the one scoring table
// (face value, 20 for an action card, 50 for a wild). Nothing here reads a game: these are the
// selectors the engine, the paint and the tests share. The art is the paint's (a coloured tile
// with a glyph: the base pack is deliberately plain, §7).

export const COLORS = ['red', 'yellow', 'green', 'blue'] as const;
export type Color = (typeof COLORS)[number];

export type Kind = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';
export const ACTION_KINDS: ReadonlyArray<Kind> = ['skip', 'reverse', 'draw2'];
export const WILD_KINDS: ReadonlyArray<Kind> = ['wild', 'wild4'];

export type Card = Readonly<{
  /** Stable across a game: the paint keys on it and the intents name it. */
  id: string;
  kind: Kind;
  /** A wild has no colour of its own; the active colour is the game's. */
  color: Color | null;
  /** 0-9 for a number card, else null. */
  value: number | null;
}>;
export type Cards = ReadonlyArray<Card>;

const COLOR_LETTER: Readonly<Record<Color, string>> = {
  red: 'r',
  yellow: 'y',
  green: 'g',
  blue: 'b',
};
const KIND_LETTER: Readonly<Record<Exclude<Kind, 'number' | 'wild' | 'wild4'>, string>> = {
  skip: 'S',
  reverse: 'R',
  draw2: 'D',
};

const numberCard = (color: Color, value: number, copy: string): Card => ({
  id: `${COLOR_LETTER[color]}${String(value)}${copy}`,
  kind: 'number',
  color,
  value,
});

const actionCard = (color: Color, kind: 'skip' | 'reverse' | 'draw2', copy: string): Card => ({
  id: `${COLOR_LETTER[color]}${KIND_LETTER[kind]}${copy}`,
  kind,
  color,
  value: null,
});

const wildCard = (kind: 'wild' | 'wild4', n: number): Card => ({
  id: `${kind === 'wild' ? 'W' : 'F'}${String(n)}`,
  kind,
  color: null,
  value: null,
});

/** One colour's 25 cards: a 0, two of 1-9, two of each action. */
const suit = (color: Color): Cards => [
  numberCard(color, 0, ''),
  ...Array.from({ length: 9 }, (_, i) => i + 1).flatMap((value) => [
    numberCard(color, value, 'a'),
    numberCard(color, value, 'b'),
  ]),
  ...(['skip', 'reverse', 'draw2'] as const).flatMap((kind) => [
    actionCard(color, kind, 'a'),
    actionCard(color, kind, 'b'),
  ]),
];

/** §2: the 108 cards, colour-major in COLORS order, then the four Wild and the four Wild Draw Four. */
export const makeDeck = (): Cards => [
  ...COLORS.flatMap(suit),
  ...Array.from({ length: 4 }, (_, i) => wildCard('wild', i + 1)),
  ...Array.from({ length: 4 }, (_, i) => wildCard('wild4', i + 1)),
];

export const isWild = (card: Card): boolean => WILD_KINDS.includes(card.kind);

/** §6: face value for a number, 20 for Skip, Reverse and Draw Two, 50 for either wild. */
export const pointsOf = (card: Card): number =>
  card.kind === 'number' ? (card.value ?? 0) : isWild(card) ? 50 : 20;

export const pointsOfHand = (cards: Cards): number =>
  cards.reduce((sum, card) => sum + pointsOf(card), 0);

/**
 * §3: a card may be played on the top card when it is a wild, shares the active colour (the top
 * card's, or the one chosen for a wild), or shares the top card's number or symbol.
 */
export const playableOn = (card: Card, top: Card, activeColor: Color): boolean =>
  isWild(card) ||
  card.color === activeColor ||
  (card.kind === 'number' && top.kind === 'number' && card.value === top.value) ||
  (card.kind !== 'number' && card.kind === top.kind);

export const idsOf = (cards: Cards): ReadonlyArray<string> => cards.map((card) => card.id);

/** The card named, or undefined. */
export const findCard = (cards: Cards, id: string): Card | undefined =>
  cards.find((card) => card.id === id);

export const without = (cards: Cards, id: string): Cards => cards.filter((card) => card.id !== id);
