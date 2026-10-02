// The page's reducer (docs/design/uno.md §7): pass-and-play on one phone. Three screens: the
// setup (how many seats, their names), the curtain ("pass the phone to …") that hides a hand
// while the phone changes hands, and the table (the current seat's hand, the pile, the others'
// counts). An engine intent plays through `apply`; when the turn lands on another seat the
// curtain drops, when the round or the game is over the table shows the scores to everyone.
// Pure: the shuffles come in as the `Rng` main.ts hands to `reduce`.
import type { Rng } from '../../../../shared/lib/rng.ts';
import { apply, deal, type Game, type Intent as GameIntent } from '../engine/engine.ts';

export const MIN_SEATS = 2;
export const MAX_SEATS = 6;
export const DEFAULT_SEATS = 2;

export type App =
  | Readonly<{ kind: 'setup' }>
  | Readonly<{ kind: 'curtain'; game: Game }>
  | Readonly<{ kind: 'table'; game: Game }>;

export type Intent =
  | Readonly<{ type: 'start'; names: ReadonlyArray<string> }>
  | Readonly<{ type: 'reveal' }>
  | Readonly<{ type: 'game'; intent: GameIntent }>
  | Readonly<{ type: 'newGame' }>;

export const initialApp: App = { kind: 'setup' };

/** A seat's name: what was typed, trimmed, or "Player n". */
export const nameOrDefault = (typed: string, seat: number): string =>
  typed.trim() === '' ? `Player ${String(seat + 1)}` : typed.trim();

export const gameOf = (app: App): Game | null => (app.kind === 'setup' ? null : app.game);

/** Whether the hand should hide behind the curtain before this state is shown. */
const curtains = (before: Game, after: Game, intent: GameIntent): boolean => {
  if (after.phase.kind === 'roundOver' || after.phase.kind === 'gameOver') return false;
  if (intent.type === 'nextRound') return true;
  return after.turn !== before.turn;
};

export const reduce = (app: App, intent: Intent, rng: Rng): App => {
  switch (intent.type) {
    case 'start': {
      if (app.kind !== 'setup') return app;
      const names = intent.names.slice(0, MAX_SEATS).map(nameOrDefault);
      if (names.length < MIN_SEATS) return app;
      return { kind: 'curtain', game: deal(names, rng) };
    }
    case 'reveal':
      return app.kind === 'curtain' ? { kind: 'table', game: app.game } : app;
    case 'game': {
      if (app.kind !== 'table') return app;
      const game = apply(app.game, intent.intent, rng);
      return curtains(app.game, game, intent.intent)
        ? { kind: 'curtain', game }
        : { kind: 'table', game };
    }
    case 'newGame':
      return initialApp;
    default: {
      const never: never = intent;
      return never;
    }
  }
};
