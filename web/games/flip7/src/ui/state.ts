// The page's reducer (docs/design/flip7.md §7): pass-and-play on one phone. Every card in Flip 7
// is face up, so there is no curtain: two screens, the setup (how many seats, their names) and
// the table (every seat's line, the current seat's Hit / Stay, the taker picker when an action
// card needs one, the scores when a round or the game is over). Pure: the shuffles come in as the
// `Rng` main.ts hands to `reduce`.
import type { Rng } from '../../../../shared/lib/rng.ts';
import { apply, deal, type Game, type Intent as GameIntent } from '../engine/engine.ts';

export const MIN_SEATS = 2;
export const MAX_SEATS = 8;
export const DEFAULT_SEATS = 3;

export type App = Readonly<{ kind: 'setup' }> | Readonly<{ kind: 'table'; game: Game }>;

export type Intent =
  | Readonly<{ type: 'start'; names: ReadonlyArray<string> }>
  | Readonly<{ type: 'game'; intent: GameIntent }>
  | Readonly<{ type: 'newGame' }>;

export const initialApp: App = { kind: 'setup' };

/** A seat's name: what was typed, trimmed, or "Player n". */
export const nameOrDefault = (typed: string, seat: number): string =>
  typed.trim() === '' ? `Player ${String(seat + 1)}` : typed.trim();

export const gameOf = (app: App): Game | null => (app.kind === 'setup' ? null : app.game);

export const reduce = (app: App, intent: Intent, rng: Rng): App => {
  switch (intent.type) {
    case 'start': {
      if (app.kind !== 'setup') return app;
      const names = intent.names.slice(0, MAX_SEATS).map(nameOrDefault);
      if (names.length < MIN_SEATS) return app;
      return { kind: 'table', game: deal(names, rng) };
    }
    case 'game':
      return app.kind === 'table'
        ? { kind: 'table', game: apply(app.game, intent.intent, rng) }
        : app;
    case 'newGame':
      return initialApp;
    default: {
      const never: never = intent;
      return never;
    }
  }
};
