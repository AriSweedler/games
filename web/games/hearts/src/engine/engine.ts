// Hearts's rules engine (docs/design/hearts.md §2): the scaffold's placeholder rules, pure and
// seat-checked, for the real rules to replace. Two seats take turns; a turn is Pass (the placeholder
// move) or Resign; after MAX_TURNS passes the injected Rng draws the winner, so the seam every real
// game needs (a seeded deal, a roll) is in place and tested. Pure: no clock, no DOM, the Rng injected.
import type { Rng } from '../../../../shared/lib/rng.ts';
import { err, ok, type Result } from '../../../../shared/lib/result.ts';

/** The shell's two seats: seat 0 is the host (or the first name typed), seat 1 the guest. */
export type Seat = 0 | 1;
export const SEATS: ReadonlyArray<Seat> = [0, 1];
export type Names = Readonly<[string, string]>;

export type Outcome =
  Readonly<{ kind: 'win'; winner: Seat; by: 'resign' | 'luck' }> | Readonly<{ kind: 'draw' }>;

export type Game = Readonly<{
  names: Names;
  turn: Seat;
  /** Turns taken so far. */
  turns: number;
  result: Outcome | null;
  /** What just happened, for the status line. */
  note: string;
}>;

export type Intent = Readonly<{ type: 'pass' }> | Readonly<{ type: 'resign' }>;

/** The placeholder end: after this many turns the Rng picks the winner. */
export const MAX_TURNS = 10;

export const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

export const newGame = (names: Names): Game => ({
  names,
  turn: 0,
  turns: 0,
  result: null,
  note: `${names[0]} to play.`,
});

/** What the seat to move may do now; nothing once the game is over. */
export const legalIntents = (game: Game): ReadonlyArray<Intent> =>
  game.result === null ? [{ type: 'pass' }, { type: 'resign' }] : [];

/** One turn by the seat to move; a refusal is the reason. */
export const apply = (game: Game, intent: Intent, rng: Rng): Result<Game, string> => {
  if (game.result !== null) return err('The game is over.');
  const mover = game.names[game.turn];
  switch (intent.type) {
    case 'resign':
      return ok({
        ...game,
        result: { kind: 'win', winner: other(game.turn), by: 'resign' },
        note: `${mover} resigned.`,
      });
    case 'pass': {
      const turns = game.turns + 1;
      const next = other(game.turn);
      if (turns < MAX_TURNS)
        return ok({
          ...game,
          turns,
          turn: next,
          note: `${mover} passed. ${game.names[next]} to play.`,
        });
      const winner: Seat = rng() < 0.5 ? 0 : 1;
      return ok({
        ...game,
        turns,
        turn: next,
        result: { kind: 'win', winner, by: 'luck' },
        note: `${mover} passed. ${game.names[winner]} wins on the draw.`,
      });
    }
  }
};
