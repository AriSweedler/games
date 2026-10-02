// Hive's fixtures (docs/design/hive.md §7): the seat's view read through the documented hook
// (`window.__hive.view()`: the whole game, since nothing is hidden), the pass-and-play start over
// the shell's (two names, the Pass the phone switch; no curtain: the table is on show at once),
// and one turn played through the hook (`window.__hive.legal()` -> `window.__hive.act(a)`) as a
// player would: the first legal action, so the turn moves on.
import { expect, type Page } from '@playwright/test';

import type { Action, View } from '../../web/games/hive/src/engine/view.ts';
import type { Viewport } from './geometry.ts';
import { startLocal } from './shell.ts';

export type { View };

/** The seat's view the page holds, or null before a table is up. */
export const readView = (page: Page): Promise<View | null> =>
  page.evaluate<View | null>('window.__hive.view()');

/** A view the page must have (the table is up); throws with the reason otherwise. */
export const requireView = async (page: Page): Promise<View> => {
  const view = await readView(page);
  if (view === null) throw new Error('the page holds no game view');
  return view;
};

/** What every seat's table agrees on: the game's clock, the board, whose turn, the hands, the result. */
export const hiveKey = (v: View | null): string =>
  v === null
    ? 'none'
    : JSON.stringify([v.startedAt, v.game.board, v.game.turn, v.game.hands, v.game.result]);

export const hiveSnapshot = async (page: Page): Promise<string> => hiveKey(await readView(page));

/** Pass the phone between two names at `viewport`: the shell's start; resolves with the table up, White's view, no curtain. */
export const hiveStartLocal = async (
  page: Page,
  url: string,
  viewport: Viewport,
  names: readonly [string, string] = ['Ann', 'Bob'],
): Promise<void> => {
  await startLocal(page, url, viewport, [names[0], names[1]]);
  await expect(page.locator('#curtainOverlay')).toBeHidden();
};

/** One action through the hook, as the seat holding the phone. */
export const hiveAct = async (page: Page, action: Action): Promise<void> => {
  await page.evaluate(`window.__hive.act(${JSON.stringify(action)})`);
};

/** The seat holding the phone plays its first legal action; resolves once the turn is the other seat's (or the game is over). */
export const hivePlayTurn = async (page: Page): Promise<void> => {
  const { game } = await requireView(page);
  const legal = await page.evaluate<ReadonlyArray<Action>>('window.__hive.legal()');
  const first = legal[0];
  if (first === undefined) throw new Error(`hive: ${game.turn} has nothing to play: ${game.note}`);
  await hiveAct(page, first);
  await expect.poll(async () => (await requireView(page)).game.turn).not.toBe(game.turn);
};
