// The seat-name inputs' behaviour (web/shared/markup/seatNames.ts places them): the paint shows
// the first `n` seats and fills every seat past the shell's two with its remembered name or the
// game's default (marked `data-default`, so the first tap clears it, as the shared binder does for
// the first two seats: web/shared/ui/home.ts); the binder reports each keystroke on those seats;
// the reader hands their raw values to the game's `local/click`. The first two seats stay the
// shell's (`bindHomeShell`), so a game's home binds this beside it.
import {
  dataOf,
  listen,
  readValue,
  requireId,
  setAttr,
  setValue,
  toggleClass,
  type DocumentLike,
} from '../edge/dom.ts';
import { extraSeats, seatNameInputId } from '../markup/seatNames.ts';
import { DEFAULT_MARK, clearDefault } from './home.ts';
import { localNameFor } from './shell.ts';

/** The page's seat cap and the game's pass-and-play defaults (shell.ts `localNamesOf`). */
export type SeatNamesSpec = Readonly<{ max: number; names: ReadonlyArray<string> }>;

/** The names of seats 3 to `max` as remembered: index 0 is seat 3; null where nothing was typed. */
export type ExtraNames = ReadonlyArray<string | null>;

/**
 * Seats 3+ shown up to `n`, each filled with its remembered name, or the game's default marked
 * `data-default` (Flip 7's `paintOptions` before this module).
 */
export const paintSeatNames = (
  doc: DocumentLike,
  spec: SeatNamesSpec,
  n: number,
  names: ExtraNames,
): void => {
  extraSeats(spec.max).forEach((seat) => {
    const input = requireId(doc, seatNameInputId(seat));
    const name = names[seat - 2] ?? null;
    toggleClass(input, 'hidden', seat >= n);
    setValue(input, name ?? localNameFor(spec.names, seat));
    setAttr(input, DEFAULT_MARK, name === null ? '1' : null);
  });
};

/**
 * Seats 3+: each keystroke reaches `onTyped(seat, value)` (seat 0-based), and a prefilled default
 * clears on its first focus or tap, reported as an empty name.
 */
export const bindSeatNames = (
  doc: DocumentLike,
  spec: SeatNamesSpec,
  onTyped: (seat: number, value: string) => void,
): void => {
  extraSeats(spec.max).forEach((seat) => {
    const input = requireId(doc, seatNameInputId(seat));
    listen(input, 'input', () => {
      onTyped(seat, readValue(input));
    });
    ['focus', 'pointerdown'].forEach((type) => {
      listen(input, type, () => {
        if (dataOf(input, 'default') === null) return;
        clearDefault(input);
        onTyped(seat, '');
      });
    });
  });
};

/** The raw values of seats 3 to `max`, in seat order. */
export const readSeatNames = (doc: DocumentLike, spec: SeatNamesSpec): ReadonlyArray<string> =>
  extraSeats(spec.max).map((seat) => readValue(requireId(doc, seatNameInputId(seat))));
