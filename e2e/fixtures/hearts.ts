// Hearts's fixtures (docs/design/hearts.md §3): the seat's view read through the documented hook
// (`window.__hearts.view()`), the pass-and-play start over the shell's (three names: the smallest
// Hearts table, the Pass the phone switch, the first curtain lifted), and one action played through
// the hook (`legal()` -> `act(a)`): in the passing phase the first legal action is a pass of three,
// in play a card. In the pass every seat may act and `View.turn` need not change, so "the table
// moved" is read off the view key, never off `turn`.
import { expect, type Page } from '@playwright/test';

import type { Action, View } from '../../web/games/hearts/src/engine/view.ts';
import type { Viewport } from './geometry.ts';
import { stepperIds } from '../../web/shared/markup/stepper.ts';
import { reveal, startLocal } from './shell.ts';

export type { View };

/** The three seats of a pass-and-play Hearts game unless a spec says otherwise: the shell's two default names, then its third (web/shared/ui/seatCopy.ts). */
export const HEARTS_NAMES: readonly [string, string, string] = ['Ann', 'Bob', 'Sandro'];

/** The seat's view the page holds, or null before a table is up. */
export const readView = (page: Page): Promise<View | null> =>
  page.evaluate<View | null>('window.__hearts.view()');

/** A view the page must have (the table is up); throws with the reason otherwise. */
export const requireView = async (page: Page): Promise<View> => {
  const view = await readView(page);
  if (view === null) throw new Error('the page holds no game view');
  return view;
};

/** What every seat's table agrees on: the game's clock, the round, whose turn, every count, who has passed, the scores, the phase. */
export const heartsKey = (v: View | null): string =>
  v === null
    ? 'none'
    : JSON.stringify([v.startedAt, v.round, v.turn, v.counts, v.passed, v.scores, v.phase]);

export const heartsSnapshot = async (page: Page): Promise<string> =>
  heartsKey(await readView(page));

/**
 * Pass the phone between three or four names at `viewport`: the shell's start (its two inputs),
 * the stepper stepped to the count, each further seat's input filled when it differs from the
 * panel's default; resolves with the table up, the first curtain lifted.
 */
export const heartsStartLocal = async (
  page: Page,
  url: string,
  viewport: Viewport,
  names: ReadonlyArray<string> = HEARTS_NAMES,
): Promise<void> => {
  await startLocal(page, url, viewport, [names[0] ?? '', names[1] ?? ''], async (p) => {
    const ids = stepperIds('localPlayersCount');
    await expect.poll(() => p.locator(`#${ids.num}`).textContent()).toBeTruthy();
    const count = Number(await p.locator(`#${ids.num}`).textContent());
    if (count < names.length) await p.locator(`#${ids.inc}`).click();
    if (count > names.length) await p.locator(`#${ids.dec}`).click();
    await Promise.all(
      names.slice(2).map(async (name, k) => {
        const input = p.locator(`#p${String(k + 3)}NameInput`);
        await expect(input).toBeVisible();
        if ((await input.inputValue()) !== name) await input.fill(name);
      }),
    );
  });
  await reveal(page);
};

/** The pause sheet's title while one is up, else null. */
export const pauseTitle = async (page: Page): Promise<string | null> =>
  (await page.locator('#pauseOverlay').isVisible())
    ? page.locator('#pauseTitle').textContent()
    : null;

/**
 * One move of the phone through the page's own controls: a pause up is read (Continue), a curtain
 * up is lifted, a finished hand is left on its result sheet, else the holder's first legal action
 * through the hook. Resolves with what it did, so a spec can count the pauses it read.
 */
export const heartsStep = async (
  page: Page,
): Promise<Readonly<{ kind: 'pause' | 'curtain' | 'act' | 'handOver'; title: string | null }>> => {
  const title = await pauseTitle(page);
  if (title !== null) {
    await page.locator('#continueBtn').click();
    await expect(page.locator('#pauseOverlay')).toBeHidden();
    return { kind: 'pause', title };
  }
  if (await page.locator('#curtainOverlay').isVisible()) {
    await reveal(page);
    return { kind: 'curtain', title: null };
  }
  const view = await requireView(page);
  if (view.phase === 'handOver' || view.phase === 'gameOver')
    return { kind: 'handOver', title: null };
  await heartsPlayTurn(page);
  return { kind: 'act', title: null };
};

/** One action through the hook, as the seat holding the phone. */
export const heartsAct = async (page: Page, action: Action): Promise<void> => {
  await page.evaluate(`window.__hearts.act(${JSON.stringify(action)})`);
};

/** The seat holding the phone plays its first legal action (a pass of three, or a card); resolves once the table has moved on (the view key changed). */
export const heartsPlayTurn = async (page: Page): Promise<void> => {
  const before = await requireView(page);
  const legal = await page.evaluate<ReadonlyArray<Action>>('window.__hearts.legal()');
  const first = legal[0];
  if (first === undefined)
    throw new Error(`hearts: seat ${String(before.seat)} has nothing to play`);
  await heartsAct(page, first);
  await expect.poll(() => heartsSnapshot(page)).not.toBe(heartsKey(before));
};
