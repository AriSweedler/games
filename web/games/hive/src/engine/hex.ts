// The grid Hive is played on (docs/design/hive.md §3): axial coordinates (q, r) on a grid with no
// edges, the six neighbour offsets in turning order, the rings around a hex, the Freedom to Move
// test for one step between neighbours at any height, the flood fill behind the One Hive rule and
// the Ant, and the exact-length walks of the Spider. Game-free: the engine passes the board in as
// a height function, so every rule here is a statement about hexes and heights alone.

export type Hex = Readonly<{ q: number; r: number }>;

/** Where the first tile goes: the grid has no edges, so every first hex is the same. */
export const ORIGIN: Hex = { q: 0, r: 0 };

/** The six neighbour offsets in turning order: each touches the one before it and the one after. */
export const DIRECTIONS: ReadonlyArray<Hex> = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });

export const scale = (a: Hex, k: number): Hex => ({ q: a.q * k, r: a.r * k });

export const sameHex = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

/** A hex as a board key: `"q,r"`. */
export const keyOf = (h: Hex): string => `${String(h.q)},${String(h.r)}`;

/** The hex a board key names (keyOf's inverse); a part that is not a number reads as 0. */
export const hexOf = (key: string): Hex => {
  const [q = 0, r = 0] = key.split(',').map((part) => Number.parseInt(part, 10) || 0);
  return { q, r };
};

export const neighbours = (h: Hex): ReadonlyArray<Hex> => DIRECTIONS.map((d) => add(h, d));

/** The number of steps between two hexes. */
export const distance = (a: Hex, b: Hex): number => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

/** Each hex once, in first-seen order. */
export const dedupe = (hexes: ReadonlyArray<Hex>): ReadonlyArray<Hex> => [
  ...new Map(hexes.map((h) => [keyOf(h), h] as const)).values(),
];

/**
 * The hexes `radius` steps from `center`, in walking order: each touches the next and the last
 * touches the first (the center alone at radius 0). The walk starts `radius` steps along
 * DIRECTIONS[4] and turns through the six directions, `radius` steps each.
 */
export const ring = (center: Hex, radius: number): ReadonlyArray<Hex> => {
  if (radius <= 0) return [center];
  const start = add(center, scale(DIRECTIONS[4] ?? ORIGIN, radius));
  const corners = DIRECTIONS.reduce<ReadonlyArray<Hex>>(
    (acc, d) => [...acc, add(acc[acc.length - 1] ?? start, scale(d, radius))],
    [start],
  );
  return DIRECTIONS.flatMap((d, side) =>
    Array.from({ length: radius }, (_, step) => add(corners[side] ?? start, scale(d, step))),
  );
};

/** The two hexes that touch both `a` and its neighbour `b`: the gap a tile passes stepping across. */
export const sharedNeighbours = (a: Hex, b: Hex): ReadonlyArray<Hex> => {
  const i = DIRECTIONS.findIndex((d) => sameHex(add(a, d), b));
  if (i < 0) return [];
  return [add(a, DIRECTIONS[(i + 5) % 6] ?? ORIGIN), add(a, DIRECTIONS[(i + 1) % 6] ?? ORIGIN)];
};

/**
 * Freedom to Move for one step from `from` to its neighbour `to` (docs/design/hive.md §4.4).
 * `height` reads the board with the moving tile lifted off. The tile travels at the level of the
 * taller of the two stacks and passes between the two hexes that touch both unless both are taller
 * than that level (the gap is too narrow). At ground level, a slide, it must also keep touching
 * the hive on the way, so exactly one of the two may be occupied. A step to a hex that is not a
 * neighbour is never one.
 */
export const canStep = (height: (h: Hex) => number, from: Hex, to: Hex): boolean => {
  const [a, b] = sharedNeighbours(from, to).map(height);
  if (a === undefined || b === undefined) return false;
  const level = Math.max(height(from), height(to));
  return level === 0 ? a > 0 !== b > 0 : Math.min(a, b) <= level;
};

/** Every hex reachable from `starts` through `step`, the starts included, keyed by keyOf. */
export const flood = (
  starts: ReadonlyArray<Hex>,
  step: (h: Hex) => ReadonlyArray<Hex>,
): ReadonlyMap<string, Hex> => {
  const grow = (
    seen: ReadonlyMap<string, Hex>,
    frontier: ReadonlyArray<Hex>,
  ): ReadonlyMap<string, Hex> => {
    const fresh = dedupe(frontier.flatMap(step)).filter((h) => !seen.has(keyOf(h)));
    return fresh.length === 0
      ? seen
      : grow(new Map([...seen, ...fresh.map((h) => [keyOf(h), h] as const)]), fresh);
  };
  return grow(new Map(starts.map((h) => [keyOf(h), h] as const)), starts);
};

/** One group: every hex reaches every other through neighbours in the set (none is one group too). */
export const isConnected = (cells: ReadonlyArray<Hex>): boolean => {
  const first = cells[0];
  if (first === undefined) return true;
  const keys = new Set(cells.map(keyOf));
  const step = (h: Hex): ReadonlyArray<Hex> => neighbours(h).filter((n) => keys.has(keyOf(n)));
  return flood([first], step).size === keys.size;
};

/** Where every walk of exactly `steps` steps from `start` through `step` ends, never entering a hex twice (the start included). */
export const walkEnds = (
  start: Hex,
  steps: number,
  step: (h: Hex) => ReadonlyArray<Hex>,
): ReadonlyArray<Hex> => {
  const extend = (path: ReadonlyArray<Hex>, left: number): ReadonlyArray<Hex> => {
    const here = path[path.length - 1] ?? start;
    if (left <= 0) return [here];
    return step(here)
      .filter((next) => !path.some((been) => sameHex(been, next)))
      .flatMap((next) => extend([...path, next], left - 1));
  };
  return dedupe(extend([start], steps));
};
