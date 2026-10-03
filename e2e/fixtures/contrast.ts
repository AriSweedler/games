// The colour arithmetic the `home-felt` conformance rule reads (e2e/shell-conformance.spec.ts;
// docs/design/game-conformance.md): the computed colours a page reports (`rgb(r, g, b)`,
// `rgba(r, g, b, a)`, `transparent`) parsed, the opaque ones picked out of a background-image's
// gradient stops, and the WCAG 2 contrast ratio between two of them (relative luminance per
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance; 4.5:1 is AA for body text). Pure, so the
// spec's one assertion names the ratio it measured.

export type Rgb = Readonly<{ r: number; g: number; b: number; a: number }>;

const RGB =
  /rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*(\d*\.?\d+)\s*)?\)/g;

const toRgb = (m: RegExpMatchArray): Rgb => ({
  r: Number(m[1]),
  g: Number(m[2]),
  b: Number(m[3]),
  a: m[4] === undefined ? 1 : Number(m[4]),
});

/** Every colour spelled in a computed value (a gradient's stops, a plain colour), in order. */
export const colorsIn = (value: string): ReadonlyArray<Rgb> =>
  Array.from(value.matchAll(RGB), toRgb);

/** The one colour a computed `color`/`background-color` is, or null for `transparent` and anything else. */
export const parseColor = (value: string): Rgb | null => colorsIn(value)[0] ?? null;

export const isOpaque = (c: Rgb | null): c is Rgb => c !== null && c.a >= 1;

const channel = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, 0 (black) to 1 (white). */
export const luminance = (c: Rgb): number =>
  0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);

/** The WCAG contrast ratio between two opaque colours, 1 to 21. */
export const contrast = (x: Rgb, y: Rgb): number => {
  const lx = luminance(x);
  const ly = luminance(y);
  return (Math.max(lx, ly) + 0.05) / (Math.min(lx, ly) + 0.05);
};

/** A colour as a page spells it, for a failure message. */
export const spell = (c: Rgb): string =>
  c.a >= 1
    ? `rgb(${String(c.r)}, ${String(c.g)}, ${String(c.b)})`
    : `rgba(${String(c.r)}, ${String(c.g)}, ${String(c.b)}, ${String(c.a)})`;
