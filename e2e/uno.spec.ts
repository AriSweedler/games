// UNO pass-and-play on a phone (docs/design/uno.md §7): a seeded two-seat game through the page.
// The deal comes off `window.__rng` (a mulberry32 the spec installs before the page boots, so the
// hands are the same every run), the curtain hides the hand until "Show my hand", the table shows
// seven tiles with the playable ones lit, a play or a draw moves the turn and the curtain drops
// for the other seat. The documented hook `window.__uno` (`app`, `game()`, `playable()`,
// `dispatch`) reads the state back. On `pages` alone: this is about the page, not the origin.
import type { Page } from '@playwright/test';

import { pagePath } from './fixtures/site.ts';
import { expect, test } from './fixtures/two-players.ts';

type Phase = Readonly<{ kind: string }>;
type Game = Readonly<{
  names: ReadonlyArray<string>;
  hands: ReadonlyArray<ReadonlyArray<Readonly<{ id: string }>>>;
  turn: number;
  phase: Phase;
  round: number;
  scores: ReadonlyArray<number>;
}>;

/** mulberry32 as text: the specs run without the DOM lib and the page reads `window.__rng` at boot. */
const seedRng = async (page: Page, seed: number): Promise<void> => {
  await page.addInitScript({
    content: `(() => { let a = ${String(seed)} >>> 0; window.__rng = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`,
  });
};

const must = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) throw new Error('expected a value');
  return value;
};

const kind = (page: Page): Promise<string> => page.evaluate<string>('window.__uno.app.kind');
const game = (page: Page): Promise<Game | null> =>
  page.evaluate<Game | null>('window.__uno.game()');
const playable = (page: Page): Promise<ReadonlyArray<string>> =>
  page.evaluate<ReadonlyArray<string>>('window.__uno.playable()');

test('a seeded two-seat game: the deal, the curtain, a first move and the hand-off', async ({
  phone,
  project,
}) => {
  test.skip(project !== 'pages', 'about the page, not the origin');
  const { page } = phone;
  await seedRng(page, 42);
  await page.goto(pagePath(project, 'uno'));
  await expect(page).toHaveTitle('UNO');
  await expect.poll(() => page.evaluate<string>('typeof window.__uno')).toBe('object');
  expect(await kind(page)).toBe('setup');

  // Two seats by default, one name typed, one defaulted.
  await expect(page.locator('#names input')).toHaveCount(2);
  await page.locator('#names input').first().fill('Ari');
  await page.locator('#startBtn').click();

  // The curtain names the first seat and hides the hand.
  expect(await kind(page)).toBe('curtain');
  await expect(page.locator('#curtainName')).toHaveText('Ari');
  await expect(page.locator('#table')).toBeHidden();
  const dealt = await game(page);
  expect(dealt?.names).toEqual(['Ari', 'Player 2']);
  expect(dealt?.hands.map((h) => h.length)).toEqual([7, 7]);
  expect(dealt?.round).toBe(1);

  await page.locator('#revealBtn').click();
  expect(await kind(page)).toBe('table');
  await expect(page.locator('#hand .tile')).toHaveCount(7);
  await expect(page.locator('#topCard .tile')).toHaveCount(1);
  await expect(page.locator('#seats .seat')).toHaveCount(2);

  // A first move: play the first playable tile, else draw; either way the turn is resolved.
  const before = must(await game(page));
  const ids = await playable(page);
  if (before.phase.kind === 'color') {
    await page.locator('#colorPicker .swatch[data-color="red"]').click();
  } else if (ids.length > 0) {
    await expect(page.locator(`#hand .tile[data-id="${ids[0] ?? ''}"]`)).toBeEnabled();
    await page.locator(`#hand .tile[data-id="${ids[0] ?? ''}"]`).click();
  } else {
    await page.locator('#drawBtn').click();
  }
  const after = must(await game(page));
  const total = after.hands.reduce((n, h) => n + h.length, 0);
  // A card moved: either played onto the pile (13 in hands) or drawn (15), never lost.
  expect(after.hands.length).toBe(2);
  expect(total === 13 || total === 14 || total === 15 || after.phase.kind === 'color').toBe(true);

  // Keep moving with the hook until the turn lands on seat 2; the curtain must be up then.
  const steps = Array.from({ length: 6 });
  await steps.reduce<Promise<void>>(async (prev) => {
    await prev;
    const g = must(await game(page));
    if (g.turn === 1 && (await kind(page)) === 'curtain') return;
    if ((await kind(page)) !== 'table') return;
    if (g.phase.kind === 'color') {
      await page.evaluate(
        `window.__uno.dispatch({ type: 'game', intent: { type: 'color', color: 'red' } })`,
      );
    } else if (g.phase.kind === 'drawn') {
      await page.evaluate(`window.__uno.dispatch({ type: 'game', intent: { type: 'pass' } })`);
    } else {
      const open = await playable(page);
      await page.evaluate(
        open.length > 0
          ? `window.__uno.dispatch({ type: 'game', intent: { type: 'play', id: ${JSON.stringify(open[0])} } })`
          : `window.__uno.dispatch({ type: 'game', intent: { type: 'draw' } })`,
      );
    }
  }, Promise.resolve());
  const handed = must(await game(page));
  expect(handed.turn).toBe(1);
  expect(await kind(page)).toBe('curtain');
  await expect(page.locator('#curtainName')).toHaveText('Player 2');
  await expect(page.locator('#curtainNote')).not.toHaveText('');

  // New game returns to the setup.
  await page.locator('#newGameBtn').click();
  expect(await kind(page)).toBe('setup');
});
