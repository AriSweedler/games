// Hearts's fixtures (docs/design/hearts.md §3): the seat's view read through the documented hook
// (`window.__hearts.view()`), the pass-and-play start over the shell's (two names, the Pass the phone
// switch, the first curtain lifted), and one turn played through the hook (`legal()` -> `act(a)`).
import { expect, type Page } from '@playwright/test';

import type { Action, View } from '../../web/games/hearts/src/engine/view.ts';
import type { Viewport } from './geometry.ts';
import { reveal, startLocal } from './shell.ts';

export type { View };

/** The seat's view the page holds, or null before a table is up. */
export const readView = (page: Page): Promise<View | null> =>
  page.evaluate<View | null>('window.__hearts.view()');

/** A view the page must have (the table is up); throws with the reason otherwise. */
export const requireView = async (page: Page): Promise<View> => {
  const view = await readView(page);
  if (view === null) throw new Error('the page holds no game view');
  return view;
};

/** What every seat's table agrees on: the game's clock, whose turn, the turns taken, the result. */
export const heartsKey = (v: View | null): string =>
  v === null ? 'none' : JSON.stringify([v.startedAt, v.game.turn, v.game.turns, v.game.result]);

export const heartsSnapshot = async (page: Page): Promise<string> =>
  heartsKey(await readView(page));

/** Pass the phone between two names at `viewport`: the shell's start; resolves with the table up, seat 0's view. */
export const heartsStartLocal = async (
  page: Page,
  url: string,
  viewport: Viewport,
  names: readonly [string, string] = ['Ann', 'Bob'],
): Promise<void> => {
  await startLocal(page, url, viewport, [names[0], names[1]]);
  await reveal(page);
};

/** One action through the hook, as the seat holding the phone. */
export const heartsAct = async (page: Page, action: Action): Promise<void> => {
  await page.evaluate(`window.__hearts.act(${JSON.stringify(action)})`);
};

/** The seat holding the phone plays its first legal action; resolves once the turn is the other seat's (or the game is over). */
export const heartsPlayTurn = async (page: Page): Promise<void> => {
  const { game } = await requireView(page);
  const legal = await page.evaluate<ReadonlyArray<Action>>('window.__hearts.legal()');
  const first = legal[0];
  if (first === undefined) throw new Error(`hearts: seat ${String(game.turn)} has nothing to play`);
  await heartsAct(page, first);
  await expect.poll(async () => (await requireView(page)).game.turn).not.toBe(game.turn);
};
