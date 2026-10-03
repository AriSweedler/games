// The pass-and-play seat names (the owner, 2026-10-02: "more than 4 players should paint properly
// ... Make it impossible to have a bad menu like this"): one input per seat the stepper allows,
// built once here for every game with a local stepper, instead of each page hand-writing a row of
// four (UNO's and briscola's cap) or twelve (Flip 7's). `#p1NameInput` and `#p2NameInput` are the
// shell's (web/shared/markup/shell.ts BLOCK_IDS: the shared binder reads and clears them), the
// seats past the second are hidden until web/shared/ui/seatNames.ts shows the first `n`. Two
// columns (shell.css `.seat-names`). Pure: a string.

/** The seat-name inputs: how many seats the page can hold, and the indent every line gets. */
export type SeatNamesMarkup = Readonly<{ max: number; indent?: string }>;

/** The grid's id. */
const SEAT_NAMES_ID = 'seatNames';

/** The input of seat `seat` (0-based): `p1NameInput` … `p12NameInput`. */
export const seatNameInputId = (seat: number): string => `p${String(seat + 1)}NameInput`;

/** The seats past the shell's two, 0-based: `[2, …, max - 1]`. */
export const extraSeats = (max: number): ReadonlyArray<number> =>
  Array.from({ length: Math.max(0, max - 2) }, (_, i) => i + 2);

const inputHtml = (seat: number): string =>
  `  <input type="text" id="${seatNameInputId(seat)}" class="grow${seat >= 2 ? ' hidden' : ''}" placeholder="Player ${String(seat + 1)}" maxlength="20" autocomplete="off" />`;

/** The grid of `max` inputs, seats 3+ hidden, every line prefixed with `indent`. */
export const seatNamesHtml = ({ max, indent = '' }: SeatNamesMarkup): string =>
  [
    `<div class="seat-names" id="${SEAT_NAMES_ID}">`,
    ...Array.from({ length: max }, (_, seat) => inputHtml(seat)),
    `</div>`,
  ]
    .map((line) => `${indent}${line}`)
    .join('\n');
