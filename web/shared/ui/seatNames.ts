// The seat-name inputs' behaviour (web/shared/markup/seatNames.ts places them): the paint shows
// the first `n` seats and fills every seat past the shell's two with its remembered name or the
// game's default (marked `data-default`, so the first tap clears it, as the shared binder does for
// the first two seats: web/shared/ui/home.ts); the binder dispatches each keystroke on those seats
// as the shell's `seatName/typed` (shell.ts keeps them in `ShellState.seatNames`, which the paint
// reads back); the reader hands their raw values to the game's `local/click`. The first two seats
// stay the shell's (`bindHomeShell`), so a game's home binds this beside it.
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
import { localNameFor, type ShellIntent, type ShellTypes } from './shell.ts';

/** The page's seat cap and the game's pass-and-play defaults (shell.ts `localNamesOf`). */
export type SeatNamesSpec = Readonly<{ max: number; names: ReadonlyArray<string> }>;

/**
 * The names of seats 3 to `max` as remembered: index 0 is seat 3; null where nothing was typed.
 * '' is a seat the player cleared (the binder reports the clear as ''): the paint keeps it empty
 * and unmarked, where null would refill the default under the caret and the next keystroke
 * would append to it ("SandroQ" stored for a typed "Q" on the live UNO home, 2026-10-02). A
 * game's reducer keeps the '' as typed; the pref drops the key, so a reload shows the default.
 */
export type ExtraNames = ReadonlyArray<string | null>;

/**
 * Seats 3+ shown up to `n`, each filled with its remembered name ('' kept empty), or the game's
 * default marked `data-default` where nothing is remembered (Flip 7's `paintOptions` before this
 * module).
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

/** The one intent this module dispatches: a game's `dispatch` takes it, its `Intent` being the shell's and its own. */
export type SeatNameTyped = Extract<ShellIntent<ShellTypes>, Readonly<{ type: 'seatName/typed' }>>;

/**
 * Seats 3+: each keystroke is dispatched as `seatName/typed` (seat 0-based), and a prefilled
 * default clears on its first focus or tap, dispatched as an empty name.
 */
export const bindSeatNames = (
  doc: DocumentLike,
  spec: SeatNamesSpec,
  dispatch: (intent: SeatNameTyped) => void,
): void => {
  extraSeats(spec.max).forEach((seat) => {
    const input = requireId(doc, seatNameInputId(seat));
    listen(input, 'input', () => {
      dispatch({ type: 'seatName/typed', seat, value: readValue(input) });
    });
    ['focus', 'pointerdown'].forEach((type) => {
      listen(input, type, () => {
        if (dataOf(input, 'default') === null) return;
        clearDefault(input);
        dispatch({ type: 'seatName/typed', seat, value: '' });
      });
    });
  });
};

/** The raw values of seats 3 to `max`, in seat order. */
export const readSeatNames = (doc: DocumentLike, spec: SeatNamesSpec): ReadonlyArray<string> =>
  extraSeats(spec.max).map((seat) => readValue(requireId(doc, seatNameInputId(seat))));
